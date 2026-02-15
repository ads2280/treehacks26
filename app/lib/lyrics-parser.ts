import { isStructureTag } from "@/lib/lyrics-utils";

export interface LyricsSection {
  tag: string;
  lines: string[];
  scenePrompt?: string;
  backgroundUrl?: string;
  backgroundAssetId?: string;
}

const MAX_SECTIONS = 10;

/**
 * Parse lyrics text into sections based on structure tags [Verse], [Chorus], etc.
 * Lines before the first tag go into an "Intro" section.
 * Cap at 10 scenes max; merge short adjacent sections if >10.
 */
export function parseLyricsIntoSections(text: string): LyricsSection[] {
  const rawLines = text.split("\n");
  const sections: LyricsSection[] = [];
  let currentSection: LyricsSection | null = null;

  for (const line of rawLines) {
    if (isStructureTag(line)) {
      // Extract tag name from brackets: "[Verse 1]" -> "Verse 1"
      const match = line.match(/\[\s*(.+?)\s*\]/);
      const tag = match ? match[1] : line.trim();
      currentSection = { tag, lines: [] };
      sections.push(currentSection);
    } else {
      if (!currentSection) {
        // Lines before the first tag go into an "Intro" section
        currentSection = { tag: "Intro", lines: [] };
        sections.push(currentSection);
      }
      const trimmed = line.trim();
      if (trimmed.length > 0) {
        currentSection.lines.push(trimmed);
      }
    }
  }

  // Filter out empty sections (no lines)
  let filtered = sections.filter((s) => s.lines.length > 0);

  // Merge shortest adjacent sections until <= MAX_SECTIONS
  while (filtered.length > MAX_SECTIONS) {
    // Find the shortest section by line count
    let minLen = Infinity;
    let minIdx = 0;
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].lines.length < minLen) {
        minLen = filtered[i].lines.length;
        minIdx = i;
      }
    }

    // Decide merge direction: prefer merging with the shorter neighbor
    if (minIdx === 0) {
      // Merge into next
      filtered[1].lines = [...filtered[0].lines, ...filtered[1].lines];
      filtered.splice(0, 1);
    } else if (minIdx === filtered.length - 1) {
      // Merge into previous
      filtered[minIdx - 1].lines = [
        ...filtered[minIdx - 1].lines,
        ...filtered[minIdx].lines,
      ];
      filtered.splice(minIdx, 1);
    } else {
      // Merge with whichever neighbor is shorter
      const prevLen = filtered[minIdx - 1].lines.length;
      const nextLen = filtered[minIdx + 1].lines.length;
      if (prevLen <= nextLen) {
        filtered[minIdx - 1].lines = [
          ...filtered[minIdx - 1].lines,
          ...filtered[minIdx].lines,
        ];
      } else {
        filtered[minIdx + 1].lines = [
          ...filtered[minIdx].lines,
          ...filtered[minIdx + 1].lines,
        ];
      }
      filtered.splice(minIdx, 1);
    }
  }

  return filtered;
}

/**
 * Generate time-based sections for instrumentals (no lyrics).
 * Creates ~30s sections from the total duration.
 */
export function generateInstrumentalSections(
  durationSeconds: number,
  vibePrompt: string,
  tags: string
): LyricsSection[] {
  const numSections = Math.min(Math.ceil(durationSeconds / 30), MAX_SECTIONS);
  const sections: LyricsSection[] = [];

  for (let i = 0; i < numSections; i++) {
    sections.push({
      tag: `Part ${i + 1}`,
      lines: [
        `Instrumental section ${i + 1} of ${numSections}`,
        `Vibe: ${vibePrompt}`,
        `Style: ${tags}`,
      ],
    });
  }

  return sections;
}
