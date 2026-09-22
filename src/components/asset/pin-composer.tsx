"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/material-icon";
import { PinBubble, Guides, guideGeometry, type Pin, type SafeArea, type PrintGuides } from "@/components/asset/viewer";
import { cn } from "@/lib/utils";

/**
 * Full-screen "Add comment": tap the artwork to drop a numbered bubble, describe the edit, confirm.
 * Existing pins show dimmed so the new number reads in sequence.
 */
export function PinComposer({ open, onClose, onSubmit, src, isGif, width, height, safe, print, guideColor, existing, nextNumber, pending }: {
  open: boolean; onClose: () => void; onSubmit: (pin: { x: number; y: number }, text: string) => void;
  src: string | null; isGif: boolean; width: number; height: number; safe: SafeArea; print: PrintGuides | null; guideColor: string; existing: Pin[]; nextNumber: number; pending: boolean;
}) {
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState("");
  const [showGuides, setShowGuides] = useState(false);
  const g = guideGeometry(safe, print, width, height);
  const reset = () => { setPin(null); setText(""); };
  const ready = !!pin && text.trim().length > 0 && !pending;
  return (
    <Dialog open={open && !!src} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent showCloseButton={false} className="!fixed !inset-0 flex h-dvh max-h-dvh w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-black p-0 text-white shadow-none ring-0 sm:max-w-none">
        <DialogTitle className="sr-only">Add comment</DialogTitle>
        <div className="flex items-center justify-between px-3 pt-[max(env(safe-area-inset-top),12px)] pb-2">
          <button type="button" onClick={() => { reset(); onClose(); }} aria-label="Cancel" className="flex size-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"><Icon name="arrow_back" /></button>
          <p className="text-base font-semibold">Add comment</p>
          <button type="button" onClick={() => setShowGuides((v) => !v)} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium", showGuides ? "bg-white text-black" : "bg-white/15 hover:bg-white/25")}><Icon name="grid_on" className="!text-[16px]" />Guides</button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-3">
          <div className="relative inline-block max-w-full">
            {src && <img src={src} alt="" className="block max-h-[calc(100dvh-190px)] max-w-full cursor-crosshair rounded-xl object-contain" style={{ aspectRatio: width && height ? `${width} / ${height}` : undefined }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPin({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); }} />}
            {isGif && <div className="pointer-events-none absolute inset-0 rounded-xl" style={{ backgroundImage: "url(/watermark-tile.png)", backgroundSize: "40%" }} />}
            {showGuides && <Guides bands={g.bands} rects={g.rects} color={guideColor} />}
            {existing.map((p) => <PinBubble key={p.n} n={p.n} x={p.x} y={p.y} className="opacity-45" />)}
            {pin ? <PinBubble n={nextNumber} x={pin.x} y={pin.y} size="lg" /> : <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-max rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium">Tap the artwork where the change is needed</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
          <div className="flex h-14 flex-1 items-center gap-2 rounded-full bg-white/12 pl-2 pr-2 ring-1 ring-white/15 focus-within:ring-white/40">
            <button type="button" onClick={reset} aria-label="Clear" className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-white/15"><Icon name="close" /></button>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={pin ? "Describe the edit" : "Tap the image first"} className="min-w-0 flex-1 bg-transparent text-base text-white placeholder:text-white/50 focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter" && ready) onSubmit(pin!, text.trim()); }} />
            <button type="button" disabled={!ready} onClick={() => onSubmit(pin!, text.trim())} aria-label="Post comment" className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", ready ? "bg-white text-black" : "bg-white/15 text-white/40")}><Icon name="check" /></button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
