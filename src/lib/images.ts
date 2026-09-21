import sharp from "sharp";
import { WATERMARK_TILE_BASE64 } from "./watermark-tile";

export interface Rendition { buf: Buffer; mime: string; ext: string }
export interface Processed { optimised: Rendition; preview: Rendition | null; thumb: Rendition; width: number; height: number }

const PREVIEW_MAX = 1600;
const THUMB_MAX = 480;

/**
 * One-time processing of an upload (PRD §7.2). Nothing is kept at original size:
 * - optimised: visually lossless WebP (q84), PNG only when the image has transparency
 * - preview:   ≤1600px with the tiled DRAFT watermark baked in
 * - thumb:     ≤480px WebP
 * GIFs pass through untouched (the viewer overlays the watermark in CSS instead).
 */
export async function processUpload(input: Buffer, mime: string): Promise<Processed> {
  if (mime === "image/gif") {
    const meta = await sharp(input, { pages: 1 }).metadata();
    const thumb = await sharp(input, { pages: 1 }).resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    return { optimised: { buf: input, mime: "image/gif", ext: "gif" }, preview: null, thumb: { buf: thumb, mime: "image/webp", ext: "webp" }, width: meta.width ?? 0, height: meta.height ?? 0 };
  }
  const base = sharp(input, { failOn: "none", limitInputPixels: 80_000_000 }).rotate();
  const meta = await base.metadata();
  const hasAlpha = Boolean(meta.hasAlpha);
  const optimisedBuf = hasAlpha
    ? await base.clone().png({ compressionLevel: 9, effort: 7 }).toBuffer()
    : await base.clone().webp({ quality: 84, effort: 5 }).toBuffer();

  const previewBase = await base.clone().resize({ width: PREVIEW_MAX, height: PREVIEW_MAX, fit: "inside", withoutEnlargement: true }).toBuffer();
  const pm = await sharp(previewBase).metadata();
  const short = Math.min(pm.width ?? PREVIEW_MAX, pm.height ?? PREVIEW_MAX);
  const tileSize = Math.max(120, Math.min(short - 1, Math.round(short / 2.4)));
  const tile = await sharp(Buffer.from(WATERMARK_TILE_BASE64, "base64")).resize(tileSize, tileSize).png().toBuffer();
  const preview = await sharp(previewBase).composite([{ input: tile, tile: true, blend: "over" }]).webp({ quality: 80 }).toBuffer();
  const thumb = await sharp(previewBase).resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();

  return {
    optimised: { buf: optimisedBuf, mime: hasAlpha ? "image/png" : "image/webp", ext: hasAlpha ? "png" : "webp" },
    preview: { buf: preview, mime: "image/webp", ext: "webp" },
    thumb: { buf: thumb, mime: "image/webp", ext: "webp" },
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}

/** Post-event reference image (PRD §7.2): long edge 800px, WebP q60. */
export async function makeReference(input: Buffer): Promise<Rendition> {
  const buf = await sharp(input, { failOn: "none", pages: 1 }).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 60 }).toBuffer();
  return { buf, mime: "image/webp", ext: "webp" };
}
