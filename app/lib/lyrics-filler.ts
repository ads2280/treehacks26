import { LyricDoc } from "./lyrics-types";
import { isStructureTag } from "./lyrics-utils";

const FILLERS: string[] = [
  "basically",
  "literally",
  "actually",
  "honestly",
  "totally",
  "definitely",
  "obviously",
  "certainly",
  "absolutely",
  "really really",
  "very very",
  "sort of",
  "kind of",
  "you know",
  "i mean",
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function removeFiller(doc: LyricDoc): LyricDoc {
  const lines = doc.lines.map((line) => {
    if (isStructureTag(line.text)) return line;

    let text = line.text;
    for (const filler of FILLERS) {
      const pattern = new RegExp(`\\b${escapeRegex(filler)}\\b\\s*`, "gi");
      text = text.replace(pattern, "");
    }

    text = text.replace(/\s{2,}/g, " ").trim();

    return { id: line.id, text };
  });

  return { ...doc, lines };
}
