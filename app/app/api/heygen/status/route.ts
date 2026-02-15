import { NextRequest, NextResponse } from "next/server";
import { getVideoStatus } from "@/lib/heygen";

export async function GET(req: NextRequest) {
  try {
    const videoId = req.nextUrl.searchParams.get("video_id");
    if (!videoId) {
      return NextResponse.json(
        { error: "video_id query parameter is required" },
        { status: 400 }
      );
    }

    const result = await getVideoStatus(videoId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Status check failed";
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    console.error(`[heygen/status] ${status}: ${message}`);
    return NextResponse.json({ error: message }, { status });
  }
}
