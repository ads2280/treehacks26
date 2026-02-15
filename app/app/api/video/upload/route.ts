import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_BODY_SIZE = 100 * 1024 * 1024; // 100MB — videos are large
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const VIDEO_DIR = path.join(process.cwd(), "public", "generated-videos");

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
        { error: "File too large. Maximum size is 100MB." },
        { status: 400 }
      );
    }

    const ext = contentType === "video/webm" ? "webm" : "mp4";
    const filename = `producething-video-${Date.now()}.${ext}`;
    await mkdir(VIDEO_DIR, { recursive: true });
    await writeFile(path.join(VIDEO_DIR, filename), Buffer.from(arrayBuffer));

    return NextResponse.json({ url: `/generated-videos/${filename}` });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Video upload failed";
    console.error(`[video/upload] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
