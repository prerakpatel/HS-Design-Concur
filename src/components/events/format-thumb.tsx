import type { CSSProperties } from "react";
import { ratioFromSize } from "@/lib/aspect";
import type { Format } from "@/lib/types";

export type FrameKind = Format["frame"];
const ANIMATED: FrameKind[] = ["phone", "tv", "led"];

/**
 * The asset at its own aspect ratio inside a format tile, never cropped by the tile.
 * Phone, TV and LED formats slowly fade into a minimal device frame and back, so you get a feel
 * for where the design will live. Sizes use container units, so frames scale with the tile.
 */
export function FormatThumb({ src, size, frame = "flat", index = 0 }: { src: string; size: string; frame?: FrameKind; index?: number }) {
  const r = ratioFromSize(size);
  const animated = r != null && ANIMATED.includes(frame);
  // A gentle wave across the grid instead of every tile switching at once.
  const delay: CSSProperties = { animationDelay: `${-index * 0.7}s` };

  if (!r) return (
    <div className="absolute inset-x-[10%] bottom-[26%] top-[16%] md:bottom-[22%] md:top-[12%] flex items-center justify-center">
      <img src={src} alt="" className="max-h-full max-w-full rounded-[3px] object-contain shadow-[0_1px_3px_rgba(0,0,0,.12),0_6px_16px_-6px_rgba(0,0,0,.18)]" />
    </div>
  );

  const box: CSSProperties = { width: `min(100cqw, ${r} * 100cqh)`, aspectRatio: String(r) };
  const radius = frame === "phone" ? "rounded-[2.4cqmin]" : frame === "card" ? "rounded-[1.6cqmin]" : "rounded-[3px]";
  const paper = frame === "print" ? "ring-1 ring-black/5" : "";

  return (
    <div className="absolute inset-x-[10%] bottom-[26%] top-[16%] md:bottom-[22%] md:top-[12%] flex items-center justify-center" style={{ containerType: "size" }}>
      <div className={animated ? "frame-body relative" : "relative"} style={animated ? { ...box, ...delay } : box}>
        {animated && <Bezel frame={frame} style={delay} />}
        <img src={src} alt="" className={`relative size-full object-cover ${radius} ${paper} ${animated ? "" : "shadow-[0_1px_3px_rgba(0,0,0,.12),0_8px_20px_-8px_rgba(0,0,0,.22)]"}`} />
        {animated && frame === "phone" && <span className="frame-bezel absolute left-1/2 top-[1.8cqmin] h-[2.6cqmin] w-[26%] -translate-x-1/2 rounded-full bg-neutral-950" style={delay} />}
        {animated && frame === "led" && <span className="frame-bezel pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(100%/6_-_1px),rgba(0,0,0,.35)_calc(100%/6_-_1px),rgba(0,0,0,.35)_calc(100%/6))]" style={delay} />}
      </div>
    </div>
  );
}

/** The device around the asset: drawn behind it, outside its box, faded in and out. */
function Bezel({ frame, style }: { frame: FrameKind; style: CSSProperties }) {
  if (frame === "phone") return <span className="frame-bezel absolute -inset-[3cqmin] rounded-[6cqmin] bg-neutral-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,.45)] ring-1 ring-white/10" style={style} />;
  if (frame === "tv") return (
    <span className="frame-bezel absolute -inset-[1.4cqmin]" style={style}>
      <span className="absolute inset-0 rounded-[1.2cqmin] bg-neutral-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,.4)]" />
      <span className="absolute left-1/2 top-full h-[4cqmin] w-[2.5cqmin] -translate-x-1/2 bg-neutral-700" />
      <span className="absolute left-1/2 top-[calc(100%+4cqmin)] h-[1.4cqmin] w-[34%] -translate-x-1/2 rounded-full bg-neutral-800" />
    </span>
  );
  // LED wall: thin dark casing on two posts.
  return (
    <span className="frame-bezel absolute -inset-[1cqmin]" style={style}>
      <span className="absolute inset-0 rounded-[0.6cqmin] bg-neutral-900 shadow-[0_8px_24px_-8px_rgba(0,0,0,.4)]" />
      <span className="absolute left-[18%] top-full h-[9cqmin] w-[1.4cqmin] bg-neutral-600" />
      <span className="absolute right-[18%] top-full h-[9cqmin] w-[1.4cqmin] bg-neutral-600" />
    </span>
  );
}
