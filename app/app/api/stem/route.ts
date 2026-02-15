import { NextRequest, NextResponse } from "next/server";
import { stemClip } from "@/lib/suno";

export async function POST(req: NextRequest) {
  try {
    const { clip_id } = await req.json();
    if (!clip_id || typeof clip_id !== "string") {
      return NextResponse.json({ error: "clip_id (string) required" }, { status: 400 });
    }
    const result = await stemClip(clip_id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stem separation failed";
    const status = message.includes("(429)") ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
