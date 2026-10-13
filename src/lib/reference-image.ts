import sharp from "sharp";
import type { Rendition } from "@/lib/images";

/**
 * Post-event reference image (PRD §7.2): long edge 800px, WebP q60.
 * Kept apart from images.ts so the daily job ships sharp alone, not the watermark canvas (Vercel Functions Storage).
 */
export async function makeReference(input: Buffer): Promise<Rendition> {
  const buf = await sharp(input, { failOn: "none", pages: 1 }).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 60 }).toBuffer();
  return { buf, mime: "image/webp", ext: "webp" };
}
