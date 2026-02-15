import { LyricDoc } from "./lyrics-types";

export function stringToLyricDoc(raw: string): LyricDoc {
  const lines = raw.split("\n").map((text, i) => ({
    id: `L${i}`,
    text,
  }));
  return { lines };
}

export function lyricDocToString(doc: LyricDoc): string {
  return doc.lines.map((l) => l.text).join("\n");
}

const STRUCTURE_TAG_RE = /^\s*\[(?:Intro|Verse|Chorus|Bridge|Outro|Hook|Pre-Chorus|Post-Chorus|Interlude|Break)(?:\s*\d*)?\]\s*$/i;

export function isStructureTag(text: string): boolean {
  return STRUCTURE_TAG_RE.test(text);
}
