"use client";
import { cn } from "@/lib/utils";

export interface SafeArea { top: number; right: number; bottom: number; left: number }
export interface PrintGuides { bleedIn: number; safeIn: number; widthIn: number; heightIn: number }
export interface Pin { id: string; n: number; x: number; y: number }

/** Numbered comment bubble. `draft` is the one being placed. */
export function PinBubble({ n, x, y, draft, active, onClick, className }: { n: number | string; x: number; y: number; draft?: boolean; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} tabIndex={onClick ? 0 : -1} aria-label={`Comment ${n}`}
      className={cn("absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-semibold shadow-[0_2px_10px_rgba(0,0,0,.4)] ring-[3px] transition-transform", draft ? "bg-white text-black ring-white/60" : "bg-info text-white ring-white", active && "scale-110", onClick ? "cursor-pointer" : "pointer-events-none", className)}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>{n}</button>
  );
}

/** Second guide colour: the first rotated a third of the way round the wheel, so bleed and safe never share a hue. */
export function secondColor(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return "#FF00AA";
  const n = parseInt(m[1], 16); const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; let h = 0;
  if (d > 0) { h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
  h = (h + 120) % 360; const S = 1, L = 0.5, a = S * Math.min(L, 1 - L);
  const f = (k: number) => { const x = (k + h / 30) % 12; return Math.round((L - a * Math.max(-1, Math.min(x - 3, Math.min(9 - x, 1)))) * 255).toString(16).padStart(2, "0"); };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

/** Bands and rects for a format's safe area or print guides, as fractions of the image. */
export function guideGeometry(safe: SafeArea, print: PrintGuides | null, width: number, height: number) {
  if (print && print.widthIn > 0 && print.heightIn > 0) {
    const bx = print.bleedIn / print.widthIn, by = print.bleedIn / print.heightIn;
    const sx = (print.bleedIn + print.safeIn) / print.widthIn, sy = (print.bleedIn + print.safeIn) / print.heightIn;
    return { bands: { top: by, right: bx, bottom: by, left: bx }, rects: [{ inset: [sy, sx] as [number, number] }] };
  }
  const f = (v: number, t: number) => (t > 0 ? v / t : 0);
  return { bands: { top: f(safe.top, height), right: f(safe.right, width), bottom: f(safe.bottom, height), left: f(safe.left, width) }, rects: [] as { inset: [number, number] }[] };
}

/**
 * Guide overlay: a soft translucent band and one dashed edge with a thin white halo, so it reads on any artwork
 * without heavy outlines. Print adds a dotted safe-margin rectangle in a second colour.
 */
export function Guides({ bands, rects, color }: { bands: { top: number; right: number; bottom: number; left: number }; rects: { inset: [number, number] }[]; color: string }) {
  const p = (v: number) => `${v * 100}%`;
  const fill = { background: `${color}40` };
  const line = (x1: string, y1: string, x2: string, y2: string, stroke: string, dotted?: boolean) => (
    <g key={`${x1}${y1}${x2}${y2}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,.85)" strokeWidth={4} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={2} strokeDasharray={dotted ? "2 5" : "10 7"} strokeLinecap="round" />
    </g>
  );
  const second = secondColor(color);
  return (
    <>
      {bands.top > 0 && <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: p(bands.top), ...fill }} />}
      {bands.bottom > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: p(bands.bottom), ...fill }} />}
      {bands.left > 0 && <div className="pointer-events-none absolute left-0" style={{ top: p(bands.top), bottom: p(bands.bottom), width: p(bands.left), ...fill }} />}
      {bands.right > 0 && <div className="pointer-events-none absolute right-0" style={{ top: p(bands.top), bottom: p(bands.bottom), width: p(bands.right), ...fill }} />}
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {bands.top > 0 && line("0", p(bands.top), "100%", p(bands.top), color)}
        {bands.bottom > 0 && line("0", p(1 - bands.bottom), "100%", p(1 - bands.bottom), color)}
        {bands.left > 0 && line(p(bands.left), "0", p(bands.left), "100%", color)}
        {bands.right > 0 && line(p(1 - bands.right), "0", p(1 - bands.right), "100%", color)}
        {rects.map((r, i) => { const [iy, ix] = r.inset; return (
          <g key={i}>
            {line(p(ix), p(iy), p(1 - ix), p(iy), second, true)}{line(p(ix), p(1 - iy), p(1 - ix), p(1 - iy), second, true)}
            {line(p(ix), p(iy), p(ix), p(1 - iy), second, true)}{line(p(1 - ix), p(iy), p(1 - ix), p(1 - iy), second, true)}
          </g>
        ); })}
      </svg>
    </>
  );
}
