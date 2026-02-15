import { NextResponse } from "next/server";
import type { LyricDoc } from "@/lib/lyrics-types";
import { analyzeWithSections } from "@/lib/lyrics-analysis";

interface RequestBody {
  doc?: LyricDoc;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.doc || !Array.isArray(body.doc.lines)) {
    return NextResponse.json(
      { error: "Missing or invalid 'doc.lines' - expected an array" },
      { status: 400 },
    );
  }

  for (let i = 0; i < body.doc.lines.length; i++) {
    const line = body.doc.lines[i];
    if (!line || typeof line.id !== "string" || typeof line.text !== "string") {
      return NextResponse.json(
        { error: `Invalid line at index ${i} - each line needs 'id' (string) and 'text' (string)` },
        { status: 400 },
      );
    }
  }

  const annotations = analyzeWithSections(body.doc);
  return NextResponse.json({ annotations });
}
