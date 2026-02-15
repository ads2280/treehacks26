export interface LyricDoc {
  lines: { id: string; text: string }[];
  meta?: { style?: string; notes?: string };
}

export interface LineMetrics {
  syllables: number;
  words: number;
  end_word: string;
}

export interface Span {
  line_id: string;
  start: number;
  end: number;
  type: "cliche" | "filler" | "vague" | "repetition";
  label: string;
}

export interface Annotations {
  line_metrics: Record<string, LineMetrics>;
  spans: Span[];
  repetition: {
    unigrams: { token: string; count: number }[];
    phrases: { text: string; count: number }[];
  };
  rhyme: {
    endings: Record<string, string>;
    clusters: Record<string, string[]>;
  };
}

export type EditOp =
  | { type: "replace_span"; line_id: string; start: number; end: number; text: string }
  | { type: "replace_line"; line_id: string; text: string }
  | { type: "delete_span"; line_id: string; start: number; end: number }
  | { type: "insert_line_after"; line_id: string; new_line: { id: string; text: string } }
  | { type: "duplicate_line"; line_id: string; target: "after"; after_line_id: string };

export interface Suggestion {
  id: string;
  title: string;
  ops: EditOp[];
  preview: LyricDoc;
  notes?: string[];
}

export type ProduceOperation = "tighten" | "punch" | "decliche" | "hookify";
