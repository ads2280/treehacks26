import { NextRequest, NextResponse } from "next/server";
import { uploadAsset, uploadTalkingPhoto } from "@/lib/heygen";

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/mp3", "audio/wav"];

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type");
    if (!contentType || !ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Invalid content type. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const arrayBuffer = await req.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      return NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 }
      );
    }

    if (arrayBuffer.byteLength > MAX_BODY_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // ?type=talking_photo routes to /v1/talking_photo for selfie uploads
    // Everything else goes to /v1/asset
    const uploadType = req.nextUrl.searchParams.get("type");
    if (uploadType === "talking_photo") {
      const result = await uploadTalkingPhoto(Buffer.from(arrayBuffer), contentType);
      return NextResponse.json(result);
    }

    const result = await uploadAsset(Buffer.from(arrayBuffer), contentType);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upload failed";
    const statusMatch = message.match(/\((\d{3})\)/);
    const status = statusMatch ? parseInt(statusMatch[1], 10) : 500;
    console.error(`[heygen/upload] ${status}: ${message}`);
    return NextResponse.json({ error: message }, { status });
  }
}
