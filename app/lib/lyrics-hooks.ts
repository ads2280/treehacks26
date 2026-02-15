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
  return wordCount >= 3 && wordCount <= 9;
}

function hasMemorableLanguage(text: string): boolean {
  const patterns = [
    /\b(i|you|we)\b/i,
    /\b(tonight|forever|always|never|again)\b/i,
    /!|\?/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

export function detectHookPotential(lines: LyricLine[]): HookCandidate[] {
  const candidates: HookCandidate[] = [];
  const frequency = new Map<string, number>();

  const normalized = lines
    .filter((line) => line.text.trim() && !isStructureTag(line.text))
    .map((line) => ({
      ...line,
      normalized: normalizeLine(line.text),
    }));

  for (const line of normalized) {
    if (!line.normalized) continue;
    frequency.set(line.normalized, (frequency.get(line.normalized) ?? 0) + 1);
  }

  for (const line of normalized) {
    const reasons: string[] = [];

    if (!isStrongHookLine(line.text)) continue;

    const repeats = frequency.get(line.normalized) ?? 0;
    if (repeats >= 2) reasons.push("already repeated naturally");
    if (hasMemorableLanguage(line.text)) reasons.push("strong emotional wording");

    const vowelDensity = (line.normalized.match(/[aeiou]/g) ?? []).length;
    if (vowelDensity >= 5) reasons.push("vocal-friendly cadence");

    if (reasons.length === 0) continue;

    candidates.push({
      line_id: line.id,
      text: line.text.trim(),
      reasons,
    });
  }

  return candidates.slice(0, 5);
}
