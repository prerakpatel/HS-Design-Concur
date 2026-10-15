import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";

import { pdfScale, PDF_DPI } from "@/lib/pdf-scale";

export { PDF_DPI };
export const PDF_MAX_PAGES = 2;   // page 1 = front, page 2 = back (PRD §7.1)

/**
 * Rasterise a print PDF to one JPEG per page at 150 dpi. Runs in Node with pdf.js and a headless canvas.
 * The PDF itself is not kept (PRD: print-ready originals stay with the designer).
 */
export async function rasterisePdf(input: Buffer): Promise<Buffer[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdf.js loads its decoders and font data from files next to it: JPEG 2000 pictures (common in print PDFs) need the
  // OpenJPEG wasm, unembedded standard fonts need standard_fonts. Listed in next.config.ts so they ship with the function.
  const dir = (sub: string) => path.join(process.cwd(), "node_modules/pdfjs-dist", sub) + path.sep;
  const task = pdfjs.getDocument({ data: new Uint8Array(input), useSystemFonts: false, disableFontFace: true, wasmUrl: dir("wasm"), standardFontDataUrl: dir("standard_fonts"), cMapUrl: dir("cmaps"), cMapPacked: true, iccUrl: dir("iccs") });
  const doc = await task.promise;
  try {
    if (doc.numPages > PDF_MAX_PAGES) throw new Error(`A print PDF can have at most ${PDF_MAX_PAGES} pages (front and back). This one has ${doc.numPages}.`);
    const pages: Buffer[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const paper = page.getViewport({ scale: 1 });
      const scale = pdfScale(paper.width, paper.height);
      if (scale === null) throw new Error("This PDF has a page with no readable size.");
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas: canvas as unknown as HTMLCanvasElement }).promise;
      pages.push(canvas.toBuffer("image/jpeg", 95));
    }
    return pages;
  } finally { await task.destroy(); }
}
