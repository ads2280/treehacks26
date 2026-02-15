import { NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { LyricDoc, Annotations, ProduceOperation, Suggestion, EditOp } from "@/lib/lyrics-types";
import { buildTightenPrompt, buildPunchPrompt, buildDeclichePrompt } from "@/lib/lyrics-prompts";
import { parseLLMResponse, transformSuggestions } from "@/lib/lyrics-validate";
import { removeFiller } from "@/lib/lyrics-filler";
import { detectHookPotential } from "@/lib/lyrics-hooks";

interface RequestBody {
  doc?: LyricDoc;
  annotations?: Annotations;
  operation?: ProduceOperation;
}

function buildReplaceLineOps(original: LyricDoc, updated: { id: string; text: string }[]): EditOp[] {
  const ops: EditOp[] = [];
  const updatedById = new Map(updated.map((line) => [line.id, line.text]));

  for (const line of original.lines) {
    const nextText = updatedById.get(line.id);
    const normalizedNext = nextText ?? "";
    if (line.text !== normalizedNext) {
      ops.push({
        type: "replace_line",
        line_id: line.id,
        text: normalizedNext,
      });
    }
  }

  return ops;
}

async function runLLMProduce(doc: LyricDoc, annotations: Annotations | undefined, operation: "tighten" | "punch" | "decliche") {
  const promptBuilder = operation === "tighten"
    ? buildTightenPrompt
    : operation === "decliche"
      ? buildDeclichePrompt
      : buildPunchPrompt;

  const prompt = promptBuilder(doc, annotations);

  const { text } = await generateText({
    model: openai("gpt-5-nano"),
    system: "You are a skilled songwriter and lyric editor. Respond with valid JSON only.",
    prompt,
    temperature: 0.7,
  });

  const parsed = parseLLMResponse(text);
  if (!parsed.ok) {
    throw new Error(`Failed to parse LLM response: ${parsed.error}`);
  }

  return transformSuggestions(doc, parsed.data);
}

function buildHookifySuggestions(doc: LyricDoc): Suggestion[] {
  const candidates = detectHookPotential(doc.lines);
  if (candidates.length === 0) return [];

  return candidates.map((candidate, i) => {
    const alreadyRepeats = doc.lines.filter(
      (line) => line.text.toLowerCase().trim() === candidate.text.toLowerCase().trim(),
    ).length > 1;

    if (alreadyRepeats) {
      return {
        id: `hookify-${i + 1}`,
        title: `"${candidate.text}" - this could be a great hook!`,
        ops: [],
        preview: doc,
        notes: candidate.reasons.map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1)),
      } satisfies Suggestion;
    }

    const newLineId = `hook-repeat-${candidate.line_id}`;
    const insertOp: EditOp = {
      type: "insert_line_after",
      line_id: candidate.line_id,
      new_line: { id: newLineId, text: candidate.text },
    };

    const previewLines = [...doc.lines];
    const idx = previewLines.findIndex((line) => line.id === candidate.line_id);
    if (idx !== -1) {
      previewLines.splice(idx + 1, 0, { id: newLineId, text: candidate.text });
    }

    return {
      id: `hookify-${i + 1}`,
      title: `"${candidate.text}" - this could be a great hook! Try repeating it`,
      ops: [insertOp],
      preview: { ...doc, lines: previewLines },
      notes: candidate.reasons.map((reason) => reason.charAt(0).toUpperCase() + reason.slice(1)),
    } satisfies Suggestion;
  });
}

function validateBody(body: RequestBody): { ok: true; doc: LyricDoc; operation: ProduceOperation } | { ok: false; error: string } {
  if (!body.doc || !Array.isArray(body.doc.lines)) {
    return { ok: false, error: "Missing or invalid 'doc.lines' - expected an array" };
  }

  for (let i = 0; i < body.doc.lines.length; i++) {
    const line = body.doc.lines[i];
    if (!line || typeof line.id !== "string" || typeof line.text !== "string") {
      return {
        ok: false,
        error: `Invalid line at index ${i} - each line needs 'id' (string) and 'text' (string)`,
      };
    }
  }

  if (!body.operation) {
    return { ok: false, error: "Missing operation" };
  }

  const operation = body.operation;
  if (!["tighten", "punch", "decliche", "hookify"].includes(operation)) {
    return { ok: false, error: `Unknown operation: ${body.operation}` };
  }

  return { ok: true, doc: body.doc, operation };
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validateBody(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { doc, operation } = validated;
  const { annotations } = body;

  if (operation === "hookify") {
    return NextResponse.json({ suggestions: buildHookifySuggestions(doc) });
  }

  if (operation === "tighten") {
    const cleaned = removeFiller(doc);
    const fallbackSuggestion: Suggestion = {
      id: "tighten-filler",
      title: "Filler words removed",
      ops: buildReplaceLineOps(doc, cleaned.lines),
      preview: cleaned,
      notes: ["Rule-based cleanup only"],
    };

    try {
      const suggestions = await runLLMProduce(cleaned, annotations, "tighten");
      return NextResponse.json({ suggestions });
    } catch (error) {
      console.error("[lyrics/produce][tighten] Error:", error);
      return NextResponse.json({ suggestions: [fallbackSuggestion] });
    }
  }

  if (operation === "decliche") {
    try {
      const suggestions = await runLLMProduce(doc, annotations, "decliche");
      return NextResponse.json({ suggestions });
    } catch (error) {
      console.error("[lyrics/produce][decliche] Error:", error);
      return NextResponse.json({
        suggestions: [
          {
            id: "decliche-1",
            title: "Could not analyze cliches right now",
            ops: [],
            preview: doc,
            notes: ["LLM unavailable or invalid response - try again"],
          } satisfies Suggestion,
        ],
      });
    }
  }

  try {
    const suggestions = await runLLMProduce(doc, annotations, "punch");
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[lyrics/produce][punch] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate punch suggestions" },
      { status: 502 },
    );
  }
}
