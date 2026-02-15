import { syllable } from "syllable";

export interface HookCandidate {
  line_id: string;
  text: string;
  reasons: string[];
}

export function detectHookPotential(lines: { id: string; text: string }[]): HookCandidate[] {
  const candidates: HookCandidate[] = [];
  const textCounts = new Map<string, string[]>();

  for (const line of lines) {
    const normalized = line.text.toLowerCase().trim();
    const ids = textCounts.get(normalized) ?? [];
    ids.push(line.id);
    textCounts.set(normalized, ids);
  }

  const seen = new Set<string>();

  for (const line of lines) {
    const reasons: string[] = [];
    const words = line.text.trim().split(/\s+/).filter(Boolean);
    const normalized = line.text.toLowerCase().trim();

    if (words.length === 0) continue;
    if (words.length > 10) continue;
    if (seen.has(normalized)) continue;

    if (words.length >= 3 && words.length <= 6) {
      reasons.push("short and catchy");
    }

    const repeats = textCounts.get(normalized);
    if (repeats && repeats.length > 1) {
      reasons.push("already repeats - natural hook");
    }

    const wordSet = new Set(words.map((w) => w.toLowerCase()));
    if (wordSet.size < words.length && words.length > 2) {
      reasons.push("has internal repetition");
    }

    const endWord = words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "");
    if (syllable(endWord) === 1 && endWord.length >= 2) {
      reasons.push("strong ending");
    }

    const hasRepetition = reasons.some((r) => r.includes("repeats"));
    const threshold = hasRepetition ? 2 : 3;
    if (reasons.length >= threshold) {
      candidates.push({ line_id: line.id, text: line.text, reasons });
      seen.add(normalized);
    }
  }

  return candidates;
}
