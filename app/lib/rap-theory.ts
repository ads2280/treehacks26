import { Annotations, CadenceProfile, LyricDoc, RhymeSchemeEntry, StructureSection } from "@/lib/lyrics-types";
import { isStructureTag } from "@/lib/lyrics-utils";

function round(num: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}

function computeVariance(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const sq = values.map((value) => (value - mean) ** 2);
  return sq.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildRhymeScheme(
  doc: LyricDoc,
  annotations: Annotations,
): RhymeSchemeEntry[] {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const endingToScheme = new Map<string, string>();
  let nextLetter = 0;

  return doc.lines
    .filter((line) => line.text.trim() && !isStructureTag(line.text))
    .map((line) => {
      const ending = annotations.rhyme.endings[line.id]
        || annotations.line_metrics[line.id]?.end_word?.toLowerCase()
        || "";

      if (!endingToScheme.has(ending)) {
        const scheme = letters[nextLetter] ?? `X${nextLetter}`;
        endingToScheme.set(ending, scheme);
        nextLetter += 1;
      }

      return {
        lineId: line.id,
        text: line.text,
        scheme: endingToScheme.get(ending) ?? "?",
        endWord: annotations.line_metrics[line.id]?.end_word ?? "",
        syllables: annotations.line_metrics[line.id]?.syllables ?? 0,
      };
    });
}

export function buildCadenceProfile(annotations: Annotations): CadenceProfile {
  const syllables = Object.values(annotations.line_metrics)
    .map((metric) => metric.syllables)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (syllables.length === 0) {
    return {
      avgSyllables: 0,
      minSyllables: 0,
      maxSyllables: 0,
      variance: 0,
      swing: "tight",
      targetRange: [0, 0],
    };
  }

  const avg = syllables.reduce((sum, value) => sum + value, 0) / syllables.length;
  const min = Math.min(...syllables);
  const max = Math.max(...syllables);
  const variance = computeVariance(syllables, avg);

  const swing: CadenceProfile["swing"] =
    variance < 2 ? "tight" : variance < 5 ? "balanced" : "loose";

  const targetLow = Math.max(1, Math.round(avg - 1));
  const targetHigh = Math.max(targetLow, Math.round(avg + 1));

  return {
    avgSyllables: round(avg, 1),
    minSyllables: min,
    maxSyllables: max,
    variance: round(variance, 2),
    swing,
    targetRange: [targetLow, targetHigh],
  };
}

export function buildStructureSections(doc: LyricDoc): StructureSection[] {
  const sections: StructureSection[] = [];
  let current: StructureSection | null = null;
  let sectionIndex = 1;

  for (const line of doc.lines) {
    const text = line.text.trim();
    if (!text) continue;

    if (isStructureTag(text)) {
      if (current) sections.push(current);
      current = {
        tag: text,
        lineIds: [],
        lineCount: 0,
      };
      continue;
    }

    if (!current) {
      current = {
        tag: `[Section ${sectionIndex}]`,
        lineIds: [],
        lineCount: 0,
      };
      sectionIndex += 1;
    }

    current.lineIds.push(line.id);
    current.lineCount += 1;
  }

  if (current) sections.push(current);
  return sections;
}

export function suggestNextSectionTag(sections: StructureSection[]): string {
  if (sections.length === 0) return "[Verse]";

  const lastTag = sections[sections.length - 1]?.tag.toLowerCase() ?? "";
  if (lastTag.includes("intro")) return "[Verse]";
  if (lastTag.includes("verse")) return "[Chorus]";
  if (lastTag.includes("chorus")) return "[Verse 2]";
  if (lastTag.includes("bridge")) return "[Chorus]";
  return "[Chorus]";
}
