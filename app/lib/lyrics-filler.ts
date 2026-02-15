import { LyricDoc } from "./lyrics-types";

const FULL_LINE_HUM = /^[\s]*(([hm]+|la|da|na|do+|ba|sha|ooh?|ah)[\s]*)+$/i;
const STUTTER_RE = /\b(\w+)((\s+\1){2,})\b/gi;

function cleanLine(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(STUTTER_RE, "$1");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned;
}

export function removeFiller(doc: LyricDoc): LyricDoc {
  return {
    ...doc,
    lines: doc.lines
      .map((line) => {
        if (FULL_LINE_HUM.test(line.text)) {
          return { id: line.id, text: "" };
        }
        return { id: line.id, text: cleanLine(line.text) };
      })
      .filter((line) => line.text.length > 0),
  };
}
