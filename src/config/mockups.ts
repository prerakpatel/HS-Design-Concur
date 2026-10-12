import type { Format } from "@/lib/types";

/** How a format's tile can be previewed "in place" on the event page. */
export type Mockup = "phone" | "instagram" | "sambandh" | "tv" | "led" | "igpost" | "browser" | "print" | "appcard" | "youtube";

/** Mocks drawn inside a portrait phone (they need the tall layout in a tile). */
export const PHONE_MOCKS: Mockup[] = ["phone", "instagram", "sambandh", "igpost", "appcard"];

/** Formats with a dedicated mock screen, by format key. Everything else follows its frame, so every format has one. */
const BY_KEY: Record<string, Mockup> = { mobile: "phone", ig_story: "instagram", ig_post: "igpost", sambandh_event: "sambandh", youtube_thumb: "youtube" };

export function mockupFor(key: string | undefined, frame: Format["frame"] | undefined): Mockup | null {
  if (key && BY_KEY[key]) return BY_KEY[key];
  if (key?.startsWith("mobile")) return "phone"; // "Mobile" also exists as a custom-size format (mobile_2)
  if (frame === "phone" || frame === "tv" || frame === "led") return frame;
  if (frame === "print") return "print";
  if (frame === "card") return "appcard";
  if (key?.startsWith("ig_")) return "igpost";
  if (key?.includes("youtube")) return "youtube";
  return "browser"; // flat: website banners and anything else shown on a screen
}

/** Third-party UI colours used only inside the mock screens (not app tokens). */
export const MOCK_COLORS = {
  igRing: "conic-gradient(#feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5, #feda75)",
  sambandhInk: "#2b3a4a",
  sambandhDate: "#c2502e",
  sambandhCta: "#f45c55",
  browserDots: ["#ff5f57", "#febc2e", "#28c840"],
  desk: "radial-gradient(ellipse at 30% 20%, #f1ede6, #ddd6cb)",
};
