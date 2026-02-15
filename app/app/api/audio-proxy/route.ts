import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "cdn1.suno.ai",
  "cdn2.suno.ai",
  "cdn.suno.ai",
  "audiopipe.suno.ai",
  "suno.ai",
  "studio-api.prod.suno.com",
  ...(process.env.MODAL_DEMUCS_URL
    ? [new URL(process.env.MODAL_DEMUCS_URL).hostname]
    : []),
];

function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return ALLOWED_HOSTS.some((host) => parsed.hostname === host);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  if (!isAllowedUrl(url)) {
    return NextResponse.json(
      { error: "URL not allowed. Only allowlisted audio hosts are permitted." },
      { status: 403 }
    );
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream fetch failed: ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") || "audio/mpeg";
    const contentLength = res.headers.get("content-length");

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    };

    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    if (res.body) {
      return new NextResponse(res.body, { headers: responseHeaders });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, { headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio proxy failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
