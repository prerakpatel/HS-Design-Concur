"use client";
import { cn } from "@/lib/utils";

export interface SafeArea { top: number; right: number; bottom: number; left: number }
export interface PrintGuides { bleedIn: number; safeIn: number; widthIn: number; heightIn: number }
export interface Pin { id: string; n: number; x: number; y: number }

export const CUT = "#F0447C";          // cut / trim line
export const SAFE = "rgba(122,226,178,.45)"; // safe zone band

/** Numbered comment bubble. `draft` is the one being placed. */
export function PinBubble({ n, x, y, draft, active, onClick, className }: { n: number | string; x: number; y: number; draft?: boolean; active?: boolean; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} tabIndex={onClick ? 0 : -1} aria-label={`Comment ${n}`}
      className={cn("absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-semibold shadow-[0_2px_10px_rgba(0,0,0,.35)] ring-[3px] transition-transform", draft ? "bg-white text-black ring-white/60" : "bg-info text-white ring-white", active && "scale-110", onClick ? "cursor-pointer" : "pointer-events-none", className)}
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>{n}</button>
  );
}

/** CSS twin of the baked watermark, for GIFs (which are served untouched): one giant outlined DRAFT across the diagonal. */
export function DraftMark({ width, height }: { width: number; height: number }) {
  const angle = -(Math.atan2(height, width) * 180) / Math.PI * 0.85;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]" style={{ containerType: "size" }}>
      <span className="font-extrabold uppercase leading-none text-white" style={{ fontSize: `${Math.hypot(width, height) / Math.max(width, height) * 22}cqw`, transform: `rotate(${angle}deg)`, WebkitTextStroke: "0.05em #111", opacity: 0.22, letterSpacing: "-0.02em" }}>Draft</span>
    </div>
  );
}

/** Fractions of the image: where the safe zone starts on each edge, and (print) where the cut line is. */
export function guideGeometry(safe: SafeArea, print: PrintGuides | null, width: number, height: number) {
  if (print && print.widthIn > 0 && print.heightIn > 0) {
    const cut = { x: print.bleedIn / print.widthIn, y: print.bleedIn / print.heightIn };
    const s = { x: (print.bleedIn + print.safeIn) / print.widthIn, y: (print.bleedIn + print.safeIn) / print.heightIn };
    return { cut, safe: { top: s.y, right: s.x, bottom: s.y, left: s.x } };
  }
  const f = (v: number, t: number) => (t > 0 ? v / t : 0);
  return { cut: null, safe: { top: f(safe.top, height), right: f(safe.right, width), bottom: f(safe.bottom, height), left: f(safe.left, width) } };
}

/**
 * Print-shop style guides: a translucent mint safe zone along the edges (keep text inside), and for print a
 * pink dashed cut line with crop ticks at the corners (everything outside is trimmed).
 */
export function Guides({ cut, safe }: { cut: { x: number; y: number } | null; safe: { top: number; right: number; bottom: number; left: number } }) {
  const p = (v: number) => `${v * 100}%`;
  const band = { background: SAFE };
  const inner = `inset 0 0 0 1px rgba(122,226,178,.9)`;
  return (
    <>
      {/* Safe zone: bands from the edge (or from the cut line) to the safe boundary */}
      {safe.top > 0 && <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: p(safe.top), ...band }} />}
      {safe.bottom > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: p(safe.bottom), ...band }} />}
      {safe.left > 0 && <div className="pointer-events-none absolute left-0" style={{ top: p(safe.top), bottom: p(safe.bottom), width: p(safe.left), ...band }} />}
      {safe.right > 0 && <div className="pointer-events-none absolute right-0" style={{ top: p(safe.top), bottom: p(safe.bottom), width: p(safe.right), ...band }} />}
      <div className="pointer-events-none absolute" style={{ top: p(safe.top), right: p(safe.right), bottom: p(safe.bottom), left: p(safe.left), boxShadow: inner }} />
      {cut && (
        <>
          <div className="pointer-events-none absolute" style={{ top: p(cut.y), right: p(cut.x), bottom: p(cut.y), left: p(cut.x), border: `1.5px dashed ${CUT}` }} />
          {/* crop ticks just outside the artwork at each cut-line corner */}
          {([["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]] as const).map(([v, h]) => (
            <span key={v + h} className="pointer-events-none contents">
              <i className="absolute block" style={{ [h]: p(cut.x), [v]: -14, width: 1.5, height: 10, background: CUT, transform: "translateX(-0.75px)" }} />
              <i className="absolute block" style={{ [v]: p(cut.y), [h]: -14, width: 10, height: 1.5, background: CUT, transform: "translateY(-0.75px)" }} />
            </span>
          ))}
        </>
      )}
    </>
  );
}
