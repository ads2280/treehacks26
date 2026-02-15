import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const maxDuration = 120;

const BG_DIR = path.join(process.cwd(), "public", "generated-backgrounds");

/** Write image to public/ and return the local URL path */
async function storeImage(buffer: Buffer, filename: string): Promise<string> {
  await mkdir(BG_DIR, { recursive: true });
  await writeFile(path.join(BG_DIR, filename), buffer);
  return `/generated-backgrounds/${filename}`;
}

interface LyricsSection {
  tag: string;
  lines: string[];
}

interface BackgroundRequest {
  sections: LyricsSection[];
  vibePrompt: string;
  theme: string;
  tags: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: BackgroundRequest = await req.json();

    if (!body.sections || !Array.isArray(body.sections) || body.sections.length === 0) {
      return NextResponse.json(
        { error: "sections (non-empty array) is required" },
        { status: 400 }
      );
    }

    if (!body.vibePrompt) {
      return NextResponse.json(
        { error: "vibePrompt is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const openai = new OpenAI({ apiKey });

    // Step 1: Generate visual scene descriptions for all sections
    // Sanitize lyrics to remove words that could trigger DALL-E safety filters
    const sanitizeLyrics = (text: string) =>
      text.replace(/\b(kill|die|dead|death|blood|gun|shoot|drug|cocaine|heroin|meth|weed|smoke|drunk|alcohol|beer|wine|liquor|sex|sexy|naked|nude|strip|ho|hoe|bitch|nigga|nigger|fuck|shit|damn|ass|pussy|dick|cock|whore|slut|gang|thug|murder|stab|knife|fight|beat|punch|hit|attack|war|bomb|terror|suicide|hang|cut|scar|burn|fire|flame|devil|satan|demon|hell|hate|rage|anger|destroy|crush|smash|break|hurt|pain|suffer|torture|abuse|slave|prison|jail|arrest|cop|police|steal|rob|crime)\b/gi, "***")
      .replace(/\*{3,}/g, ""); // Remove the redacted markers entirely

    const sanitizedSections = body.sections.map((s) => ({
      ...s,
      lines: s.lines.map(sanitizeLyrics),
    }));

    const scenePrompt = `You are a music video art director creating SAFE, ABSTRACT background descriptions for an AI image generator.

Song mood: ${sanitizeLyrics(body.vibePrompt)}
Visual theme: ${body.theme || "cinematic"}
Style: ${body.tags || "atmospheric"}

YOUR TASK: For each song section, describe a beautiful LANDSCAPE or ABSTRACT SCENE. Think: nature photography, architectural photography, abstract digital art.

ABSOLUTE RULES — violating these will cause image generation to fail:
- ONLY describe: skies, water, mountains, cities, forests, abstract shapes, gradients, light, color, texture
- NEVER mention: people, faces, bodies, hands, eyes, weapons, substances, text, words, letters, logos
- NEVER reference the lyric content directly — capture only the EMOTIONAL TONE as colors and scenery
- Keep each description under 30 words
- Use only visual/artistic vocabulary

Sections (use the emotion, ignore specific words):
${sanitizedSections.map((s, i) => `${i + 1}. [${s.tag}] ${s.lines.join(" / ")}`).join("\n")}

Respond with ONLY a valid JSON array of strings.`;

    const sceneResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: scenePrompt }],
    });

    const sceneContent = sceneResponse.choices[0]?.message?.content?.trim();
    if (!sceneContent) {
      throw new Error("Failed to generate scene descriptions");
    }

    let sceneDescriptions: string[];
    try {
      sceneDescriptions = JSON.parse(sceneContent);
    } catch {
      // Try to extract JSON array from the response if it has extra text
      const match = sceneContent.match(/\[[\s\S]*\]/);
      if (match) {
        sceneDescriptions = JSON.parse(match[0]);
      } else {
        throw new Error("Failed to parse scene descriptions from AI response");
      }
    }

    // Pad or trim to match sections length
    while (sceneDescriptions.length < body.sections.length) {
      sceneDescriptions.push(
        sceneDescriptions[sceneDescriptions.length - 1] || "Abstract cinematic background"
      );
    }
    sceneDescriptions = sceneDescriptions.slice(0, body.sections.length);

    // Step 2: Generate ONE background image (HeyGen uses only the first background)
    const maxImages = 1;
    const imageSections = sceneDescriptions.slice(0, maxImages);

    const generateImage = async (description: string, i: number) => {
      const safeDescription = sanitizeLyrics(description)
        .replace(/[^a-zA-Z0-9\s,.\-']/g, "")
        .slice(0, 200);
      const imagePrompt = `Beautiful ${body.theme || "cinematic"} landscape photograph, wide shot, no people, no text, no faces: ${safeDescription}. Style: ${body.tags || "atmospheric"}, professional photography`;

      try {
        const imageResponse = await openai.images.generate({
          model: "dall-e-2",
          prompt: imagePrompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        });

        const imageData = imageResponse.data?.[0];
        if (!imageData || !imageData.b64_json) {
          throw new Error("No image data returned");
        }

        const imageBuffer = Buffer.from(imageData.b64_json, "base64");
        const url = await storeImage(imageBuffer, `producething-bg-${Date.now()}-${i}.png`);
        return url;
      } catch (imgErr) {
        console.warn(`[generate-backgrounds] Section ${i + 1} failed, retrying with safe fallback:`, imgErr instanceof Error ? imgErr.message : imgErr);
        try {
          const fallbackPrompt = `Abstract cinematic background, soft gradient lighting, ${body.theme || "cinematic"} mood, beautiful color palette, no people, no text`;
          const fallbackResponse = await openai.images.generate({
            model: "dall-e-2",
            prompt: fallbackPrompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json",
          });
          const fallbackData = fallbackResponse.data?.[0];
          if (fallbackData?.b64_json) {
            const imageBuffer = Buffer.from(fallbackData.b64_json, "base64");
            return await storeImage(imageBuffer, `producething-bg-${Date.now()}-${i}.png`);
          }
        } catch {
          // Fallback also failed
        }
        return null;
      }
    };

    // Fire all image generations in parallel (capped at maxImages)
    const imageResults = await Promise.all(
      imageSections.map((desc, i) => generateImage(desc, i))
    );

    // Build results for ALL sections (sections beyond maxImages get no background)
    const results = body.sections.map((section, i) => ({
      ...section,
      sceneDescription: sceneDescriptions[i] || "Abstract cinematic background",
      backgroundUrl: i < imageResults.length ? imageResults[i] : null,
    }));

    return NextResponse.json({ sections: results });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Background generation failed";
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    console.error(`[generate-backgrounds] ${status}: ${message}`);
    return NextResponse.json({ error: message }, { status });
  }
}
