"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type Mood = "calm" | "listening" | "thinking" | "done" | "needs-you" | "puzzled";

/** Optional artwork per mood (public/ paths); a list alternates while the mood lasts. Without it the character is the drawn orb below. */
export type BuddyArt = Partial<Record<Mood, string | readonly string[]>>;

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
