"use client";
import { useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { ratioFromSize } from "@/lib/aspect";
import { mockupFor, MOCK_COLORS as C, PHONE_MOCKS, type Mockup } from "@/config/mockups";
import type { Format } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/material-icon";

// icons: chevron_left chevron_right

/** iPhone 16 Pro screen, the phone mock's proportions (see src/config/devices.ts). */
const SCREEN = 402 / 874;
const LIFT = "shadow-[0_1px_3px_rgba(0,0,0,.12),0_8px_20px_-8px_rgba(0,0,0,.22)]";

/**
 * The asset at its own aspect ratio inside a format tile, never cropped by the tile.
 * Formats with a mockup (phone, Instagram story, Sambandh event, TV, LED wall) get an arrow:
 * tap it to see the design in place, and back. Sizes use container units so mocks scale with the tile.
 */
export function FormatThumb({ src, size, formatKey, frame, event }: { src: string; size: string; formatKey?: string; frame?: Format["frame"]; event?: { title: string; date: string | null } }) {
  const r = ratioFromSize(size);
  const m = mockupFor(formatKey, frame);
  // A full-screen phone needs no fixed size (the design is letterboxed); the other mocks do.
  const mock = m === "phone" || r ? m : null;
  const [inPlace, setInPlace] = useState(false);
  const flip = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); setInPlace((v) => !v); };

  return (
    <>
      <Layer on={!inPlace}><Plain src={src} r={r} frame={frame} /></Layer>
      {mock && <Layer on={inPlace} tall={PHONE_MOCKS.includes(mock)} bleed={mock === "calendar"}><InPlace mock={mock} src={src} r={r ?? SCREEN} event={event} crop /></Layer>}
      {mock && (
        <button type="button" onClick={flip} aria-pressed={inPlace} aria-label={inPlace ? "Show the design" : "Show it in place"}
          className={cn("absolute top-1/2 z-[1] flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-foreground shadow-[0_1px_4px_rgba(0,0,0,.18)] ring-1 ring-black/5 transition hover:bg-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", inPlace ? "left-2" : "right-2")}>
          <Icon name={inPlace ? "chevron_left" : "chevron_right"} className="!text-[20px]" />
        </button>
      )}
    </>
  );
}

/** One of the two stacked views, crossfaded. Leaves room for the badges above and below. */
function Layer({ on, tall, bleed, children }: { on: boolean; /** Narrow phone mocks clear the corner chips, so they start higher. */ tall?: boolean; /** Starts near the top and runs off the bottom edge of the tile, so the top of the mock is shown larger. */ bleed?: boolean; children: ReactNode }) {
  return (
    <div aria-hidden={!on} className={cn("absolute flex", bleed ? "inset-x-[11%] bottom-0 top-[14%] items-start justify-center md:top-[11%]" : cn(tall ? "inset-x-[24%] bottom-[30%] top-[6%] md:bottom-[22%]" : "inset-x-[10%] bottom-[26%] top-[16%] md:bottom-[22%] md:top-[12%]", "items-center justify-center"), "transition-[opacity,transform] duration-300 ease-out", on ? "opacity-100" : "pointer-events-none scale-[0.97] opacity-0")} style={{ containerType: "size" }}>
      {children}
    </div>
  );
}

/**
 * The same in-place mock, large, for the format page: fills a box up to 75% of the viewport height.
 * Returns null when the format has no mockup (or needs a fixed size it doesn't have).
 */
export function MockStage({ src, size, formatKey, frame, event }: { src: string; size: string; formatKey?: string; frame?: Format["frame"]; event?: { title: string; date: string | null } }) {
  const r = ratioFromSize(size); const m = mockupFor(formatKey, frame);
  if (!m || (m !== "phone" && !r)) return null;
  return (
    <div className="relative flex h-[min(75dvh,860px)] w-full items-center justify-center" style={{ containerType: "size" }}>
      <InPlace mock={m} src={src} r={r ?? SCREEN} event={event} />
    </div>
  );
}

/** True when a format has an in-place mock to show. */
export function hasMock(size: string, formatKey?: string, frame?: Format["frame"]) { const m = mockupFor(formatKey, frame); return !!m && (m === "phone" || !!ratioFromSize(size)); }

/** Largest box of ratio r that fits the layer. */
const fit = (r: number): CSSProperties => ({ width: `min(100cqw, ${r} * 100cqh)`, aspectRatio: String(r) });

function Plain({ src, r, frame }: { src: string; r: number | null; frame?: Format["frame"] }) {
  if (!r) return <img src={src} alt="" className={`max-h-full max-w-full rounded-[3px] object-contain ${LIFT}`} />;
  return <img src={src} alt="" style={fit(r)} className={cn("object-cover", LIFT, frame === "card" ? "rounded-[2cqmin]" : "rounded-[3px]", frame === "print" && "ring-1 ring-black/5")} />;
}

