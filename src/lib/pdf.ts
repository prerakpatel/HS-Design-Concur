import { createCanvas } from "@napi-rs/canvas";

export const PDF_MAX_PAGES = 2;   // page 1 = front, page 2 = back (PRD §7.1)
export const PDF_DPI = 150;       // raster resolution for print previews (PRD §7.2)

/**
 * Rasterise a print PDF to one JPEG per page at 150 dpi. Runs in Node with pdf.js and a headless canvas.
 * The PDF itself is not kept (PRD: print-ready originals stay with the designer).
 */
export async function rasterisePdf(input: Buffer): Promise<Buffer[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(input), useSystemFonts: true, disableFontFace: true });
  const doc = await task.promise;
  try {
    if (doc.numPages > PDF_MAX_PAGES) throw new Error(`A print PDF can have at most ${PDF_MAX_PAGES} pages (front and back). This one has ${doc.numPages}.`);
    const pages: Buffer[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: PDF_DPI / 72 });
      const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport, canvas: canvas as unknown as HTMLCanvasElement }).promise;
      pages.push(canvas.toBuffer("image/jpeg", 95));
    }
    return pages;
  } finally { await task.destroy(); }
}
