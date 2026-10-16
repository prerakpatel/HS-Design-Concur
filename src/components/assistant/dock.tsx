"use client";
// icons: mic
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";

/** The slot the bottom bar leaves for him (src/components/mobile-nav.tsx), when there is one on this page. */
export const NAV_SLOT_ID = "dc-nav-assistant";

export function useNavSlot(pathname: string): HTMLElement | null {
  // Read from the page after it is on screen (the bar comes and goes with the route), without a state change on mount.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [, bump] = useState(0);
  useEffect(() => { const t = setTimeout(() => bump((n) => n + 1), 0); return () => clearTimeout(t); }, [pathname]);
  return mounted ? document.getElementById(NAV_SLOT_ID) : null;
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
  still: string;
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
      {/* 56px with a 4px ring: its centre 4px below the bar's top edge, matching the notch (src/app/globals.css). */}
      <button type="button" aria-label="Talk to the assistant" {...press} key={dribble}
        className={cn("buddy-dock absolute left-[calc(50%-28px)] top-[-24px] flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-[0_3px_10px_rgb(0_0_0/0.18)] ring-4 ring-card", dribble > 0 && "buddy-dribble")}
        style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
        <Icon name="mic" fill size={24} className="!text-[28px]" />
        {attention && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
      </button>
      <button type="button" className="-mt-1 px-2 pt-1" onClick={() => setDribble((n) => n + 1)} aria-label="Vichar">Vichar</button>
    </span>
  );
  return createPortal(column, slot);
}

/**
 * Everywhere without the bottom bar (design pages, project setup, desktop): the same disc floats at the bottom, in
 * the corner on desktop. Left alone it settles into the edge; it comes back up when touched or when a card waits.
 */
export function FloatingDock({ still, attention, onTap, onHold, corner }: DockProps & { corner: boolean }) {
  const press = usePress(onTap, onHold);
  const [touched, setTouched] = useState(false);
  const wake = () => setTouched(true);
  useEffect(() => { if (!touched) return; const t = setTimeout(() => setTouched(false), 4000); return () => clearTimeout(t); }, [touched]);
  const awake = attention || touched;
  return (
    <div className={cn("fixed z-50", corner ? "bottom-5 right-5 md:bottom-7 md:right-8" : "inset-x-0 bottom-[max(env(safe-area-inset-bottom),12px)] flex justify-center")}>
      <button type="button" aria-label="Talk to the assistant" {...press} onPointerEnter={wake}
        className={cn("buddy-float relative flex size-14 items-center justify-center rounded-full bg-card p-0.5 shadow-md ring-1 ring-border transition-[transform,opacity] duration-300 ease-out", !awake && "translate-y-[45%] opacity-80")}
        style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
        <Face still={still} size={48} />
        <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground ring-2 ring-card"><Icon name="mic" fill className="!text-[15px]" /></span>
        {attention && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
      </button>
    </div>
  );
}
