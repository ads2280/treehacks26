import { Annotations, LyricDoc } from "@/lib/lyrics-types";
import { isStructureTag } from "@/lib/lyrics-utils";

export function isValidLyricDoc(doc: unknown): doc is LyricDoc {
  if (!doc || typeof doc !== "object") return false;

  const maybeLines = (doc as { lines?: unknown }).lines;
  if (!Array.isArray(maybeLines)) return false;

  return maybeLines.every((line) => (
    line
    && typeof line === "object"
    && typeof (line as { id?: unknown }).id === "string"
    && typeof (line as { text?: unknown }).text === "string"
  ));
}

export function parseFirstJsonObject<T>(raw: string): T | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

export function getLastMeaningfulWord(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);

  return words[words.length - 1] ?? "";
}

export function getNonStructureLines(doc: LyricDoc): Array<{ id: string; text: string }> {
  return doc.lines.filter((line) => line.text.trim() && !isStructureTag(line.text));
}

export function getRecentContext(
  doc: LyricDoc,
  maxLines = 8,
): Array<{ id: string; text: string }> {
  const lines = getNonStructureLines(doc);
  return lines.slice(Math.max(0, lines.length - maxLines));
}

export function getRhymeHintWords(
  annotations: Annotations,
  maxWords = 8,
): string[] {
  const words = new Set<string>();

  for (const metrics of Object.values(annotations.line_metrics)) {
    const endWord = normalizeWord(metrics.end_word);
    if (endWord) words.add(endWord);
    if (words.size >= maxWords) break;
  }

  return Array.from(words);
}

export function sanitizeCompletion(
  rawCompletion: string,
  prefix: string,
  maxLength = 120,
): string {
  let next = rawCompletion.replace(/\r?\n/g, " ").trim();
  if (!next) return "";

  const normalizedPrefix = prefix.trim();
  if (normalizedPrefix) {
    const lowerPrefix = normalizedPrefix.toLowerCase();
    const lowerNext = next.toLowerCase();

    if (lowerNext.startsWith(lowerPrefix)) {
      next = next.slice(normalizedPrefix.length).trimStart();
    }
  }

  if (next.length > maxLength) {
    next = next.slice(0, maxLength).trimEnd();
  }

  return next;
}
