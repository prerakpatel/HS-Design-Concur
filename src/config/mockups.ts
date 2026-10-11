import type { Format } from "@/lib/types";

/** How a format's tile can be previewed "in place" on the event page. */
export type Mockup = "phone" | "instagram" | "sambandh" | "tv" | "led";

/** Formats with a dedicated mock screen, by format key. Everything else follows its frame. */
const BY_KEY: Record<string, Mockup> = { mobile: "phone", ig_story: "instagram", sambandh_event: "sambandh" };

export function mockupFor(key: string | undefined, frame: Format["frame"] | undefined): Mockup | null {
  if (key && BY_KEY[key]) return BY_KEY[key];
  if (key?.startsWith("mobile")) return "phone"; // "Mobile" also exists as a custom-size format (mobile_2)
  return frame === "phone" || frame === "tv" || frame === "led" ? frame : null;
}

/** Third-party UI colours used only inside the mock screens (not app tokens). */
export const MOCK_COLORS = {
  igRing: "conic-gradient(#feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5, #feda75)",
  sambandhInk: "#2b3a4a",
  sambandhDate: "#c2502e",
  sambandhCta: "#f45c55",
};
