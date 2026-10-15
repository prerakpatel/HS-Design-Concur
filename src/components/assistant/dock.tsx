"use client";
// icons: mic
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
export function OrbFace({ media, className, inset = false }: { media: OrbMedia; className?: string; /** A little room around him, for the small disc. */ inset?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const video = media.video && failed !== media.video ? media.video : null;
  const fit = cn("size-full object-cover", inset && "scale-[0.86]");
  return (
    <span className={cn("block size-full overflow-hidden rounded-full bg-white", className)}>
      {video ? <video key={video} src={video} autoPlay muted loop playsInline disablePictureInPicture className={fit} onError={() => setFailed(video)} /> : <img key={media.image} src={media.image} alt="" className={cn("buddy-art", fit)} draggable={false} />}
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
  // At rest the disc holds his face with a mic badge; once tapped he moves up into the orb and the disc becomes the stop.
  const button = (
    <button type="button" aria-label={state === "listening" ? "Stop listening" : "Talk to the assistant"} aria-pressed={state === "listening"} {...press}
      className={cn("buddy-dock relative flex items-center justify-center rounded-full p-0.5 shadow-md ring-1 transition-[background-color,box-shadow,width,height,margin] duration-300 active:scale-95", active ? "mt-0 size-8 bg-brand ring-brand" : "-mt-5 size-14 bg-card ring-border")}
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}>
      <span className={cn("absolute inset-0.5 transition-opacity duration-200", active ? "opacity-0" : "opacity-100")}><OrbFace media={media.idle} inset /></span>
      <span className={cn("flex size-full items-center justify-center text-brand-foreground transition-opacity duration-200", active ? "opacity-100" : "opacity-0")}><span className="block size-2.5 rounded-[2px] bg-current" /></span>
      {!active && <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-brand-soft text-brand-soft-foreground ring-2 ring-card"><Icon name="mic" size={20} className="!text-[14px]" /></span>}
      {attention && !active && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
    </button>
  );
  return (
    <>
      {createPortal(button, slot)}
      {active && (
        <>
          <div className="buddy-glow pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+66px)] z-[45] h-52" />
          {/* The orb sits low enough to overlap the disc it came out of; the words, or what he is doing, in one slot above it. */}
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 flex flex-col items-center gap-2.5" aria-live="polite">
            {caption && (state === "listening" ? <Caption>{caption}</Caption> : <Pill>{caption}</Pill>)}
            <Orb media={media[state]} state={state} level={level} size={96} grow />
          </div>
        </>
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
    <>
      {active && <div className={cn("buddy-glow pointer-events-none fixed z-[45]", corner ? "bottom-0 right-0 h-56 w-72" : "inset-x-0 bottom-0 h-56")} />}
      <div className={cn("fixed z-50 flex flex-col gap-2", corner ? "bottom-5 right-5 items-end md:bottom-7 md:right-8" : "inset-x-0 bottom-[max(env(safe-area-inset-bottom),12px)] items-center")} aria-live="polite">
        {active && caption && (state === "listening" ? <Caption>{caption}</Caption> : <Pill>{caption}</Pill>)}
        <button type="button" aria-label={state === "listening" ? "Stop listening" : "Talk to the assistant"} aria-pressed={state === "listening"} {...press}
          onPointerEnter={wake}
          className={cn("buddy-float relative rounded-full p-0.5 shadow-md ring-1 transition-[width,height,transform,opacity,background-color] duration-300 ease-out", active ? "bg-foreground ring-foreground" : "bg-card ring-border", !active && !awake && "translate-y-[45%] opacity-80")}
          style={{ width: size, height: size, touchAction: "manipulation", WebkitTouchCallout: "none" }}>
          <Orb media={media[active ? state : "idle"]} state={state} level={level} size={size - 4} bare inset={!active} />
          {state === "listening" && <span className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full bg-brand text-brand-foreground ring-2 ring-card"><span className="block size-2.5 rounded-[2px] bg-current" /></span>}
          {!active && awake && <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-brand-soft text-brand-soft-foreground ring-2 ring-card"><Icon name="mic" size={20} className="!text-[14px]" /></span>}
          {attention && !active && <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-card" />}
        </button>
      </div>
    </>
  );
}

/** The orb itself: a disc with his face, swelling with the voice while he listens, a soft ring while he works. */
function Orb({ media, state, level, size, bare = false, grow = false, inset = false }: { media: OrbMedia; state: OrbState; level: number; size: number; bare?: boolean; /** Rises out of the disc in the bar. */ grow?: boolean; inset?: boolean }) {
  return (
    <div className={cn("buddy-orb relative rounded-full", !bare && "bg-foreground p-1 shadow-xl", grow && "buddy-orb-grow")} data-state={state} style={{ width: size, height: size, transform: state === "listening" ? `scale(${1 + level * 0.08})` : undefined }}>
      <OrbFace media={media} inset={inset} />
      {state === "thinking" && <span className="buddy-orb-ring absolute inset-0 rounded-full" />}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <div className="buddy-caption max-w-[80vw] rounded-2xl bg-card px-3.5 py-2 text-sm leading-5 text-foreground shadow-md ring-1 ring-border md:max-w-sm">{children}</div>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <div className="buddy-caption rounded-full bg-foreground/90 px-3 py-1 text-xs font-medium text-background shadow-md">{children}</div>;
}
