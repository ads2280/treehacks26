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
  "really",
  "really really",
  "very",
  "very very",
  "sort of",
  "kind of",
  "kinda",
  "sorta",
  "you know",
  "i mean",
];

const FULL_LINE_HUM = /^[\s]*(([hm]+|la|da|na|do+|ba|sha|ooh?|ah)[\s]*)+$/i;
const STUTTER_RE = /\b(\w+)((\s+\1){2,})\b/gi;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpacing(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .trim();
}

export function removeFiller(doc: LyricDoc): LyricDoc {
  const lines = doc.lines.map((line) => {
    if (isStructureTag(line.text)) return line;

    let text = line.text;
    text = text.replace(STUTTER_RE, "$1");

    for (const filler of FILLERS) {
      const pattern = new RegExp(`\\b${escapeRegex(filler)}\\b\\s*`, "gi");
      text = text.replace(pattern, " ");
    }

    if (FULL_LINE_HUM.test(text)) {
      text = "";
    }

    return {
      id: line.id,
      text: normalizeSpacing(text),
    };
  });

  return { ...doc, lines };
}
