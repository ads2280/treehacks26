import { NextResponse } from "next/server";
import { createStreamingToken } from "@/lib/heygen";

export async function POST() {
  try {
    const result = await createStreamingToken();
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Streaming token creation failed";
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    console.error(`[heygen/streaming-token] ${status}: ${message}`);
    return NextResponse.json({ error: message }, { status });
  }
}
