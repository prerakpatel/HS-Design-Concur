export const PDF_DPI = 150;                 // raster resolution for print previews (PRD §7.2)
export const MAX_RASTER_PIXELS = 50_000_000; // a page is drawn at most this big (about 200 MB of canvas), however large its paper size
export const MAX_RASTER_SIDE = 16_000;       // and no side longer than this

/**
 * How much to scale a PDF page (its size in points, 72 to the inch) when drawing it: 150 dpi, or smaller for a page
 * so large that 150 dpi would use more memory than a request has (a banner, or a PDF that claims a huge paper size).
 * Returns null for a page that has no usable size.
 */
export function pdfScale(widthPt: number, heightPt: number): number | null {
  if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt) || widthPt < 1 || heightPt < 1) return null;
  const wanted = PDF_DPI / 72;
  const byPixels = Math.sqrt(MAX_RASTER_PIXELS / (widthPt * heightPt));
  const bySide = MAX_RASTER_SIDE / Math.max(widthPt, heightPt);
  return Math.min(wanted, byPixels, bySide);
}
