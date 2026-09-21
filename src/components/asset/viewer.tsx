"use client";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface SafeArea { top: number; right: number; bottom: number; left: number }
export interface Pin { n: number; x: number; y: number }

/** Asset preview: baked-watermark image (or GIF with CSS watermark), safe-area overlay, caption pill, comment pins. */
export function Viewer({ src, isGif, width, height, safe, caption, frame, pins, onPick, picked, className }: {
  src: string | null; isGif: boolean; width: number; height: number; safe: SafeArea; caption: string;
  frame: "phone" | "card" | "flat" | "tv" | "led" | "print"; pins: Pin[]; onPick?: (p: { x: number; y: number }) => void; picked?: { x: number; y: number } | null; className?: string;
}) {
  const [showSafe, setShowSafe] = useState(true);
  const pct = (v: number, total: number) => (total > 0 ? `${(v / total) * 100}%` : "0%");
  const hasSafe = safe.top + safe.right + safe.bottom + safe.left > 0;
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className={cn("relative w-full max-w-[520px] overflow-hidden bg-card shadow-md", frame === "phone" ? "rounded-[28px] border-[6px] border-zinc-900" : frame === "tv" ? "rounded-md border-[10px] border-zinc-800" : "rounded-xl border border-border")} style={{ aspectRatio: width && height ? `${width} / ${height}` : "4 / 5" }}>
        {src ? (
          <img src={src} alt="" className="absolute inset-0 size-full object-contain" onClick={(e) => { if (!onPick) return; const r = e.currentTarget.getBoundingClientRect(); onPick({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); }} style={{ cursor: onPick ? "crosshair" : undefined }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">No design uploaded yet</div>
        )}
        {isGif && src && <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "url(/watermark-tile.png)", backgroundSize: "40%" }} />}
        {frame === "led" && <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(to right, rgba(0,0,0,.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.12) 1px, transparent 1px)", backgroundSize: "12.5% 25%" }} />}
        {frame === "print" && <div className="pointer-events-none absolute inset-[3.3%] rounded-sm border border-dashed border-destructive/70" />}
        {showSafe && hasSafe && src && (
          <>
            {safe.top > 0 && <div className="pointer-events-none absolute inset-x-0 top-0 border-b border-dashed border-destructive/70 bg-destructive/15" style={{ height: pct(safe.top, height) }} />}
            {safe.bottom > 0 && <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-dashed border-destructive/70 bg-destructive/15" style={{ height: pct(safe.bottom, height) }} />}
            {safe.left > 0 && <div className="pointer-events-none absolute inset-y-0 left-0 bg-destructive/15" style={{ width: pct(safe.left, width) }} />}
            {safe.right > 0 && <div className="pointer-events-none absolute inset-y-0 right-0 bg-destructive/15" style={{ width: pct(safe.right, width) }} />}
          </>
        )}
        {pins.map((p) => <span key={p.n} className="absolute flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand text-[10px] font-medium text-brand-foreground shadow" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>{p.n}</span>)}
        {picked && <span className="absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-brand/40" style={{ left: `${picked.x * 100}%`, top: `${picked.y * 100}%` }} />}
        {src && <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">{caption}</span>}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
        {hasSafe && <label className="flex items-center gap-2 font-medium"><Switch checked={showSafe} onCheckedChange={setShowSafe} />Safe area</label>}
        {hasSafe && <span className="text-muted-foreground">Artwork may extend into the red zones, but keep text, murti and logos out of them.</span>}
        {frame === "print" && <span className="text-muted-foreground">Dashed line = 0.25 in bleed.</span>}
      </div>
    </div>
  );
}
