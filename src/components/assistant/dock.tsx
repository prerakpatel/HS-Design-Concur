"use client";
// icons: stop
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSyncExternalStore } from "react";
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

/** What the orb shows for a state: a short looping clip when one exists, else a still. */
export interface OrbMedia { video?: string | null; image: string }
export type OrbState = "idle" | "listening" | "thinking" | "done";

/** Face in a disc: the clip when it plays, the still otherwise (or when the clip is missing or cannot play). */
export function OrbFace({ media, className }: { media: OrbMedia; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const video = media.video && failed !== media.video ? media.video : null;
  return (
    <span className={cn("block size-full overflow-hidden rounded-full bg-white", className)}>
      {video ? <video key={video} src={video} autoPlay muted loop playsInline disablePictureInPicture className="size-full object-cover" onError={() => setFailed(video)} /> : <img key={media.image} src={media.image} alt="" className="buddy-art size-full object-cover" draggable={false} />}
    </span>
  );
}

/** Press handling shared by the button and the floating orb: tap, or hold for the thread. */
function usePress(onTap: () => void, onHold: () => void) {
  const press = useRef<{ timer: ReturnType<typeof setTimeout> | null; held: boolean }>({ timer: null, held: false });
  const down = () => { press.current.held = false; press.current.timer = setTimeout(() => { press.current.held = true; if (navigator.vibrate) navigator.vibrate(12); onHold(); }, 420); };
  const up = () => { if (press.current.timer) clearTimeout(press.current.timer); press.current.timer = null; if (!press.current.held) onTap(); press.current.held = false; };
  const cancel = () => { if (press.current.timer) clearTimeout(press.current.timer); press.current.timer = null; press.current.held = false; };
  return { onPointerDown: down, onPointerUp: up, onPointerCancel: cancel, onPointerLeave: cancel, onContextMenu: (e: React.SyntheticEvent) => e.preventDefault() };
}

export interface DockProps {
  media: Record<OrbState, OrbMedia>;
  state: OrbState;
  /** Microphone loudness, 0–1, while listening. */
  level: number;
  caption: string | null;
  /** A card is waiting for the person. */
  attention: boolean;
  onTap: () => void;
  onHold: () => void;
}

/**
 * In the phone's bottom bar: his face in a disc in the middle, a little bigger than the tabs. Tap and the orb grows
 * out of it above the bar while he listens (tap again to stop) and works; then the sheet opens. Hold for the thread.
 */
export function NavDock({ slot, media, state, level, caption, attention, onTap, onHold }: DockProps & { slot: HTMLElement }) {
  const press = usePress(onTap, onHold);
  const active = state === "listening" || state === "thinking";
  const button = (
    <button type="button" aria-label={state === "listening" ? "Stop listening" : "Talk to the assistant"} aria-pressed={state === "listening"} {...press}
      className={cn("buddy-dock relative -mt-5 flex size-14 items-center justify-center rounded-full bg-card p-0.5 shadow-md ring-1 ring-border transition-transform active:scale-95", state === "listening" && "buddy-dock-listening ring-2 ring-brand")}
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
      <OrbFace media={media.idle} />
      {state === "listening" && <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground ring-2 ring-card"><Icon name="stop" size={20} fill className="!text-[14px]" /></span>}
      {attention && !active && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
    </button>
  );
  return (
    <>
      {createPortal(button, slot)}
      {active && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] z-50 flex flex-col items-center gap-2" aria-live="polite">
          {caption && <Caption>{caption}</Caption>}
          <Orb media={media[state]} state={state} level={level} size={96} />
        </div>
      )}
    </>
  );
}

/**
 * Everywhere without the bottom bar (design pages, project setup, desktop): the orb floats at the bottom. Left alone
 * it settles into a droplet tucked into the bottom edge; it grows back when touched, and to full size while he
 * listens or works. Tap to talk, tap again to stop, hold for the thread.
 */
export function FloatingDock({ media, state, level, caption, attention, onTap, onHold, corner }: DockProps & { corner: boolean }) {
  const press = usePress(onTap, onHold);
  const active = state === "listening" || state === "thinking";
  // After a touch, or once he is done, he stays up a few seconds, then settles into the droplet.
  const [touched, setTouched] = useState(false);
  const wake = () => setTouched(true);
  useEffect(() => { if (!touched) return; const t = setTimeout(() => setTouched(false), 4000); return () => clearTimeout(t); }, [touched]);
  const [wasActive, setWasActive] = useState(false);
  useEffect(() => { if (active) { const t = setTimeout(() => setWasActive(true), 0); return () => clearTimeout(t); } const t = setTimeout(() => setWasActive(false), 4000); return () => clearTimeout(t); }, [active]);
  const awake = active || attention || touched || wasActive;
  const size = active ? 96 : awake ? 56 : 40;
  return (
    <div className={cn("fixed z-50 flex flex-col items-center gap-2", corner ? "bottom-5 right-5 md:bottom-7 md:right-8" : "inset-x-0 bottom-[max(env(safe-area-inset-bottom),12px)]")} aria-live="polite">
      {active && caption && <Caption>{caption}</Caption>}
      <button type="button" aria-label={state === "listening" ? "Stop listening" : "Talk to the assistant"} aria-pressed={state === "listening"} {...press}
        onPointerEnter={wake}
        className={cn("buddy-float relative rounded-full bg-card p-0.5 shadow-md ring-1 ring-border transition-[width,height,transform,opacity] duration-300 ease-out", !active && !awake && "translate-y-[45%] opacity-80", state === "listening" && "buddy-dock-listening ring-2 ring-brand")}
        style={{ width: size, height: size, touchAction: "manipulation", WebkitTouchCallout: "none" }}>
        <Orb media={media[active ? state : "idle"]} state={state} level={level} size={size - 4} bare />
        {state === "listening" && <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground ring-2 ring-card"><Icon name="stop" size={20} fill className="!text-[14px]" /></span>}
        {attention && !active && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
      </button>
    </div>
  );
}

/** The orb itself: a disc with his face, swelling with the voice while he listens, a soft ring while he works. */
function Orb({ media, state, level, size, bare = false }: { media: OrbMedia; state: OrbState; level: number; size: number; bare?: boolean }) {
  return (
    <div className={cn("buddy-orb relative rounded-full", !bare && "bg-foreground p-1 shadow-xl")} data-state={state} style={{ width: size, height: size, transform: state === "listening" ? `scale(${1 + level * 0.08})` : undefined }}>
      <OrbFace media={media} />
      {state === "thinking" && <span className="buddy-orb-ring absolute inset-0 rounded-full" />}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <div className="buddy-caption max-w-[80vw] rounded-2xl bg-card px-3.5 py-2 text-sm leading-5 text-foreground shadow-md ring-1 ring-border md:max-w-sm">{children}</div>;
}
