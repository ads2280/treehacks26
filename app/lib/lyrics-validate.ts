import { LyricDoc, Suggestion, EditOp } from "./lyrics-types";

interface LLMSuggestion {
  title: string;
  lines: { id: string; text: string }[];
  notes?: string[];
}

interface LLMResponse {
  suggestions: LLMSuggestion[];
}

function parseJSONLenient(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with salvage attempts.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // Continue with salvage attempts.
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
  }

  throw new Error("LLM response is not valid JSON");
}

export function parseLLMResponse(
  raw: string,
): { ok: true; data: LLMResponse } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = parseJSONLenient(raw);
  } catch {
    return { ok: false, error: "LLM response is not valid JSON" };
  }

  const obj = parsed as Record<string, unknown>;
  if (!obj || !Array.isArray(obj.suggestions)) {
    return { ok: false, error: "Missing suggestions array" };
  }

  for (const s of obj.suggestions) {
    const sug = s as Record<string, unknown>;
    if (typeof sug.title !== "string") {
      return { ok: false, error: "Suggestion missing title" };
    }
    if (!Array.isArray(sug.lines)) {
      return { ok: false, error: "Suggestion missing lines array" };
    }
    for (const line of sug.lines) {
      const l = line as Record<string, unknown>;
      if (typeof l.id !== "string" || typeof l.text !== "string") {
        return { ok: false, error: "Line missing id or text" };
      }
    }
  }

  return { ok: true, data: obj as unknown as LLMResponse };
}

/** Transform LLM response into Suggestion[] with EditOps. */
export function transformSuggestions(
  originalDoc: LyricDoc,
  llmResponse: LLMResponse,
): Suggestion[] {
  return llmResponse.suggestions.map((sug, i) => {
    const ops: EditOp[] = [];
    const previewLines = [...originalDoc.lines];

    for (const llmLine of sug.lines) {
      const originalLine = originalDoc.lines.find((l) => l.id === llmLine.id);
      if (!originalLine) continue;

      if (originalLine.text !== llmLine.text) {
        ops.push({
          type: "replace_line",
          line_id: llmLine.id,
          text: llmLine.text,
        });
        const idx = previewLines.findIndex((l) => l.id === llmLine.id);
        if (idx !== -1) {
          previewLines[idx] = { id: llmLine.id, text: llmLine.text };
        }
      }
    }

    return {
      id: `sug_${Date.now()}_${i}`,
      title: sug.title,
      ops,
      preview: { lines: previewLines },
      notes: sug.notes,
    };
  });
}
