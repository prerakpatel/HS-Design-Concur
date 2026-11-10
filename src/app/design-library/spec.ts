import { TOKENS } from "@/config/design-tokens";

/** Radius steps as Tailwind works them out from --radius (globals.css @theme). `px: null` is the full pill. */
const BASE = parseFloat(TOKENS.radius) * 16;
const step = (k: number) => Math.round(BASE * k * 10) / 10;
export const RADII: { name: string; cls: string; px: number | null; use: string }[] = [
  { name: "sm", cls: "rounded-sm", px: step(0.6), use: "Tiny marks, thumbnails in a row" },
  { name: "md", cls: "rounded-md", px: step(0.8), use: "Menu items, small org marks" },
  { name: "lg", cls: "rounded-lg", px: step(1), use: "Buttons, inputs, selects" },
  { name: "xl", cls: "rounded-xl", px: step(1.4), use: "Large buttons, list rows on hover, swatches" },
  { name: "2xl", cls: "rounded-2xl", px: step(1.8), use: "Dialogs, panels, empty states, cards" },
  { name: "3xl", cls: "rounded-3xl", px: step(2.2), use: "Sheets that slide over a picture, the loader card" },
  { name: "full", cls: "rounded-full", px: null, use: "Pills, badges, avatars, icon buttons" },
];

/** The type scale as the app uses it. Sizes in px. */
export const TYPE_SCALE: { name: string; cls: string; px: number; line: number; weight: number; tracking?: string; use: string; sample: string }[] = [
  { name: "Page title", cls: "text-[24px] leading-8 font-semibold tracking-[-0.02em] md:text-[26px] md:leading-9", px: 24, line: 32, weight: 600, tracking: "-0.02em", use: "One per page. 26 / 36 from tablet up.", sample: "Diwali Annakut 2026" },
  { name: "Section title", cls: "text-lg leading-7 font-semibold tracking-[-0.01em]", px: 18, line: 28, weight: 600, tracking: "-0.01em", use: "Headings inside a page, dialog titles.", sample: "Formats" },
  { name: "Body large", cls: "text-base leading-6", px: 16, line: 24, weight: 400, use: "Short lead lines and roomy reading text.", sample: "Upload the first version when it is ready." },
  { name: "Body", cls: "text-sm leading-5", px: 14, line: 20, weight: 400, use: "The default for almost everything: rows, forms, buttons.", sample: "Instagram post · due Friday" },
  { name: "Body strong", cls: "text-sm leading-5 font-medium", px: 14, line: 20, weight: 500, use: "Names, labels, unread rows, button text.", sample: "Needs your review" },
  { name: "Control small", cls: "text-[13px] leading-4 font-medium", px: 13, line: 16, weight: 500, use: "Small buttons and small choice chips.", sample: "Send for review" },
  { name: "Caption", cls: "text-xs leading-4", px: 12, line: 16, weight: 400, use: "Badges, meta lines, helper text.", sample: "v2 · uploaded 3 hours ago" },
  { name: "Micro", cls: "text-[11px] leading-none font-semibold", px: 11, line: 11, weight: 600, use: "Count bubbles and tiny tags only.", sample: "12" },
];
