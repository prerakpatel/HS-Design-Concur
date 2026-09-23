"use client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/material-icon";
import { DraftMark } from "@/components/asset/viewer";

/** Full-window view of one image. Click outside or press Esc to close. */
export function Lightbox({ open, onClose, src, caption, isGif, size }: { open: boolean; onClose: () => void; src: string | null; caption: string; isGif?: boolean; size?: { width: number; height: number } }) {
  return (
    <Dialog open={open && !!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[calc(100vw-1.5rem)] gap-0 border-0 bg-transparent p-0 shadow-none ring-0 sm:max-w-[calc(100vw-3rem)]">
        <DialogTitle className="sr-only">{caption}</DialogTitle>
        <div className="relative mx-auto inline-block max-w-full" onClick={onClose}>
          {src && <img src={src} alt="" className="block max-h-[calc(100dvh-3rem)] max-w-full rounded-lg object-contain shadow-2xl" />}
          {isGif && <DraftMark width={size?.width ?? 1} height={size?.height ?? 1} />}
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{caption}</span>
          <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"><Icon name="close" /></button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
