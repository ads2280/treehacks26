"use client";

import { LyricDoc, Suggestion, EditOp } from "@/lib/lyrics-types";

interface Props {
  suggestion: Suggestion;
  doc: LyricDoc;
  onAccept: (s: Suggestion) => void;
  onDismiss: (s: Suggestion) => void;
}

function ReplaceLineDiff({ op, doc }: { op: EditOp & { type: "replace_line" }; doc: LyricDoc }) {
  const original = doc.lines.find((l) => l.id === op.line_id);
  if (!original || original.text === op.text) return null;

  return (
    <div className="my-1 text-[11px] font-mono">
      <div className="text-red-400/50 line-through">{original.text}</div>
      <div className="text-green-400">{op.text}</div>
    </div>
  );
}

function OpNote({ op }: { op: EditOp }) {
  const desc =
    op.type === "replace_span"
      ? `Replace span -> "${op.text}"`
      : op.type === "delete_span"
        ? "Delete span"
        : op.type === "insert_line_after"
          ? `Insert -> "${op.new_line.text}"`
          : op.type === "duplicate_line"
            ? "Duplicate line"
            : String(op.type);
  return (
    <div className="text-[10px] text-white/30 my-0.5 font-mono">{desc}</div>
  );
}

export function SuggestionCard({ suggestion, doc, onAccept, onDismiss }: Props) {
  return (
    <div className="border-b border-white/10 px-3 py-2.5 hover:bg-white/[0.02] transition-colors">
      <div className="text-[11px] font-semibold text-white/80 mb-1.5 uppercase tracking-wider">
        {suggestion.title}
      </div>

      {suggestion.ops.map((op, i) =>
        op.type === "replace_line" ? (
          <ReplaceLineDiff key={i} op={op} doc={doc} />
        ) : (
          <OpNote key={i} op={op} />
        ),
      )}

      {suggestion.notes?.map((n, i) => (
        <p key={i} className="text-[10px] text-white/30 my-0.5">
          {n}
        </p>
      ))}

      <div className="mt-2 flex gap-1.5">
        <button
          onClick={() => onAccept(suggestion)}
          className="px-2.5 py-1 text-[10px] font-semibold rounded bg-[#c4f567] text-black hover:bg-[#b8e557] uppercase tracking-wider transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => onDismiss(suggestion)}
          className="px-2.5 py-1 text-[10px] rounded border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 uppercase tracking-wider transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
