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
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    console.error(`[stem] ${status}: ${message}`);
    return NextResponse.json({ error: message }, { status });
  }
}
