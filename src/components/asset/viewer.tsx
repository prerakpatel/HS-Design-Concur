"use client";
import { cn } from "@/lib/utils";

export interface SafeArea { top: number; right: number; bottom: number; left: number }
export interface PrintGuides { bleedIn: number; safeIn: number; widthIn: number; heightIn: number }
export interface Pin { n: number; x: number; y: number }

/** Numbered comment bubble, sized for a fingertip. */
export function PinBubble({ n, x, y, size = "md", className }: { n: number | string; x: number; y: number; size?: "md" | "lg"; className?: string }) {
  return <span className={cn("absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-info font-semibold text-white shadow-[0_2px_10px_rgba(0,0,0,.35)] ring-[3px] ring-white", size === "lg" ? "size-11 text-base" : "size-8 text-[13px]", className)} style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>{n}</span>;
}

/**
 * Guide overlay: hatched bands plus a two-tone dashed edge (dark under-stroke, guide colour on top) so the
 * lines read on light, dark and busy artwork alike. Percent geometry, so it works at any rendered size.
 */
export function Guides({ bands, rects, color }: { bands: { top: number; right: number; bottom: number; left: number }; rects: { inset: [number, number]; dotted?: boolean }[]; color: string }) {
  const hatch = { backgroundImage: `repeating-linear-gradient(45deg, ${color}B3 0 4px, ${color}2E 4px 11px)` };
  const p = (v: number) => `${v * 100}%`;
  const line = (x1: string, y1: string, x2: string, y2: string, dotted?: boolean) => (
    <g key={`${x1}${y1}${x2}${y2}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(0,0,0,.7)" strokeWidth={5} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2.5} strokeDasharray={dotted ? "2 6" : "10 7"} strokeLinecap="round" />
    </g>
  );
  return (
    <>
      {bands.top > 0 && <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: p(bands.top), ...hatch }} />}
      {bands.bottom > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: p(bands.bottom), ...hatch }} />}
      {bands.left > 0 && <div className="pointer-events-none absolute left-0" style={{ top: p(bands.top), bottom: p(bands.bottom), width: p(bands.left), ...hatch }} />}
      {bands.right > 0 && <div className="pointer-events-none absolute right-0" style={{ top: p(bands.top), bottom: p(bands.bottom), width: p(bands.right), ...hatch }} />}
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
        {bands.top > 0 && line("0", p(bands.top), "100%", p(bands.top))}
        {bands.bottom > 0 && line("0", p(1 - bands.bottom), "100%", p(1 - bands.bottom))}
        {bands.left > 0 && line(p(bands.left), "0", p(bands.left), "100%")}
        {bands.right > 0 && line(p(1 - bands.right), "0", p(1 - bands.right), "100%")}
        {rects.map((r, i) => { const [iy, ix] = r.inset; return (
          <g key={i}>
            {line(p(ix), p(iy), p(1 - ix), p(iy), r.dotted)}{line(p(ix), p(1 - iy), p(1 - ix), p(1 - iy), r.dotted)}
            {line(p(ix), p(iy), p(ix), p(1 - iy), r.dotted)}{line(p(1 - ix), p(iy), p(1 - ix), p(1 - iy), r.dotted)}
          </g>
        ); })}
      </svg>
    </>
  );
}

/** Bands and rects for a format's safe area or print guides, as fractions of the image. */
export function guideGeometry(safe: SafeArea, print: PrintGuides | null, width: number, height: number) {
  if (print && print.widthIn > 0 && print.heightIn > 0) {
    const bx = print.bleedIn / print.widthIn, by = print.bleedIn / print.heightIn;
    const sx = (print.bleedIn + print.safeIn) / print.widthIn, sy = (print.bleedIn + print.safeIn) / print.heightIn;
    return { bands: { top: by, right: bx, bottom: by, left: bx }, rects: [{ inset: [sy, sx] as [number, number], dotted: true }] };
  }
  const f = (v: number, t: number) => (t > 0 ? v / t : 0);
  return { bands: { top: f(safe.top, height), right: f(safe.right, width), bottom: f(safe.bottom, height), left: f(safe.left, width) }, rects: [] as { inset: [number, number]; dotted?: boolean }[] };
}

/** The artwork, no device frame, sized to fit the viewport, with guides and comment pins. */
export function Viewer({ src, isGif, width, height, safe, print, showGuides, guideColor, caption, pins, onOpen, className }: {
  src: string | null; isGif: boolean; width: number; height: number; safe: SafeArea; print?: PrintGuides | null; showGuides: boolean; guideColor: string; caption: string;
  pins: Pin[]; onOpen?: () => void; className?: string;
}) {
  if (!src) return <div className={cn("flex aspect-[4/5] max-h-[60dvh] w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground", className)}>No design uploaded yet</div>;
  const g = guideGeometry(safe, print ?? null, width, height);
  const hasGuides = g.bands.top + g.bands.right + g.bands.bottom + g.bands.left > 0 || g.rects.length > 0;
  return (
    <div className={cn("relative inline-block max-w-full align-top", className)}>
      <img src={src} alt="" className={cn("block max-h-[62dvh] max-w-full object-contain md:max-h-[max(360px,calc(100dvh-260px))] md:rounded-lg", onOpen && "cursor-zoom-in")} style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }} onClick={onOpen} />
      {isGif && <div className="pointer-events-none absolute inset-0 md:rounded-lg" style={{ backgroundImage: "url(/watermark-tile.png)", backgroundSize: "40%" }} />}
      {showGuides && hasGuides && <Guides bands={g.bands} rects={g.rects} color={guideColor} />}
      {pins.map((p) => <PinBubble key={p.n} n={p.n} x={p.x} y={p.y} />)}
      <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{caption}</span>
    </div>
  );
}
