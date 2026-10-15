"use client";
// icons: stop
import { useRef, useSyncExternalStore } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";
import type { Mood } from "@/components/assistant/buddy";

/** Where the character shows up with the sheet closed: in the phone's bottom bar, or the bottom-right corner elsewhere. */
export type Anchor = "nav" | "corner";

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
 * His button: a disc with his face and a hand waving out of it. Tap to talk (tap again to stop), hold to open the
 * thread. In the bottom bar it sits in the middle, a little bigger than the tabs; elsewhere it floats in the corner.
 */
export function DockButton({ slot, head, hand, listening, busy, attention, onTap, onHold }: { slot: HTMLElement | null; head: string; hand: string; listening: boolean; busy: boolean; /** A card is waiting for the person. */ attention: boolean; onTap: () => void; onHold: () => void }) {
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; held: boolean }>({ timer: null, held: false });
  const down = () => { press.current.held = false; press.current.timer = setTimeout(() => { press.current.held = true; if (navigator.vibrate) navigator.vibrate(12); onHold(); }, 420); };
  const up = () => { if (press.current.timer) clearTimeout(press.current.timer); press.current.timer = null; if (!press.current.held) onTap(); press.current.held = false; };
  const cancel = () => { if (press.current.timer) clearTimeout(press.current.timer); press.current.timer = null; press.current.held = false; };
  const button = (
    <button type="button" aria-label={listening ? "Stop listening" : "Talk to the assistant"} aria-pressed={listening}
      onPointerDown={down} onPointerUp={up} onPointerCancel={cancel} onPointerLeave={cancel} onContextMenu={(e) => e.preventDefault()}
      className={cn("buddy-dock group relative flex size-14 items-center justify-center rounded-full bg-card shadow-md ring-1 ring-border transition-transform active:scale-95", slot ? "-mt-5" : "fixed bottom-6 right-5 z-50 md:bottom-8 md:right-8", listening && "buddy-dock-listening ring-2 ring-brand")}
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
      <span className="block size-full overflow-hidden rounded-full bg-brand-soft"><img src={head} alt="" className="size-full object-cover" draggable={false} /></span>
      {/* The hand waves out of the disc now and then while he is free; a stop badge takes its place while he listens. */}
      {listening ? (
        <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground ring-2 ring-card"><Icon name="stop" size={20} fill className="!text-[14px]" /></span>
      ) : (
        <img src={hand} alt="" className={cn("buddy-hand pointer-events-none absolute -bottom-1 -left-3 h-8 w-auto", busy && "opacity-0")} draggable={false} />
      )}
      {attention && !listening && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
    </button>
  );
  return slot ? createPortal(button, slot) : button;
}

/**
 * While he listens with the sheet closed he peeks up over the bottom bar (or the corner), eyes and fingers over the
 * edge, with the words so far in a bubble above him.
 */
export function LedgePeek({ src, anchor, level, caption }: { src: string; anchor: Anchor; level: number; caption: string | null }) {
  return (
    <div className={cn("buddy-ledge pointer-events-none fixed z-50 flex flex-col items-center", anchor === "nav" ? "inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+66px)]" : "bottom-24 right-5 md:bottom-28 md:right-8")} aria-live="polite">
      {caption && <div className="buddy-caption mb-1 max-w-[80vw] rounded-2xl rounded-bl-md bg-card px-3.5 py-2 text-sm leading-5 text-foreground shadow-md ring-1 ring-border md:max-w-sm">{caption}</div>}
      <img src={src} alt="" className="buddy-ledge-art h-20 w-auto select-none md:h-24" draggable={false} style={{ transform: `translateY(${Math.round((1 - level) * 6)}px)` }} />
    </div>
  );
}

/** While he works, a bigger disc with his face, the thinking poses taking turns, and a word on what he is doing. */
export function ThinkingOrb({ poses, mood, anchor, caption }: { poses: readonly string[]; mood: Mood; anchor: Anchor; caption: string | null }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { if (poses.length < 2) return; const t = setInterval(() => setTick((n) => n + 1), 2000); return () => clearInterval(t); }, [poses.length]);
  const src = poses[tick % poses.length];
  return (
    <div className={cn("buddy-orb-wrap pointer-events-none fixed z-50 flex flex-col items-center gap-2", anchor === "nav" ? "inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)]" : "bottom-24 right-5 md:bottom-28 md:right-8")} aria-live="polite">
      <div className="buddy-orb relative size-24 rounded-full bg-foreground p-1 shadow-xl" data-mood={mood}>
        <span className="block size-full overflow-hidden rounded-full bg-brand-soft"><img key={src} src={src} alt="" className="buddy-art size-full object-cover" draggable={false} /></span>
        <span className="buddy-orb-ring absolute inset-0 rounded-full" />
      </div>
      {caption && <div className="rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background">{caption}</div>}
    </div>
  );
}
