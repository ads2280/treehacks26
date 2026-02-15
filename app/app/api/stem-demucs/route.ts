import { NextRequest, NextResponse } from "next/server";
import { separateWithDemucs, demucsStemUrl } from "@/lib/demucs";
import { DEMUCS_TO_STEM_TYPE } from "@/lib/layertune-types";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { audio_url, clip_id } = await req.json();

    if (!audio_url || typeof audio_url !== "string") {
      return NextResponse.json(
        { error: "audio_url (string) required" },
        { status: 400 }
      );
    }

    // Validate audio_url against Suno CDN allowlist to prevent SSRF
    const ALLOWED_AUDIO_HOSTS = [
      "cdn1.suno.ai",
      "cdn2.suno.ai",
      "cdn.suno.ai",
      "audiopipe.suno.ai",
    ];
    try {
      const parsed = new URL(audio_url);
      const allowed =
        (parsed.protocol === "https:" || parsed.protocol === "http:") &&
        ALLOWED_AUDIO_HOSTS.some(
          (host) =>
            parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
        );
      if (!allowed) {
        return NextResponse.json(
          { error: "audio_url must be a Suno CDN URL" },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid audio_url" },
        { status: 400 }
      );
    }

    const jobId = clip_id || crypto.randomUUID();
    const result = await separateWithDemucs(audio_url, jobId);

    const stems = Object.entries(result.stems)
      .filter(([name]) => name in DEMUCS_TO_STEM_TYPE)
      .map(([name]) => ({
        stemType: DEMUCS_TO_STEM_TYPE[name],
        audioUrl: demucsStemUrl(result.job_id, name),
        source: "demucs" as const,
      }));

    return NextResponse.json({ job_id: result.job_id, stems });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Demucs separation failed";
    console.error("Demucs stem separation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
