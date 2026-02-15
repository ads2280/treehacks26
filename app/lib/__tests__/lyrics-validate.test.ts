import { describe, it, expect } from "vitest";
import { parseLLMResponse } from "@/lib/lyrics-validate";

describe("parseLLMResponse", () => {
  it("parses JSON wrapped in markdown code fences", () => {
    const raw = `Here you go:\n\`\`\`json\n{"suggestions":[{"title":"Decliche","lines":[{"id":"L1","text":"fresh line"}],"notes":["note"]}]}\n\`\`\``;
    const parsed = parseLLMResponse(raw);

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.suggestions[0].title).toBe("Decliche");
      expect(parsed.data.suggestions[0].lines[0].id).toBe("L1");
    }
  });
});
