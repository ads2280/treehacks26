import { isStructureTag } from "./lyrics-utils";
import { syllable } from "syllable";

interface HookCandidate {
  line_id: string;
  text: string;
  reasons: string[];
}

export function detectHookPotential(
  lines: { id: string; text: string }[],
): HookCandidate[] {
  const candidates: HookCandidate[] = [];

  for (const line of lines) {
    if (isStructureTag(line.text)) continue;

    const trimmed = line.text.trim();
    if (!trimmed) continue;

    const reasons: string[] = [];
    const words = trimmed.split(/\s+/);
    const syllCount = syllable(trimmed);

    if (words.length <= 6 && syllCount <= 10) {
      reasons.push("short and memorable");
    }

    if (/[!?]$/.test(trimmed)) {
      reasons.push("emotionally punctuated");
    }

    if (/(.+)\b.*\1/i.test(trimmed) && trimmed.length > 3) {
      reasons.push("has internal repetition");
    }

    const wordSet = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")));
    const emotionWords = ["love", "heart", "fire", "dream", "night", "feel", "burn", "soul", "free", "alive"];
    const matchedEmotion = emotionWords.filter((w) => wordSet.has(w));
    if (matchedEmotion.length > 0) {
      reasons.push("contains strong imagery");
    }

    if (reasons.length >= 2) {
      candidates.push({ line_id: line.id, text: trimmed, reasons });
    }
  }

  return candidates;
}
