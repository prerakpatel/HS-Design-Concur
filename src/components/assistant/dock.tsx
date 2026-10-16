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
  peek: string | null;
  /** A card is waiting for the person. */
  attention: boolean;
  onTap: () => void;
  onHold: () => void;
}

/** Where the bar keeps the space above its right half for him to peek over (src/components/mobile-nav.tsx). */
const NAV_PEEK_ID = "dc-nav-peek";

/**
 * In the phone's bottom bar: a raised mic in the middle, in a notch cut out of the bar, labelled like the tabs. Tap
 * and his screen takes over and he listens; hold to open it without listening. He peeks over the bar on the right,
 * hands on its edge; tap him and the mic dribbles, so the curious find the way in.
 */
export function NavDock({ slot, peek, attention, onTap, onHold }: DockProps & { slot: HTMLElement }) {
  const press = usePress(onTap, onHold);
  const [dribble, setDribble] = useState(0);
  const column = (
    <button type="button" aria-label="Talk to the assistant" {...press}
      className="relative flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium text-muted-foreground"
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
      {/* The icon row the tabs share; the mic rises out of it over the bar's edge, into the notch. */}
      <span className="relative flex h-8 w-14 items-center justify-center">
        <span className="buddy-dock absolute -top-10 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md active:scale-95">
          <span key={dribble} className={cn("flex", dribble > 0 && "buddy-dribble")}><Icon name="mic" fill size={24} className="!text-[28px]" /></span>
          {attention && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
        </span>
      </span>
      Vichar
    </button>
  );
  const peekSlot = slot.ownerDocument.getElementById(NAV_PEEK_ID);
  const peeking = peek && peekSlot && createPortal(
    <button type="button" aria-label="That's Vichar. Tap the mic to talk to him." onClick={() => setDribble((n) => n + 1)}
      className="absolute bottom-0 right-[7%] block w-[116px] select-none active:translate-y-0.5" style={{ WebkitTouchCallout: "none" }}>
      <img src={peek} alt="" className="block w-full" draggable={false} />
    </button>,
    peekSlot,
  );
  return <>{createPortal(column, slot)}{peeking}</>;
}

/**
 * Everywhere without the bottom bar (design pages, project setup, desktop): the same disc floats at the bottom, in
 * the corner on desktop. Left alone it settles into the edge; it comes back up when touched or when a card waits.
 */
export function FloatingDock({ still, attention, onTap, onHold, corner }: Omit<DockProps, "peek"> & { corner: boolean }) {
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
