import { LyricDoc, Annotations } from "./lyrics-types";

export function buildTightenPrompt(doc: LyricDoc, annotations?: Annotations): string {
  const numbered = doc.lines.map((l) => `${l.id}: ${l.text}`).join("\n");

  const annotationContext = annotations?.spans.length
    ? `\nThese spans were flagged: ${JSON.stringify(annotations.spans)}`
    : "";

  return `You are a gentle lyric editor. These lyrics were written for a song.
Your job is MINIMAL cleanup:

1. Only fix things that are clearly awkward — broken grammar, filler phrases, cliches.
2. Preserve the artist's word choices. Do NOT rewrite, rephrase, or "improve" lines that are fine.
3. If a line reads fine as-is, keep it EXACTLY as-is. Most lines should stay unchanged.
4. Do NOT remove words like "just", "like", "so", "really" etc. unless they are clearly dead weight.
5. Do NOT add, remove, or change meaning. The artist chose these words.
6. Lines that look like structure tags (e.g. [Verse], [Chorus]) MUST be kept exactly as-is.

Be conservative. When in doubt, leave the line alone.

Return JSON with this exact shape:
{
  "suggestions": [
    {
      "title": "short description of changes",
      "lines": [
        { "id": "<line id>", "text": "<cleaned text>" }
      ],
      "notes": ["brief note about what you changed"]
    }
  ]
}

Return 1 suggestion. Include ALL lines (even unchanged ones).

LYRICS:
${numbered}
${annotationContext}`;
}

export function buildPunchPrompt(doc: LyricDoc, annotations?: Annotations): string {
  const numbered = doc.lines.map((l) => `${l.id}: ${l.text}`).join("\n");

  return `You are a songwriter making lyrics punchier and more vivid.
Lines that look like structure tags (e.g. [Verse], [Chorus]) MUST be kept exactly as-is.

Return JSON with this exact shape:
{
  "suggestions": [
    {
      "title": "short description",
      "lines": [{ "id": "<line id>", "text": "<text>" }],
      "notes": ["what changed"]
    }
  ]
}

Return 1 suggestion. Include ALL lines.

LYRICS:
${numbered}`;
}

export function buildDeclichePrompt(doc: LyricDoc, annotations?: Annotations): string {
  const numbered = doc.lines.map((l) => `${l.id}: ${l.text}`).join("\n");

  const clicheSpans = annotations?.spans.filter((s) => s.type === "cliche") ?? [];
  const clicheContext = clicheSpans.length
    ? `\nFlagged cliches: ${JSON.stringify(clicheSpans)}`
    : "";

  return `You are a songwriter replacing overused phrases with fresh alternatives.
Lines that look like structure tags (e.g. [Verse], [Chorus]) MUST be kept exactly as-is.
Only change lines that contain cliches. Keep unchanged lines exactly as-is.

Return JSON with this exact shape:
{
  "suggestions": [
    {
      "title": "short description",
      "lines": [{ "id": "<line id>", "text": "<text>" }],
      "notes": ["what changed"]
    }
  ]
}

Return 1 suggestion. Include ALL lines.

LYRICS:
${numbered}
${clicheContext}`;
}
