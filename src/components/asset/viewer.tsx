"use client";
import { cn } from "@/lib/utils";

export interface SafeArea { top: number; right: number; bottom: number; left: number }
export interface PrintGuides { bleedIn: number; safeIn: number; widthIn: number; heightIn: number }
export interface Pin { n: number; x: number; y: number }

/**
 * The artwork, no device frame, sized to fit the viewport. Safe bands and print guides use a colour
 * picked from the artwork so they never blend in; comment pins are numbered bubbles.
 */
export function Viewer({ src, isGif, width, height, safe, print, showGuides, guideColor, caption, pins, onPick, picked, onOpen, className }: {
  src: string | null; isGif: boolean; width: number; height: number; safe: SafeArea; print?: PrintGuides | null; showGuides: boolean; guideColor: string; caption: string;
  pins: Pin[]; onPick?: (p: { x: number; y: number }) => void; picked?: { x: number; y: number } | null; onOpen?: () => void; className?: string;
}) {
  const pct = (v: number, total: number) => (total > 0 ? `${(v / total) * 100}%` : "0%");
  const hasSafe = safe.top + safe.right + safe.bottom + safe.left > 0;
  const fill = guideColor + "38"; // ~22% alpha
  const line = `2px dashed ${guideColor}`;
  if (!src) return <div className={cn("flex aspect-[4/5] max-h-[60dvh] w-full items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground", className)}>No design uploaded yet</div>;
  return (
    <div className={cn("relative inline-block max-w-full align-top", className)}>
      <img src={src} alt="" className={cn("block max-h-[62dvh] max-w-full object-contain md:max-h-[max(360px,calc(100dvh-330px))] md:rounded-lg md:shadow-md", onPick ? "cursor-crosshair" : onOpen ? "cursor-zoom-in" : "")} style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }}
        onClick={(e) => { if (onPick) { const r = e.currentTarget.getBoundingClientRect(); onPick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); } else onOpen?.(); }} />
      {isGif && <div className="pointer-events-none absolute inset-0 rounded-lg" style={{ backgroundImage: "url(/watermark-tile.png)", backgroundSize: "40%" }} />}
      {showGuides && hasSafe && (
        <>
          {safe.top > 0 && <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: pct(safe.top, height), background: fill, borderBottom: line }} />}
          {safe.bottom > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: pct(safe.bottom, height), background: fill, borderTop: line }} />}
          {safe.left > 0 && <div className="pointer-events-none absolute inset-y-0 left-0" style={{ width: pct(safe.left, width), background: fill, borderRight: line }} />}
          {safe.right > 0 && <div className="pointer-events-none absolute inset-y-0 right-0" style={{ width: pct(safe.right, width), background: fill, borderLeft: line }} />}
        </>
      )}
      {showGuides && print && print.widthIn > 0 && print.heightIn > 0 && (
        <>
          {/* Bleed band: everything outside the dashed line is trimmed. Safe margin: keep text inside the dotted line. */}
          <div className="pointer-events-none absolute inset-0" style={{ boxShadow: `inset 0 0 0 ${pct(print.bleedIn, print.widthIn)} ${fill}` }} />
          <div className="pointer-events-none absolute" style={{ inset: `${(print.bleedIn / print.heightIn) * 100}% ${(print.bleedIn / print.widthIn) * 100}%`, border: line }} />
          <div className="pointer-events-none absolute" style={{ inset: `${((print.bleedIn + print.safeIn) / print.heightIn) * 100}% ${((print.bleedIn + print.safeIn) / print.widthIn) * 100}%`, border: `2px dotted ${guideColor}`, opacity: 0.85 }} />
        </>
      )}
      {pins.map((p) => <span key={p.n} className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-info text-[11px] font-semibold text-white shadow-md ring-2 ring-white" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>{p.n}</span>)}
      {picked && <span className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-info/70 shadow-md" style={{ left: `${picked.x * 100}%`, top: `${picked.y * 100}%` }} />}
      <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{caption}</span>
    </div>
  );
}
