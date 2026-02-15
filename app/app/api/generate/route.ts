import { NextRequest, NextResponse } from "next/server";
import { generateTrack } from "@/lib/suno";
import { SunoGenerateRequest } from "@/lib/layertune-types";

export async function POST(req: NextRequest) {
  try {
    const body: SunoGenerateRequest = await req.json();

    if (!body.topic && !body.tags && !body.prompt) {
      return NextResponse.json(
        { error: "At least one of topic, tags, or prompt is required" },
        { status: 400 }
      );
    }

    if (body.topic && body.topic.length > 500) {
      return NextResponse.json(
        { error: "Topic too long. Please keep it under 500 characters." },
        { status: 400 }
      );
    }

    if (body.tags && body.tags.length > 100) {
      return NextResponse.json(
        { error: "Tags too long. Please keep it under 100 characters." },
        { status: 400 }
      );
    }

    if (body.negative_tags && body.negative_tags.length > 100) {
      return NextResponse.json(
        { error: "Negative tags too long. Please keep it under 100 characters." },
        { status: 400 }
      );
    }

    const result = await generateTrack(body);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    // Extract actual HTTP status from Suno error messages like "Suno request failed (400): ..."
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    console.error(`[generate] ${status}: ${message}`);
    return NextResponse.json({ error: message }, { status });
  }
}
