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
/** The phone header's right side, for his chair, and its bottom right corner, for him peeking in (src/components/mobile-top-bar.tsx). */
export const CHAIR_SLOT_ID = "dc-top-chair";
export const PEEK_SLOT_ID = "dc-top-peek";

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
/** Three taps within a second and a half. */
function useTripleTap(onThird: () => void) {
  const taps = useRef<number[]>([]);
  return () => {
    const now = Date.now(); taps.current = [...taps.current.filter((t) => now - t < 1500), now];
    if (taps.current.length >= 3) { taps.current = []; onThird(); }
  };
}

export function NavDock({ slot, attention, onTap, onHold }: DockProps & { slot: HTMLElement }) {
  const press = usePress(onTap, onHold);
  const [dribble, setDribble] = useState(0);
  const label = () => setDribble((n) => n + 1);
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
      <button type="button" className="-mt-1 px-2 pt-1" onClick={label} aria-label="Vichar">Vichar</button>
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

/** Played once per page load; a client-side return to Projects shows the still. A refresh plays it again. */
let waved = false;

/** How long the still takes to come in over the animation's last frame. */
const WAVE_FADE_MS = 300;
type WaveArt = { still: string; anim: string; delayMs: number; durationMs: number };

/**
 * Him waving: the animation plays once (after a pause, so the page has settled), then the sharp still dissolves in
 * over its last frame, which stays underneath until the still is fully in. Without an animation, or for people who
 * prefer less motion, just the still. Plays once per page load unless `force`d; `onDone` fires once the still is in.
 * Positioning comes from `className`.
 */
function Wave({ wave, className, force = false, onDone }: { wave: WaveArt; className?: string; force?: boolean; onDone?: () => void }) {
  const [phase, setPhase] = useState<"wait" | "anim" | "fade" | "still">(() => {
    if (!wave.durationMs || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches)) return "still";
    if (!force) { if (waved) return "still"; waved = true; }
    return "wait";
  });
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    if (phase !== "wait") return;
    const img = new Image(); img.src = wave.anim; // fetched during the pause, so it starts on time
    const start = setTimeout(() => setPhase("anim"), wave.delayMs);
    const fade = setTimeout(() => setPhase("fade"), wave.delayMs + wave.durationMs + 100); // a little slack for decoding
    const end = setTimeout(() => setPhase("still"), wave.delayMs + wave.durationMs + 100 + WAVE_FADE_MS);
    return () => { clearTimeout(start); clearTimeout(fade); clearTimeout(end); };
  }, [phase, wave]);
  useEffect(() => { if (phase === "still") done.current?.(); }, [phase]);
  const over = phase === "anim" || phase === "fade";
  return (
    <span className={cn("pointer-events-none select-none", className)} aria-hidden>
      {over && <img src={wave.anim} alt="" className="block w-full" draggable={false} />}
      {/* The still sits over the animation and comes in once it has played; the animation is let go after that. It is
          already at opacity 0 while waiting, so nothing fades when the animation starts: the only fade is the one at the end. */}
      <img src={wave.still} alt="" draggable={false} className={cn("block w-full transition-opacity", over && "absolute inset-0", phase === "anim" || phase === "wait" ? "opacity-0" : "opacity-100", phase === "wait" && "invisible")} style={{ transitionDuration: `${WAVE_FADE_MS}ms` }} />
    </span>
  );
}

/**
 * The easter egg's switch: a tiny chair at the top right of the phone's header. Tap it three times and he peeks in
 * beside it (Peek).
 */
export function Chair({ slot, src, onSecret }: { slot: HTMLElement; src: string; onSecret: () => void }) {
  const tap = useTripleTap(onSecret);
  return createPortal(
    <button type="button" onClick={tap} aria-label="A small chair" className="flex size-10 items-center justify-center rounded-full active:bg-muted">
      <img src={src} alt="" className="size-7 select-none" draggable={false} />
    </button>,
    slot,
  );
}

/**
 * Him peeking in from the screen's right edge beside his chair, hanging a little below the header so his hair is not
 * cut by the top of the page: the wave at once, a short pause, then he slowly slides back out. `onEnd` once he is gone.
 */
export function Peek({ slot, wave, onEnd }: { slot: HTMLElement; wave: WaveArt; onEnd: () => void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => { if (!leaving) return; const t = setTimeout(onEnd, 1200); return () => clearTimeout(t); }, [leaving, onEnd]);
  return createPortal(
    <span aria-hidden className={cn("block w-[72px] translate-y-11 transition-transform duration-1000 ease-in", leaving && "translate-x-full")}>
      <Wave wave={{ ...wave, delayMs: 0 }} force onDone={() => setTimeout(() => setLeaving(true), 500)} className="relative block w-full" />
    </span>,
    slot,
  );
}

/**
 * His hello at the top of Projects, once: him leaning in from the right edge of the screen, waving, one line on what
 * to say, and two choices: try it (opens his screen listening) or later. Either way it stays away until he learns
 * something new (ASSISTANT_HELLO_VERSION).
 */
export function HelloCard({ slot, wave, onTry, onLater }: { slot: HTMLElement; wave: WaveArt; onTry: () => void; onLater: () => void }) {
  const [replay, setReplay] = useState(0);
  return createPortal(
    <div className="buddy-art relative mb-6 mt-7 rounded-2xl border border-border bg-card p-4 pr-[112px]">
      {/* His cut edge flush with the screen’s right edge on phones (the page’s 20px gutter plus the artwork’s own 4px margin), tucked inside the card on wider screens; his bottom edge on the card’s; about 160px tall. A tap on him and he waves again. */}
      <button type="button" aria-label="Wave again" onClick={() => setReplay((n) => n + 1)} className="absolute -right-6 bottom-0 w-[121px] md:right-3">
        <Wave key={replay} wave={replay ? { ...wave, delayMs: 0 } : wave} force={replay > 0} className="relative block w-full" />
      </button>
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
