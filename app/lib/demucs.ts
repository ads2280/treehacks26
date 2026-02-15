import type { DemucsResponse } from "@/lib/layertune-types";

function getModalEndpointUrl(): string {
  const url = process.env.MODAL_DEMUCS_URL;
  if (!url) throw new Error("MODAL_DEMUCS_URL not configured");
  return url.replace(/\/$/, ""); // strip trailing slash
}

export async function separateWithDemucs(
  audioUrl: string,
  jobId: string
): Promise<DemucsResponse> {
  const endpoint = getModalEndpointUrl();

  const res = await fetch(`${endpoint}/separate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_url: audioUrl, job_id: jobId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Demucs separation failed (${res.status}): ${text}`);
  }

  return res.json();
}

export function demucsStemUrl(jobId: string, stemName: string): string {
  const endpoint = getModalEndpointUrl();
  return `${endpoint}/get_stem?job_id=${encodeURIComponent(jobId)}&stem=${encodeURIComponent(stemName)}`;
}
