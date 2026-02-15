import { syllable } from "syllable";
import { isStructureTag } from "@/lib/lyrics-utils";

interface LyricLine {
  id: string;
  text: string;
}

export interface HookCandidate {
  line_id: string;
  text: string;
  reasons: string[];
}

function normalizeLine(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s']/g, "");
}

function isStrongHookLine(text: string): boolean {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const syllables = syllable(text);
  return wordCount >= 3 && wordCount <= 10 && syllables >= 4 && syllables <= 12;
}

function hasMemorableLanguage(text: string): boolean {
  const patterns = [
    /\b(i|you|we)\b/i,
    /\b(tonight|forever|always|never|again|alive|free|fire|heart)\b/i,
    /!|\?/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function hasInternalEcho(text: string): boolean {
  const cleaned = normalizeLine(text);
  if (!cleaned) return false;
  return /(.+)\b.*\1/i.test(cleaned) && cleaned.length > 3;
}

export function detectHookPotential(lines: LyricLine[]): HookCandidate[] {
  const candidates: HookCandidate[] = [];
  const frequency = new Map<string, number>();

  const normalizedLines = lines
    .filter((line) => line.text.trim() && !isStructureTag(line.text))
    .map((line) => ({
      ...line,
      normalized: normalizeLine(line.text),
    }));

  for (const line of normalizedLines) {
    if (!line.normalized) continue;
    frequency.set(line.normalized, (frequency.get(line.normalized) ?? 0) + 1);
  }

  for (const line of normalizedLines) {
    if (!isStrongHookLine(line.text)) continue;

    const reasons: string[] = [];
    const repeats = frequency.get(line.normalized) ?? 0;
    if (repeats >= 2) reasons.push("already repeated naturally");
    if (hasMemorableLanguage(line.text)) reasons.push("strong emotional wording");
    if (hasInternalEcho(line.text)) reasons.push("has internal repetition");

    const words = line.text.trim().split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")));
    const imageryWords = ["night", "fire", "dream", "heart", "storm", "city", "light", "shadow"];
    if (imageryWords.some((word) => uniqueWords.has(word))) {
      reasons.push("contains vivid imagery");
    }

    if (reasons.length < 2) continue;

    candidates.push({
      line_id: line.id,
      text: line.text.trim(),
      reasons,
    });
  }

  return candidates.slice(0, 5);
}
