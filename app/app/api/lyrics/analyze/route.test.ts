import { describe, it, expect } from "vitest";
import { POST } from "./route";

describe("POST /api/lyrics/analyze", () => {
  it("returns 400 for invalid line schema", async () => {
    const req = new Request("http://localhost/api/lyrics/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: {
          lines: [{ id: "L1", text: 123 }],
        },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid line at index 0");
  });

  it("returns annotations for valid docs", async () => {
    const req = new Request("http://localhost/api/lyrics/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        doc: {
          lines: [
            { id: "L1", text: "heart on my sleeve tonight" },
            { id: "L2", text: "I walk into the night" },
          ],
        },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.annotations).toBeTruthy();
    expect(body.annotations.line_metrics.L1).toBeTruthy();
    expect(body.annotations.spans.length).toBeGreaterThan(0);
  });
});
