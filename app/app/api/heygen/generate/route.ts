import { NextRequest, NextResponse } from "next/server";
import { generateVideo, HeyGenVideoInput } from "@/lib/heygen";

export async function POST(req: NextRequest) {
  try {
    const body: { video_inputs?: HeyGenVideoInput[] } = await req.json();

    if (!body.video_inputs || !Array.isArray(body.video_inputs)) {
      return NextResponse.json(
        { error: "video_inputs (array) is required" },
        { status: 400 }
      );
    }

    if (body.video_inputs.length === 0) {
      return NextResponse.json(
        { error: "video_inputs must contain at least one item" },
        { status: 400 }
      );
    }

    if (body.video_inputs.length > 50) {
      return NextResponse.json(
        { error: "Too many video inputs (max 50 per request)" },
        { status: 400 }
      );
    }

    const result = await generateVideo(body.video_inputs);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Video generation failed";
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    console.error(`[heygen/generate] ${status}: ${message}`);
    return NextResponse.json({ error: message }, { status });
  }
}