function InPlace({ mock, src, r, event, crop }: { mock: Mockup; src: string; r: number; event?: { title: string; date: string | null }; /** In a tile: let the mock run off the bottom edge (calendar only). */ crop?: boolean }) {
  if (mock === "tv") return (
    <div className="relative" style={fit(r)}>
      <div className="absolute inset-[6%] bottom-[14%]">
        <div className="absolute -inset-[1.4cqmin] rounded-[1.2cqmin] bg-neutral-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,.4)]" />
        <img src={src} alt="" className="relative size-full object-cover" />
        <span className="absolute left-1/2 top-[calc(100%+1.4cqmin)] h-[4cqmin] w-[2.5cqmin] -translate-x-1/2 bg-neutral-700" />
        <span className="absolute left-1/2 top-[calc(100%+5.4cqmin)] h-[1.4cqmin] w-[34%] -translate-x-1/2 rounded-full bg-neutral-800" />
      </div>
    </div>
  );
  if (mock === "led") return (
    <div className="relative" style={fit(r)}>
      <div className="absolute inset-x-[4%] bottom-[22%] top-[4%]">
        <div className="absolute -inset-[1cqmin] rounded-[0.6cqmin] bg-neutral-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,.4)]" />
        <img src={src} alt="" className="relative size-full object-cover" />
        <span className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(100%/6_-_1px),rgba(0,0,0,.35)_calc(100%/6_-_1px),rgba(0,0,0,.35)_calc(100%/6))]" />
        <span className="absolute left-[18%] top-[calc(100%+1cqmin)] h-[9cqmin] w-[1.4cqmin] bg-neutral-600" />
        <span className="absolute right-[18%] top-[calc(100%+1cqmin)] h-[9cqmin] w-[1.4cqmin] bg-neutral-600" />
      </div>
    </div>
  );
  if (mock === "browser") return <Browser src={src} r={r} />;
  if (mock === "print") return <Print src={src} r={r} />;
  if (mock === "youtube") return <YouTube src={src} />;
  if (mock === "calendar") return <CalendarPage src={src} crop={crop} />;
  return (
    <Phone>
      {mock === "phone" && <div className="flex size-full items-center justify-center bg-black"><img src={src} alt="" className="max-h-full max-w-full object-contain" /></div>}
      {mock === "igpost" && <InstagramPost src={src} r={r} />}
      {mock === "appcard" && <AppCard src={src} r={r} />}
      {mock === "instagram" && <Instagram src={src} />}
      {mock === "sambandh" && <Sambandh src={src} r={r} event={event} />}
    </Phone>
  );
}

/** A plain portrait phone: thin dark bezel, gently rounded corners. Children fill the screen; units are % of the screen (cqw/cqh). */
function Phone({ children }: { children: ReactNode }) {
  return (
    <div className="relative rounded-[3.5cqmin] bg-neutral-900 p-[1.4cqmin] shadow-[0_10px_28px_-10px_rgba(0,0,0,.5)]" style={fit(SCREEN)}>
      <div className="relative size-full overflow-hidden rounded-[2.2cqmin] bg-black" style={{ containerType: "size" }}>{children}</div>
    </div>
  );
}

const Lines = ({ widths, className }: { widths: number[]; className?: string }) => <div className={cn("space-y-[1.6cqw]", className)}>{widths.map((w, i) => <span key={i} className="block h-[1.8cqw] rounded-full bg-neutral-200" style={{ width: `${w}%` }} />)}</div>;

/** Website: a browser window with the banner as the hero under a simple nav, page content sketched below. */
function Browser({ src, r }: { src: string; r: number }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[1.4cqmin] bg-white shadow-[0_10px_28px_-10px_rgba(0,0,0,.4)] ring-1 ring-black/10" style={{ ...fit(1.5), containerType: "size" }}>
      <div className="flex h-[6cqh] shrink-0 items-center gap-[1cqw] bg-neutral-100 px-[2cqw]">
        {C.browserDots.map((c) => <span key={c} className="size-[1.4cqw] rounded-full" style={{ background: c }} />)}
        <span className="mx-auto h-[3cqh] w-[40%] rounded-full bg-white" />
      </div>
      <div className="flex h-[6cqh] shrink-0 items-center gap-[2cqw] px-[3cqw]"><span className="h-[2.4cqh] w-[10%] rounded-sm bg-neutral-300" /><span className="ml-auto h-[1.4cqh] w-[8%] rounded-full bg-neutral-200" /><span className="h-[1.4cqh] w-[8%] rounded-full bg-neutral-200" /><span className="h-[1.4cqh] w-[8%] rounded-full bg-neutral-200" /></div>
      <img src={src} alt="" className="w-full shrink-0 object-cover" style={{ aspectRatio: String(r) }} />
      <div className="grid flex-1 grid-cols-3 gap-[2cqw] p-[3cqw]">{[0, 1, 2].map((i) => <div key={i}><span className="block aspect-[4/3] rounded-[0.8cqw] bg-neutral-100" /><Lines widths={[90, 60]} className="mt-[1.4cqw]" /></div>)}</div>
    </div>
  );
}

