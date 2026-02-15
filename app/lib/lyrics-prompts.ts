import { LyricDoc, Annotations } from "./lyrics-types";
import { syllable } from "syllable";

export function buildTightenPrompt(doc: LyricDoc, annotations?: Annotations): string {
  const numbered = doc.lines.map((l) => `${l.id}: ${l.text}`).join("\n");

  const annotationContext = annotations?.spans.length
    ? `\nThese spans were flagged: ${JSON.stringify(annotations.spans)}`
    : "";

  return `You are a lyric editor. These lyrics were transcribed from someone singing into a mic.
Your job is to make them tighter and more singable. Focus on:

1. Condense wordy phrases. Spoken language is often longer than sung language.
2. Cut run-on phrases that would not work well in a song. If a line is too long to sing in one breath, split or trim it.
3. Remove phrases that add no meaning, false starts, accidental repetition, and meaningless filler.
4. Fix vague references to make them more immediate.
5. Preserve the artist's intent, tone, and style. Do not rewrite, only tighten.
6. If a line is already tight and singable, keep it EXACTLY as-is.
7. Lines that look like structure tags (e.g. [Verse], [Chorus]) MUST be kept exactly as-is.

Keep edits minimal. Only change what genuinely makes the lyric tighter.

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
  const numbered = doc.lines
    .map((l) => `${l.id}: ${l.text} (${syllable(l.text)} syllables)`)
    .join("\n");

  const clicheSpans = annotations?.spans.filter((s) => s.type === "cliche") ?? [];
  const clicheContext = clicheSpans.length
    ? `\nFlagged cliches: ${JSON.stringify(clicheSpans)}`
    : "";

  return `You are a lyric editor. Find any cliche, overused, or unoriginal phrases.
Common cliches include things like "heart on my sleeve", "break my heart", and "meant to be".
Use your judgment for any phrase that feels tired or overdone.

Rules:
1. For each line that contains a cliche, suggest a replacement for the FULL line.
2. The replacement must have a similar syllable count (within +/-2 of the original).
3. Keep the same meaning and emotion. Make it fresher, not different.
4. Match the tone and style of the rest of the song.
5. Lines without cliches must stay EXACTLY as-is.
6. In notes, phrase it gently as a suggestion, not an assertion.
7. Lines that look like structure tags (e.g. [Verse], [Chorus]) MUST be kept exactly as-is.

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

Return 1-2 suggestions. Include ALL lines.

LYRICS:
${numbered}
${clicheContext}`;
}

export function buildHookifyPrompt(doc: LyricDoc, annotations?: Annotations): string {
  return `Make the hook catchier:\n${doc.lines.map((l) => l.text).join("\n")}`;
}
