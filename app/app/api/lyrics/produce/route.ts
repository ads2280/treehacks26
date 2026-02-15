import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { LyricDoc, Annotations, ProduceOperation } from "@/lib/lyrics-types";
import { buildTightenPrompt, buildPunchPrompt, buildDeclichePrompt } from "@/lib/lyrics-prompts";
import { parseLLMResponse, transformSuggestions } from "@/lib/lyrics-validate";

interface RequestBody {
  doc: LyricDoc;
  annotations?: Annotations;
  operation: ProduceOperation;
}

const PROMPT_BUILDERS: Record<
  ProduceOperation,
  (doc: LyricDoc, annotations?: Annotations) => string
> = {
  tighten: buildTightenPrompt,
  punch: buildPunchPrompt,
  decliche: buildDeclichePrompt,
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { doc, annotations, operation } = body;

    if (!doc?.lines || !operation) {
      return NextResponse.json(
        { error: "Missing doc or operation" },
        { status: 400 },
      );
    }

    const buildPrompt = PROMPT_BUILDERS[operation];
    if (!buildPrompt) {
      return NextResponse.json(
        { error: `Unknown operation: ${operation}` },
        { status: 400 },
      );
    }

    const prompt = buildPrompt(doc, annotations);

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: "You are a skilled songwriter and lyric editor. Respond with valid JSON only.",
      prompt,
      temperature: 0.7,
    });

    const parsed = parseLLMResponse(text);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: `Failed to parse LLM response: ${parsed.error}` },
        { status: 502 },
      );
    }

    const suggestions = transformSuggestions(doc, parsed.data);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[lyrics/produce] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
