import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-model"),
}));

import { generateText } from "ai";
import { POST } from "./route";

const mockedGenerateText = vi.mocked(generateText);

describe("POST /api/lyrics/produce", () => {
  beforeEach(() => {
    mockedGenerateText.mockReset();
  });

  it("returns 400 for unknown operation", async () => {
    const req = new Request("http://localhost/api/lyrics/produce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: { lines: [{ id: "L1", text: "hello world" }] },
        operation: "not-real",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Unknown operation");
  });

  it("returns hookify suggestions with insert_line_after op when candidate does not already repeat", async () => {
    const req = new Request("http://localhost/api/lyrics/produce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: {
          lines: [
            { id: "L1", text: "Fire fire burn now" },
            { id: "L2", text: "I keep moving" },
          ],
        },
        operation: "hookify",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suggestions.length).toBeGreaterThan(0);
    expect(body.suggestions[0].ops.some((op: { type: string }) => op.type === "insert_line_after")).toBe(true);
  });

  it("returns tighten fallback when LLM fails", async () => {
    mockedGenerateText.mockRejectedValueOnce(new Error("llm down"));

    const req = new Request("http://localhost/api/lyrics/produce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: {
          lines: [{ id: "L1", text: "I I I wanna stay" }],
        },
        operation: "tighten",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suggestions[0].id).toBe("tighten-filler");
    expect(body.suggestions[0].ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "replace_line",
          line_id: "L1",
          text: "I wanna stay",
        }),
      ]),
    );
  });

  it("returns decliche fallback when LLM response is invalid JSON", async () => {
    mockedGenerateText.mockResolvedValueOnce({ text: "not json" } as never);

    const req = new Request("http://localhost/api/lyrics/produce", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: {
          lines: [{ id: "L1", text: "heart on my sleeve" }],
        },
        operation: "decliche",
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suggestions[0].id).toBe("decliche-1");
  });
});