/**
 * Wall calendar: the cover fills the picture area above the month page (a small compressed template,
 * /mockups/calendar-page.webp, kept in the repo). The picture area is 14.25 × 8.75 in, like the cover format.
 */
const CAL = { w: 1762, top: 1081, bottom: 919 };
function CalendarPage({ src, crop }: { src: string; crop?: boolean }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[1.2cqmin] bg-white shadow-[0_10px_28px_-10px_rgba(0,0,0,.4)] ring-1 ring-black/10" style={crop ? { width: "100cqw", aspectRatio: String(CAL.w / (CAL.top + CAL.bottom)), flexShrink: 0 } : fit(CAL.w / (CAL.top + CAL.bottom))}>
      <img src={src} alt="" className="w-full object-cover" style={{ aspectRatio: `${CAL.w} / ${CAL.top}` }} />
      <img src="/mockups/calendar-page.webp" alt="" className="w-full" style={{ aspectRatio: `${CAL.w} / ${CAL.bottom}` }} />
    </div>
  );
}

/** YouTube: the thumbnail as a video card in the feed, with a duration badge, channel avatar and title lines. */
function YouTube({ src }: { src: string }) {
  return (
    <div className="flex flex-col gap-[3cqw] rounded-[1.6cqmin] bg-white p-[3cqw] shadow-[0_10px_28px_-10px_rgba(0,0,0,.3)] ring-1 ring-black/5" style={{ ...fit(1.25), containerType: "size" }}>
      <div className="relative overflow-hidden rounded-[2.4cqw]" style={{ aspectRatio: "16 / 9" }}>
        <img src={src} alt="" className="size-full object-cover" />
        <span className="absolute bottom-[2cqw] right-[2cqw] rounded-[0.8cqw] bg-black/80 px-[1.2cqw] py-[0.4cqw] text-[3cqw] font-medium leading-none text-white">24:15</span>
      </div>
      <div className="flex gap-[2.5cqw]"><span className="size-[8cqw] shrink-0 rounded-full bg-neutral-300" /><div className="flex-1"><Lines widths={[95, 70]} /><Lines widths={[45]} className="mt-[2cqw] opacity-70" /></div></div>
    </div>
  );
}

/** Print: the sheet lying on a desk, slightly turned, with a soft shadow. */
function Print({ src, r }: { src: string; r: number }) {
  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-[1.6cqmin]" style={{ ...fit(1.33), containerType: "size", background: C.desk }}>
      <img src={src} alt="" className="-rotate-3 object-cover shadow-[0_2px_4px_rgba(0,0,0,.15),0_18px_30px_-12px_rgba(0,0,0,.45)]" style={{ width: `min(72cqw, ${r} * 72cqh)`, aspectRatio: String(r) }} />
    </div>
  );
}

/** Instagram feed post: account row, the post (cropped to Instagram's 4:5 at most), actions, likes, caption. */
function InstagramPost({ src, r }: { src: string; r: number }) {
  return (
    <div className="flex size-full flex-col bg-white text-neutral-900">
      <div className="h-[6.5cqh] shrink-0" />
      <div className="flex items-center gap-[2cqw] px-[3cqw] py-[2.5cqw] text-[3.6cqw] font-semibold leading-none">
        <span className="size-[8cqw] rounded-full p-[0.6cqw]" style={{ background: C.igRing }}><span className="block size-full rounded-full border-[0.6cqw] border-white bg-neutral-300" /></span>
        harisumiran<span className="ml-auto tracking-widest">···</span>
      </div>
      <img src={src} alt="" className="w-full object-cover" style={{ aspectRatio: String(Math.max(r, 0.8)) }} />
      <div className="flex items-center gap-[3.5cqw] px-[3cqw] py-[2.5cqw]">
        {["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z", "M21 3 10 14M21 3l-7 18-4-7-7-4z"].map((d) => <svg key={d} viewBox="0 0 24 24" className="size-[6cqw] fill-none stroke-neutral-900 stroke-2"><path d={d} /></svg>)}
        <svg viewBox="0 0 24 24" className="ml-auto size-[6cqw] fill-none stroke-neutral-900 stroke-2"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
      </div>
      <p className="px-[3cqw] text-[3.4cqw] font-semibold">1,248 likes</p>
      <Lines widths={[92, 70]} className="px-[3cqw] pt-[2cqw]" />
    </div>
  );
}

