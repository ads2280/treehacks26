import { LyricDoc, Annotations, Span } from "./lyrics-types";
import { isStructureTag } from "./lyrics-utils";
import { syllable } from "syllable";

// --- Cliche phrases ---

const CLICHES: string[] = [
  "heart on my sleeve",
  "break my heart",
  "broke my heart",
  "broken heart",
  "tear me apart",
  "tore me apart",
  "falling apart",
  "fall apart",
  "world on fire",
  "set the world on fire",
  "light up the sky",
  "dance in the rain",
  "dancing in the rain",
  "lost in your eyes",
  "lost in the moment",
  "take my breath away",
  "took my breath away",
  "end of the road",
  "bottom of my heart",
  "heart and soul",
  "heart of gold",
  "love is blind",
  "love at first sight",
  "ride or die",
  "stand by my side",
  "through thick and thin",
  "against all odds",
  "at the end of the day",
  "on top of the world",
  "weight of the world",
  "tears fall down",
  "tears run down",
  "hole in my heart",
  "fire in my soul",
  "blood sweat and tears",
  "piece of my heart",
  "meant to be",
  "written in the stars",
  "over and over",
  "again and again",
];

// --- Filler words ---

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

// --- Span detection ---

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findPhraseSpans(
  lineId: string,
  text: string,
  phrase: string,
  type: Span["type"],
  label: string,
): Span[] {
  const spans: Span[] = [];
  const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`, "gi");
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    spans.push({
      line_id: lineId,
      start: m.index,
      end: m.index + m[0].length,
      type,
      label,
    });
  }
  return spans;
}

function detectSpans(doc: LyricDoc): Span[] {
  const spans: Span[] = [];
  for (const line of doc.lines) {
    if (isStructureTag(line.text)) continue;
    for (const phrase of CLICHES) {
      spans.push(...findPhraseSpans(line.id, line.text, phrase, "cliche", `cliche: "${phrase}"`));
    }
    for (const phrase of FILLERS) {
      spans.push(...findPhraseSpans(line.id, line.text, phrase, "filler", `filler: "${phrase}"`));
    }
  }
  return spans;
}

// --- Repetition detection ---

const STOP_WORDS = new Set([
  "i", "me", "my", "mine", "myself",
  "you", "your", "yours", "yourself",
  "he", "him", "his", "she", "her", "hers",
  "we", "us", "our", "ours", "they", "them", "their",
  "it", "its",
  "a", "an", "the",
  "and", "or", "but", "so", "if", "in", "on", "at", "to", "for",
  "of", "with", "from", "by", "up", "out", "is", "am", "are",
  "was", "were", "be", "been", "being",
  "do", "does", "did", "have", "has", "had",
  "will", "would", "could", "should", "can", "may", "might",
  "not", "no", "nor",
  "that", "this", "than", "then", "when", "what", "who", "how",
  "all", "just", "like", "so", "as",
]);

function normalize(word: string): string {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

function tokenize(text: string): string[] {
  return text.split(/\s+/).map(normalize).filter((w) => w.length > 0);
}

function detectRepetition(doc: LyricDoc): {
  unigrams: { token: string; count: number }[];
  phrases: { text: string; count: number }[];
  spans: Span[];
} {
  const unigramCounts = new Map<string, number>();
  const phraseCounts = new Map<string, number>();
  const tokenLocations = new Map<string, { lineId: string; start: number; end: number }[]>();

  for (const line of doc.lines) {
    if (isStructureTag(line.text)) continue;
    const tokens = tokenize(line.text);

    for (const token of tokens) {
      if (STOP_WORDS.has(token) || token.length <= 2) continue;
      unigramCounts.set(token, (unigramCounts.get(token) ?? 0) + 1);

      const pattern = new RegExp(`\\b${escapeRegex(token)}\\b`, "gi");
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(line.text)) !== null) {
        if (!tokenLocations.has(token)) tokenLocations.set(token, []);
        tokenLocations.get(token)!.push({
          lineId: line.id,
          start: m.index,
          end: m.index + m[0].length,
        });
        break;
      }
    }

    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const phrase = tokens.slice(i, i + n).join(" ");
        const meaningful = tokens.slice(i, i + n).some((t) => !STOP_WORDS.has(t) && t.length > 2);
        if (!meaningful) continue;
        phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
      }
    }
  }

  const unigrams = [...unigramCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([token, count]) => ({ token, count }));

  const phrases = [...phraseCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([text, count]) => ({ text, count }));

  const repeatedTokens = new Set(unigrams.map((u) => u.token));
  const spans: Span[] = [];
  for (const [token, locations] of tokenLocations) {
    if (!repeatedTokens.has(token)) continue;
    const count = unigramCounts.get(token)!;
    for (const loc of locations) {
      spans.push({
        line_id: loc.lineId,
        start: loc.start,
        end: loc.end,
        type: "repetition",
        label: `"${token}" appears ${count}x`,
      });
    }
  }

  return { unigrams, phrases, spans };
}

// --- Rhyme clustering ---

const SUFFIX_NORMALIZATIONS: [RegExp, string][] = [
  [/ight$/, "ite"],
  [/ould$/, "ood"],
  [/ough$/, "off"],
  [/tion$/, "shun"],
  [/sion$/, "shun"],
  [/ck$/, "k"],
  [/que$/, "k"],
  [/ph$/, "f"],
  [/ble$/, "bul"],
  [/dle$/, "dul"],
  [/tle$/, "tul"],
];

function rhymeKey(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length === 0) return "";

  for (const [pattern, replacement] of SUFFIX_NORMALIZATIONS) {
    if (pattern.test(w)) {
      w = w.replace(pattern, replacement);
      break;
    }
  }

  return w.slice(-3);
}

function detectRhyme(doc: LyricDoc, lineMetrics: Annotations["line_metrics"]): {
  endings: Record<string, string>;
  clusters: Record<string, string[]>;
} {
  const endings: Record<string, string> = {};
  const keyToLineIds = new Map<string, string[]>();

  for (const line of doc.lines) {
    if (isStructureTag(line.text)) continue;
    const endWord = lineMetrics[line.id]?.end_word ?? "";
    if (!endWord) continue;

    const key = rhymeKey(endWord);
    if (!key) continue;

    endings[line.id] = key;

    if (!keyToLineIds.has(key)) keyToLineIds.set(key, []);
    keyToLineIds.get(key)!.push(line.id);
  }

  const clusters: Record<string, string[]> = {};
  for (const [key, lineIds] of keyToLineIds) {
    if (lineIds.length >= 2) {
      clusters[key] = lineIds;
    }
  }

  return { endings, clusters };
}

// --- Main analysis ---

export function analyze(doc: LyricDoc): Annotations {
  const line_metrics: Annotations["line_metrics"] = {};
  for (const line of doc.lines) {
    if (isStructureTag(line.text)) continue;
    const words = line.text.trim().split(/\s+/).filter(Boolean);
    line_metrics[line.id] = {
      syllables: syllable(line.text),
      words: words.length,
      end_word: words[words.length - 1] ?? "",
    };
  }

  const clicheFillerSpans = detectSpans(doc);
  const repetition = detectRepetition(doc);
  const rhyme = detectRhyme(doc, line_metrics);

  return {
    line_metrics,
    spans: [...clicheFillerSpans, ...repetition.spans],
    repetition: {
      unigrams: repetition.unigrams,
      phrases: repetition.phrases,
    },
    rhyme,
  };
}

/** Wrapper that filters structure tags before analysis. */
export function analyzeWithSections(doc: LyricDoc): Annotations {
  return analyze(doc);
}
