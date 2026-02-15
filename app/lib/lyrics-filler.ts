import { LyricDoc } from "@/lib/lyrics-types";
import { isStructureTag } from "@/lib/lyrics-utils";

const FILLER_PHRASES = [
  "really",
  "very",
  "just",
  "kinda",
  "kind of",
  "sorta",
  "sort of",
  "literally",
  "honestly",
  "basically",
];

function removePhrase(text: string, phrase: string): string {
  const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  return text.replace(pattern, " ");
}

function normalizeSpacing(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

export function removeFiller(doc: LyricDoc): LyricDoc {
  return {
    ...doc,
    lines: doc.lines.map((line) => {
      if (isStructureTag(line.text) || !line.text.trim()) return line;

      const cleaned = FILLER_PHRASES.reduce((acc, phrase) => removePhrase(acc, phrase), line.text);
      const normalized = normalizeSpacing(cleaned);

      return {
        ...line,
        text: normalized || line.text,
      };
    }),
  };
}
