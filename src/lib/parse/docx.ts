import mammoth from "mammoth";
import type { RawUnit } from "./chunk";

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function parseDocx(buffer: Buffer): Promise<RawUnit[]> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const marked = html.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, "\u0000$1\u0000");
  const segments = marked.split("\u0000");
  const units: RawUnit[] = [];
  let heading: string | null = null;
  for (let i = 0; i < segments.length; i++) {
    const text = stripTags(segments[i]).trim();
    if (i % 2 === 1) {
      heading = text || null;
      continue;
    }
    if (text) units.push({ page: null, heading, text });
  }
  return units;
}
