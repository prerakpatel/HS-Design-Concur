import sharp from "sharp";
import path from "node:path";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

export interface Rendition { buf: Buffer; mime: string; ext: string }
export interface Processed { optimised: Rendition; preview: Rendition | null; thumb: Rendition; width: number; height: number }

const PREVIEW_MAX = 1600;
const THUMB_MAX = 480;

/**
 * One-time processing of an upload (PRD §7.2). Nothing is kept at original size:
 * - optimised: the file people download: JPEG q85 (accepted everywhere), PNG only when the image has transparency
 * - preview:   ≤1600px with one large, faint DRAFT mark baked in across the diagonal
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
    : await base.clone().jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  const previewBase = await base.clone().resize({ width: PREVIEW_MAX, height: PREVIEW_MAX, fit: "inside", withoutEnlargement: true }).toBuffer();
  const preview = await stampDraft(previewBase);
  const thumb = await sharp(previewBase).resize({ width: THUMB_MAX, height: THUMB_MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();

  return {
    optimised: { buf: optimisedBuf, mime: hasAlpha ? "image/png" : "image/jpeg", ext: hasAlpha ? "png" : "jpg" },
    preview: { buf: preview, mime: "image/webp", ext: "webp" },
    thumb: { buf: thumb, mime: "image/webp", ext: "webp" },
    width: meta.width ?? 0,
    height: meta.height ?? 0,
  };
}

async function stampDraft(previewBase: Buffer): Promise<Buffer> {
  const pm = await sharp(previewBase).metadata();
  return sharp(previewBase).composite([{ input: await draftMark(pm.width ?? PREVIEW_MAX, pm.height ?? PREVIEW_MAX), top: 0, left: 0, blend: "over" }]).webp({ quality: 80 }).toBuffer();
}

/** The watermarked preview for an already-optimised file (used to re-stamp previews made by an older mark). */
export async function makePreview(optimised: Buffer): Promise<Rendition> {
  const previewBase = await sharp(optimised, { failOn: "none", limitInputPixels: 80_000_000 }).resize({ width: PREVIEW_MAX, height: PREVIEW_MAX, fit: "inside", withoutEnlargement: true }).toBuffer();
  return { buf: await stampDraft(previewBase), mime: "image/webp", ext: "webp" };
}

/** Post-event reference image (PRD §7.2): long edge 800px, WebP q60. */
export async function makeReference(input: Buffer): Promise<Rendition> {
  const buf = await sharp(input, { failOn: "none", pages: 1 }).resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true }).webp({ quality: 60 }).toBuffer();
  return { buf, mime: "image/webp", ext: "webp" };
}

/**
 * A guide colour that will not clash with the artwork: the complement of the image's dominant hue at full
 * saturation (neon), falling back to cyan for near-grey images. Used for safe-area lines and fills.
 */
export async function guideColor(input: Buffer): Promise<string> {
  try {
    const { dominant } = await sharp(input, { failOn: "none", pages: 1 }).stats();
    const r = dominant.r / 255, g = dominant.g / 255, b = dominant.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d > 0) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    const sat = max === 0 ? 0 : d / max;
    const hue = sat < 0.15 ? 190 : (h + 180) % 360;
    return hslToHex(hue, 100, 52);
  } catch { return "#00E5FF"; }
}

function hslToHex(h: number, s: number, l: number) {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}

const MARK_ALPHA = 0.22;
let fontReady = false;
/** One giant "DRAFT" across the diagonal: white fill with a dark edge so it reads on light and dark art, faded to 22%. */
async function draftMark(w: number, h: number): Promise<Buffer> {
  if (!fontReady) { GlobalFonts.registerFromPath(path.join(process.cwd(), "src/assets/Inter-ExtraBold.ttf"), "DCMark"); fontReady = true; }
  const c = createCanvas(w, h); const ctx = c.getContext("2d");
  let size = Math.round(Math.min(w, h) * 0.3);
  ctx.font = `800 ${size}px DCMark`;
  size = Math.round(size * ((Math.hypot(w, h) * 0.6) / Math.max(1, ctx.measureText("DRAFT").width)));
  ctx.font = `800 ${size}px DCMark`;
  ctx.translate(w / 2, h / 2); ctx.rotate(-Math.atan2(h, w) * 0.85);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.05); ctx.strokeStyle = "#111"; ctx.strokeText("DRAFT", 0, 0);
  ctx.fillStyle = "#fff"; ctx.fillText("DRAFT", 0, 0);
  // Drawn opaque, then the whole mark is faded so the edge never shows through the fill.
  return sharp(c.toBuffer("image/png")).ensureAlpha().linear([1, 1, 1, MARK_ALPHA], [0, 0, 0, 0]).png().toBuffer();
}
