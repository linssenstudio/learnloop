import JSZip from "jszip";
import type { RawUnit } from "./chunk";

function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export async function parsePptx(buffer: Buffer): Promise<RawUnit[]> {
  const zip = await JSZip.loadAsync(buffer);
  const slideNames = Object.keys(zip.files)
    .map((name) => {
      const m = /^ppt\/slides\/slide(\d+)\.xml$/.exec(name);
      return m ? { name, num: Number(m[1]) } : null;
    })
    .filter((x): x is { name: string; num: number } => x !== null)
    .sort((a, b) => a.num - b.num);

  const units: RawUnit[] = [];
  for (const { name, num } of slideNames) {
    const xml = await zip.files[name].async("string");
    const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => unescapeXml(m[1]).trim()).filter(Boolean);
    if (texts.length === 0) continue;
    const [heading, ...rest] = texts;
    units.push({ page: num, heading: heading || null, text: [heading, ...rest].join("\n") });
  }
  return units;
}
