import type { RawUnit } from "./chunk";

interface PdfTextItem {
  str: string;
  hasEOL?: boolean;
}

interface PdfPageLike {
  getTextContent(): Promise<{ items: PdfTextItem[] }>;
}

interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}

export async function parsePdf(buffer: Buffer): Promise<RawUnit[]> {
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    getDocument(opts: Record<string, unknown>): { promise: Promise<PdfDocLike>; destroy(): Promise<void> };
  };
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  try {
    const units: RawUnit[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      units.push({ page: p, heading: null, text: text.trim() });
    }
    return units;
  } finally {
    await loadingTask.destroy();
  }
}