/** An app card: the design as a rounded card at the top of a feed. */
function AppCard({ src, r }: { src: string; r: number }) {
  return (
    <div className="flex size-full flex-col gap-[3cqw] bg-neutral-50 px-[4cqw]">
      <div className="h-[6.5cqh] shrink-0" />
      <p className="text-[6cqw] font-bold text-neutral-900">Glimpses</p>
      <div className="overflow-hidden rounded-[3cqw] bg-white shadow-sm"><img src={src} alt="" className="w-full object-cover" style={{ aspectRatio: String(r) }} /><Lines widths={[70, 45]} className="p-[3cqw]" /></div>
      <div className="overflow-hidden rounded-[3cqw] bg-white shadow-sm"><span className="block aspect-[5/3] bg-neutral-200" /><Lines widths={[60, 40]} className="p-[3cqw]" /></div>
    </div>
  );
}

/** Instagram story viewer: the 9:16 story under the status bar, progress, account row, reply bar. */
function Instagram({ src }: { src: string }) {
  return (
    <div className="flex size-full flex-col bg-black">
      <div className="h-[6.5cqh] shrink-0" />
      <div className="relative w-full overflow-hidden rounded-[3cqw]" style={{ aspectRatio: "9 / 16" }}>
        <img src={src} alt="" className="size-full object-cover" />
        <div className="absolute inset-x-[2.5cqw] top-[2cqw] flex gap-[1cqw]">{[1, 0.4, 0.4].map((o, i) => <span key={i} className="h-[0.8cqw] flex-1 rounded-full bg-white" style={{ opacity: o }} />)}</div>
        <div className="absolute left-[3cqw] top-[5.5cqw] flex items-center gap-[2cqw] text-[3.6cqw] font-semibold leading-none text-white [text-shadow:0_1px_2px_rgba(0,0,0,.4)]">
          <span className="size-[7cqw] rounded-full p-[0.6cqw]" style={{ background: C.igRing }}><span className="block size-full rounded-full border-[0.6cqw] border-black bg-neutral-300" /></span>
          harisumiran <span className="font-normal opacity-70">2h</span>
        </div>
      </div>
      <div className="flex flex-1 items-center gap-[3cqw] px-[3cqw]">
        <span className="flex h-[10cqw] flex-1 items-center rounded-full border border-white/40 px-[4cqw] text-[3.6cqw] text-white/80">Send message</span>
        <svg viewBox="0 0 24 24" className="size-[6cqw] fill-none stroke-white stroke-2"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
        <svg viewBox="0 0 24 24" className="size-[6cqw] fill-none stroke-white stroke-2"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" /></svg>
      </div>
    </div>
  );
}

/** Sambandh app event page: hero design on top, title, date, invite text, "I will attend". */
function Sambandh({ src, r, event }: { src: string; r: number; event?: { title: string; date: string | null } }) {
  const date = event?.date ? format(new Date(event.date + "T00:00:00"), "MMM d, yyyy") : null;
  return (
    <div className="relative flex size-full flex-col bg-white">
      <div className="relative w-full shrink-0" style={{ aspectRatio: String(r) }}>
        <img src={src} alt="" className="size-full object-cover" />
        {[["left-[4cqw]", "M15 18l-6-6 6-6"], ["right-[4cqw]", "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"]].map(([pos, d]) => (
          <span key={pos} className={`absolute top-[11cqw] flex size-[10cqw] items-center justify-center rounded-full bg-white shadow ${pos}`}>
            <svg viewBox="0 0 24 24" className="size-[5cqw] fill-none stroke-neutral-800 stroke-[2.5]"><path d={d} /></svg>
          </span>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-[6cqw] pt-[5cqw]">
        <p className="line-clamp-2 text-[6.5cqw] font-bold leading-[1.15]" style={{ color: C.sambandhInk }}>{event?.title ?? "Event title"}</p>
        {date && <p className="mt-[1cqw] text-[4.2cqw] font-medium" style={{ color: C.sambandhDate }}>{date}</p>}
        <div className="mt-[4cqw] space-y-[2.2cqw]">{[100, 92, 96, 70].map((w) => <span key={w} className="block h-[2.4cqw] rounded-full bg-neutral-200" style={{ width: `${w}%` }} />)}</div>
      </div>
      <div className="shrink-0 border-t border-neutral-200 px-[6cqw] pb-[6cqw] pt-[3cqw]">
        <span className="flex h-[11cqw] items-center justify-center rounded-full text-[4.2cqw] font-bold text-white" style={{ background: C.sambandhCta }}>I will attend</span>
      </div>
    </div>
  );
}
