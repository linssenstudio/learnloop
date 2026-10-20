export interface RawUnit {
  page: number | null;
  heading: string | null;
  text: string;
}

export interface ParsedChunk {
  page: number | null;
  heading: string | null;
  text: string;
}

const TARGET_MIN = 300;
const TARGET_MAX = 800;

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。！？；.!?;])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function splitLong(text: string): string[] {
  const sentences = splitSentences(text);
  if (sentences.length <= 1 && text.length > TARGET_MAX) {
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += TARGET_MAX) parts.push(text.slice(i, i + TARGET_MAX));
    return parts;
  }
  return sentences;
}

export function chunkUnits(units: RawUnit[]): ParsedChunk[] {
  const chunks: ParsedChunk[] = [];
  let buffer = "";
  let bufferPage: number | null = null;
  let bufferHeading: string | null = null;

  const flush = () => {
    const text = buffer.trim();
    if (text) chunks.push({ page: bufferPage, heading: bufferHeading, text });
    buffer = "";
    bufferPage = null;
    bufferHeading = null;
  };

  for (const unit of units) {
    if (buffer && bufferPage !== unit.page) flush();
    const paragraphs = unit.text
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const para of paragraphs) {
      for (const piece of splitLong(para)) {
        if (buffer.length >= TARGET_MIN && buffer.length + piece.length > TARGET_MAX) flush();
        if (!buffer) {
          bufferPage = unit.page;
          bufferHeading = unit.heading;
        }
        buffer += (buffer ? "\n" : "") + piece;
        if (buffer.length > TARGET_MAX) flush();
      }
    }
    if (buffer.length >= TARGET_MIN) flush();
  }
  flush();

  const merged: ParsedChunk[] = [];
  for (const chunk of chunks) {
    const prev = merged[merged.length - 1];
    if (prev && chunk.text.length < TARGET_MIN && prev.text.length + chunk.text.length <= TARGET_MAX && prev.page === chunk.page) {
      prev.text += "\n" + chunk.text;
      if (!prev.heading && chunk.heading) prev.heading = chunk.heading;
    } else {
      merged.push({ ...chunk });
    }
  }
  return merged;
}
