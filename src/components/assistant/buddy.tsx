"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type Mood = "calm" | "listening" | "thinking" | "done" | "needs-you" | "puzzled";

/** Optional artwork per mood (public/ paths); a list alternates while the mood lasts. Without it the character is the drawn orb below. */
export type BuddyArt = Partial<Record<Mood, string | readonly string[]>>;
/** Peeking poses for the screen's edge, one per mood plus a hello wave on arrival. */
export type PeekArt = Partial<Record<Mood | "hello", string>>;

const POSE_MS = 2400;

/**
 * The character. A soft orb with a face that breathes when idle, swells with the person's voice while listening,
 * looks up and swirls while thinking, and ticks when done. Only ever animates for a real state.
 */
export function Buddy({ mood, level = 0, size = 64, art, className }: { mood: Mood; level?: number; size?: number; art?: BuddyArt; className?: string }) {
  const poses = art?.[mood] ?? art?.calm;
  const list = typeof poses === "string" ? [poses] : poses ? [...poses] : [];
  // Several poses for one mood take turns (thinking: looking up, scribbling, puzzling).
  const [tick, setTick] = useState(0);
  useEffect(() => { if (list.length < 2) return; const t = setInterval(() => setTick((n) => n + 1), POSE_MS); return () => clearInterval(t); }, [list.length, mood]);
  const src = list.length ? list[tick % list.length] : null;
  return (
    <div className={cn("buddy relative shrink-0 select-none", className)} data-mood={mood} style={{ width: size, height: size, ["--level" as string]: level.toFixed(2) }} aria-hidden>
      <span className="buddy-ring absolute inset-0 rounded-full" />
      <span className="buddy-ring buddy-ring-2 absolute inset-0 rounded-full" />
      <div className="buddy-body absolute inset-0">
        {src ? <span className="block h-full w-full overflow-hidden rounded-full bg-brand-soft ring-2 ring-card"><img key={src} src={src} alt="" className="buddy-art h-full w-full object-cover" draggable={false} /></span> : <Orb />}
      </div>
      <span className="buddy-tick absolute inset-0 flex items-center justify-center text-success-text">
        <svg viewBox="0 0 24 24" width={size * 0.45} height={size * 0.45} fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.2 4.2L19 7" /></svg>
      </span>
    </div>
  );
}

function Orb() {
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full">
      <defs>
        <radialGradient id="buddy-g" cx="38%" cy="32%" r="75%"><stop offset="0%" stopColor="color-mix(in oklch, var(--brand) 55%, white)" /><stop offset="65%" stopColor="var(--brand)" /><stop offset="100%" stopColor="var(--brand-hover)" /></radialGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#buddy-g)" />
      <ellipse cx="25" cy="22" rx="7" ry="3.5" fill="white" opacity="0.28" />
      <g className="buddy-eyes" fill="#2b1a12">
        <ellipse className="buddy-eye" cx="24" cy="31" rx="3.2" ry="4.4" />
        <ellipse className="buddy-eye" cx="40" cy="31" rx="3.2" ry="4.4" />
      </g>
      <g className="buddy-eyes" fill="white"><circle cx="25.2" cy="29.3" r="1.1" /><circle cx="41.2" cy="29.3" r="1.1" /></g>
      <path className="buddy-mouth" d="M25 41 Q32 46 39 41" stroke="#2b1a12" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <g className="buddy-dots" fill="white" opacity="0.9"><circle cx="20" cy="8" r="2" /><circle cx="32" cy="4" r="2" /><circle cx="44" cy="8" r="2" /></g>
    </svg>
  );
}

/** Where the character rests on the screen edge, remembered per device. */
const KEY = "dc.buddy.y";
const readY = () => { try { const v = Number(localStorage.getItem(KEY)); return v > 0 ? v : null; } catch { return null; } };
const writeY = (y: number) => { try { localStorage.setItem(KEY, String(Math.round(y))); } catch { /* private mode */ } };

/**
 * The character peeking in from the right edge of the screen, a tap away on every page. Tap opens the thread; hold
 * and it listens straight away (release to send); drag moves it up or down the edge out of the way.
 */
