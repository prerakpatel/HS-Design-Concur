"use client";
// icons: mic
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";

/** The slot the bottom bar leaves for him (src/components/mobile-nav.tsx), when there is one on this page. */
export const NAV_SLOT_ID = "dc-nav-assistant";
/** Where the Projects page leaves room for his hello card (src/app/(app)/events/page.tsx). */
export const HELLO_SLOT_ID = "dc-assistant-hello";

/** An element the page leaves for him, read after the page is on screen (it comes and goes with the route). */
export function useSlot(id: string, pathname: string): HTMLElement | null {
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [, bump] = useState(0);
  useEffect(() => { const t = setTimeout(() => bump((n) => n + 1), 0); return () => clearTimeout(t); }, [pathname]);
  return mounted ? document.getElementById(id) : null;
}

/**
 * His face in a disc: the still cropped to his head, or a short looping clip while he works (the still again if the
 * clip cannot play). The same crop everywhere he appears, so he always looks like himself.
 */
export function Face({ still, clip = null, size, className }: { still: string; clip?: string | null; size: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const video = clip && failed !== clip ? clip : null;
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-full bg-white", className)} style={{ width: size, height: size }} aria-hidden>
      {video
        /* The clips show all of him; zoomed to the bust, anchored at his head. */
        ? <video key={video} src={video} autoPlay muted loop playsInline disablePictureInPicture className="buddy-art size-full origin-[50%_6%] scale-[2.2] object-cover" onError={() => setFailed(video)} />
        : <img src={still} alt="" className="buddy-art absolute left-1/2 top-0 w-[164%] max-w-none -translate-x-1/2" draggable={false} />}
    </span>
  );
}

/** Press handling shared by his buttons: tap, or hold (to open the thread without listening). */
function usePress(onTap: () => void, onHold: () => void) {
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; held: boolean }>({ timer: null, held: false });
  const down = () => { press.current.held = false; press.current.timer = setTimeout(() => { press.current.held = true; if (navigator.vibrate) navigator.vibrate(12); onHold(); }, 420); };
  const up = () => { if (press.current.timer) clearTimeout(press.current.timer); press.current.timer = null; if (!press.current.held) onTap(); press.current.held = false; };
  const cancel = () => { if (press.current.timer) clearTimeout(press.current.timer); press.current.timer = null; press.current.held = false; };
  return { onPointerDown: down, onPointerUp: up, onPointerCancel: cancel, onPointerLeave: cancel, onContextMenu: (e: React.SyntheticEvent) => e.preventDefault() };
}

export interface DockProps {
  /** A card is waiting for the person. */
  attention: boolean;
  onTap: () => void;
  onHold: () => void;
}

/**
 * In the phone's bottom bar: a raised mic in the middle, in a notch cut out of the bar, labelled like the tabs. Tap
 * and his screen takes over and he listens; hold to open it without listening. Tap the label alone and the button
 * dribbles, a nudge for the curious.
 */
export function NavDock({ slot, attention, onTap, onHold }: DockProps & { slot: HTMLElement }) {
  const press = usePress(onTap, onHold);
  const [dribble, setDribble] = useState(0);
  const column = (
    <span className="flex flex-col items-center gap-1 whitespace-nowrap py-1.5 text-[12px] font-medium text-muted-foreground">
      {/* The icon row the tabs share stays empty; the button is placed against the bar itself, so it sits exactly in the notch. */}
      <span className="h-8 w-14" />
      {/* 64px with a 4px ring: its centre 4px below the bar's top edge, matching the notch (src/app/globals.css). */}
      <button type="button" aria-label="Talk to the assistant" {...press} key={dribble}
        className={cn("buddy-dock absolute left-[calc(50%-32px)] top-[-28px] flex size-16 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_3px_10px_rgb(0_0_0/0.18)] ring-4 ring-card", dribble > 0 && "buddy-dribble")}
        style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
        <Icon name="mic" fill size={24} className="!text-[30px]" />
        {attention && <span className="absolute top-0 right-0 size-3 rounded-full bg-warning ring-2 ring-card" />}
      </button>
      <button type="button" className="-mt-1 px-2 pt-1" onClick={() => setDribble((n) => n + 1)} aria-label="Vichar">Vichar</button>
    </span>
  );
  return createPortal(column, slot);
}

/**
 * Pages without the bottom bar (a design, project setup) and desktop: the same mic floats bottom right. On phones a
 * faint rise of the page colour under it, edge to edge, so it stands off whatever scrolls beneath; `raised` lifts it
 * above a page's own bottom bar.
 */
export function FloatingMic({ attention, onTap, onHold, raised }: DockProps & { raised: boolean }) {
  const press = usePress(onTap, onHold);
  return (
    <>
      <div aria-hidden className={cn("pointer-events-none fixed inset-x-0 z-30 h-28 bg-gradient-to-t from-background/90 to-transparent md:hidden", raised ? "bottom-[calc(max(env(safe-area-inset-bottom),12px)+64px)]" : "bottom-0")} />
      <button type="button" aria-label="Talk to the assistant" {...press}
        className={cn("buddy-dock fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_3px_10px_rgb(0_0_0/0.18)] ring-4 ring-card md:bottom-7 md:right-8", raised ? "bottom-[calc(max(env(safe-area-inset-bottom),12px)+76px)]" : "bottom-[max(env(safe-area-inset-bottom),16px)]")}
        style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
        <Icon name="mic" fill size={24} className="!text-[28px]" />
        {attention && <span className="absolute top-0 right-0 size-3 rounded-full bg-warning ring-2 ring-card" />}
      </button>
    </>
  );
}

/**
 * His hello at the top of Projects, once: him leaning in from the right edge of the screen, waving, one line on what
 * to say, and two choices: try it (opens his screen listening) or later. Either way it stays away until he learns
 * something new (ASSISTANT_HELLO_VERSION).
 */
export function HelloCard({ slot, wave, onTry, onLater }: { slot: HTMLElement; wave: string; onTry: () => void; onLater: () => void }) {
  return createPortal(
    <div className="buddy-art relative mb-6 mt-7 rounded-2xl border border-border bg-card p-4 pr-[116px]">
      {/* Flush with the screen’s right edge on phones (the page’s 20px gutter), tucked inside the card on wider screens. */}
      <img src={wave} alt="" aria-hidden className="pointer-events-none absolute -right-5 -top-3 w-[110px] select-none md:right-3" draggable={false} />
      <p className="font-medium">Vichar is here.</p>
      <p className="mt-0.5 text-[13px] leading-[18px] text-muted-foreground">Say what you need: a new project with its formats, a format on one that exists, or a note for a designer. He drafts it; you tap.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onTry} className="inline-flex h-9 items-center gap-2 rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground hover:bg-brand-hover"><Icon name="mic" fill className="!text-[18px]" />Try it</button>
        <button type="button" onClick={onLater} className="inline-flex h-9 items-center rounded-full bg-brand-soft px-4 text-sm font-medium text-brand-soft-foreground hover:bg-brand-soft/70">I’ll try later</button>
      </div>
    </div>,
    slot,
  );
}