export function PeekingBuddy({ mood, level, art, peek, caption, onTap, onHoldStart, onHoldEnd, hidden }: { mood: Mood; level: number; art?: BuddyArt; peek?: PeekArt; /** A few words beside him while he listens or thinks with the sheet closed. */ caption?: string | null; onTap: () => void; onHoldStart: () => void; onHoldEnd: () => void; hidden: boolean }) {
  // Rendered only in the browser (the resting spot is per device), without a state change on mount.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  // He waves on arrival, then settles into the pose for the mood.
  const [hello, setHello] = useState(true);
  useEffect(() => { const t = setTimeout(() => setHello(false), 2600); return () => clearTimeout(t); }, []);
  const [dragY, setDragY] = useState<number | null>(null);
  const y = dragY ?? (mounted ? readY() ?? Math.round(window.innerHeight * 0.62) : null);
  const setY = setDragY;
  const [active, setActive] = useState(false);
  const gesture = useRef<{ x: number; y: number; startY: number; moved: boolean; holding: boolean; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const figure = !!peek?.calm;
  const size = figure ? 150 : 68;
  const clamp = (v: number) => Math.min(window.innerHeight - size - 90, Math.max(70, v));

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = { x: e.clientX, y: e.clientY, startY: y ?? 0, moved: false, holding: false, timer: null as ReturnType<typeof setTimeout> | null };
    g.timer = setTimeout(() => { if (!g.moved) { g.holding = true; setActive(true); if (navigator.vibrate) navigator.vibrate(12); onHoldStart(); } }, 280);
    gesture.current = g;
  };
  const move = (e: React.PointerEvent<HTMLButtonElement>) => {
    const g = gesture.current; if (!g || g.holding) return;
    if (!g.moved && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 8) { g.moved = true; if (g.timer) clearTimeout(g.timer); }
    if (g.moved) setY(clamp(g.startY + (e.clientY - g.y)));
  };
  const up = () => {
    const g = gesture.current; if (!g) return; gesture.current = null;
    if (g.timer) clearTimeout(g.timer);
    setActive(false);
    if (g.holding) onHoldEnd();
    else if (g.moved && y != null) writeY(y);
    else onTap();
  };

  if (y == null) return null;
  if (figure) {
    // The drawn poses already lean out of the edge, so the figure sits flush with it; listening swells with the voice.
    const src = (hello && peek.hello) || peek[mood] || peek.calm!;
    return (
      <>
        {caption && !hidden && (
          <div className="buddy-caption fixed right-[92px] z-50 max-w-[60vw] rounded-2xl rounded-br-md bg-card px-3.5 py-2 text-sm leading-5 text-foreground shadow-md ring-1 ring-border" style={{ top: y + 24 }} aria-live="polite">{caption}</div>
        )}
        {/* While he is held, he stays put and on top of everything, so the hold is never cut short. */}
        <button type="button" aria-label="Assistant" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
          className={cn("buddy-figure fixed right-0 origin-right transition-[transform,opacity] duration-300 ease-out", active ? "z-[60]" : "z-50", hidden && !active && "pointer-events-none translate-x-full opacity-0", active && "scale-105")}
          style={{ top: y, height: size, touchAction: "none", WebkitTouchCallout: "none", transform: mood === "listening" ? `scale(${1 + level * 0.06})` : undefined }}>
          <img key={src} src={src} alt="" className={cn("buddy-figure-art h-full w-auto select-none", mood === "needs-you" && "buddy-figure-nudge")} draggable={false} />
        </button>
      </>
    );
  }
  return (
    <button type="button" aria-label="Assistant" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
      className={cn("buddy-peek fixed right-0 z-50 flex items-center justify-center rounded-l-full transition-[transform,opacity] duration-300 ease-out", active || mood !== "calm" ? "translate-x-0" : "translate-x-[38%] hover:translate-x-0 focus-visible:translate-x-0", hidden && "pointer-events-none translate-x-full opacity-0")}
      style={{ top: y, width: size + 8, height: size + 8, touchAction: "none", WebkitTouchCallout: "none" }}>
      <Buddy mood={mood} level={level} size={size} art={art} />
    </button>
  );
}
