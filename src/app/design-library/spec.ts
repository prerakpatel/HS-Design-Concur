import { TOKENS, TOKENS_CSS } from "@/config/design-tokens";
import { ICON_NAMES } from "@/config/icons";
import type { BadgeState } from "@/components/state-badge";
import { SLOT_STATE_LABEL } from "@/lib/types";

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

export const PRINCIPLES = [
  { icon: "image", title: "Quiet surfaces", text: "White pages, hairline borders, almost no shadows. The artwork people are reviewing is the loudest thing on screen." },
  { icon: "check_circle", title: "One primary action", text: "Each screen has a single ink-navy button for the next step. Everything else is outline or ghost." },
  { icon: "auto_awesome", title: "Coral is an accent", text: "The brand coral marks what needs you: unread dots, counts, the Primary tag. It is never a page or button fill." },
  { icon: "rule", title: "State is a tinted badge", text: "A soft tint with text in the dark shade of the same hue, so status reads at a glance and stays legible." },
  { icon: "devices", title: "Phone first", text: "Controls are 40 to 48 px tall, dialogs become bottom drawers, and media runs edge to edge on small screens." },
  { icon: "edit_note", title: "Plain words", text: "Short sentences, no jargon, sentence case. Empty states say what will appear there and why." },
];

export type Sw = { token: string; cls: string; use: string; bordered?: boolean };
export const COLOURS: { title: string; note: string; items: Sw[] }[] = [
  { title: "Brand and action", note: "Navy does the work, coral draws the eye.", items: [
    { token: "primary", cls: "bg-primary", use: "Primary buttons, focus ring, links" },
    { token: "brand", cls: "bg-brand", use: "Accent: unread dots, counts, Primary tag" },
    { token: "brand-hover", cls: "bg-brand-hover", use: "Coral on hover or press" },
    { token: "brand-soft", cls: "bg-brand-soft", use: "Avatars, the Needs you badge" },
    { token: "brand-soft-foreground", cls: "text-brand-soft-foreground", use: "Text on brand-soft" },
    { token: "inverse-surface", cls: "bg-inverse-surface", use: "Toasts and floating prompts" },
  ] },
  { title: "Surfaces", note: "Layered greys that separate areas without lines where possible.", items: [
    { token: "background", cls: "bg-background", use: "The page", bordered: true },
    { token: "card", cls: "bg-card", use: "Inputs, pills, raised panels", bordered: true },
    { token: "subtle", cls: "bg-subtle", use: "Row hover, code, quiet panels", bordered: true },
    { token: "muted", cls: "bg-muted", use: "Icon discs, secondary buttons, skeletons", bordered: true },
    { token: "muted-strong", cls: "bg-muted-strong", use: "Progress tracks, placeholder bars" },
    { token: "sidebar", cls: "bg-sidebar", use: "Desktop sidebar and bars", bordered: true },
  ] },
  { title: "Text and lines", note: "Three text strengths and one hairline.", items: [
    { token: "foreground", cls: "text-foreground", use: "Headings and body text" },
    { token: "sidebar-foreground", cls: "text-sidebar-foreground", use: "Navigation and secondary labels" },
    { token: "muted-foreground", cls: "text-muted-foreground", use: "Meta lines, helper text, placeholders" },
    { token: "border", cls: "border-border", use: "Every hairline and divider" },
    { token: "input", cls: "border-input", use: "Field outlines" },
    { token: "ring", cls: "ring-ring", use: "Keyboard focus ring (at 50%)" },
  ] },
];

export const STATUS: { name: string; solid: string; soft: string; text: string; means: string }[] = [
  { name: "Info", solid: "info", soft: "info-soft", text: "info-text", means: "In review, neutral notices" },
  { name: "Success", solid: "success", soft: "success-soft", text: "success-text", means: "Approved, done, progress" },
  { name: "Warning", solid: "warning", soft: "warning-soft", text: "warning-text", means: "Draft, not sent yet, take care" },
  { name: "Destructive", solid: "destructive", soft: "destructive-soft", text: "destructive-text", means: "Changes requested, delete, errors" },
];

export const STATES: { state: BadgeState; when: string }[] = [
  { state: "requested", when: "Asked for, nothing uploaded yet" },
  { state: "unsent", when: "Uploaded but not sent for review" },
  { state: "in_review", when: "Waiting on an approver" },
  { state: "changes_requested", when: "Sent back with comments" },
  { state: "approved", when: "Signed off" },
  { state: "needs_you", when: "The viewer has to act" },
  { state: "draft", when: "An event still being set up" },
  { state: "na", when: "Not needed for this event" },
];

export const BUTTONS = [
  { variant: "default", name: "Primary", use: "The one next step on a screen" },
  { variant: "outline", name: "Outline", use: "Everyday actions beside the primary" },
  { variant: "secondary", name: "Secondary", use: "A quiet filled alternative" },
  { variant: "ghost", name: "Ghost", use: "Cancel, and actions inside toolbars" },
  { variant: "destructive", name: "Destructive", use: "Delete and other one-way actions" },
  { variant: "link", name: "Link", use: "Inline navigation in a sentence" },
] as const;


/** The habits that give the feel, beyond the token values. */
export const HABITS = [
  "Use the named colours (bg-brand-soft, text-muted-foreground), never a hex value in a component.",
  "One primary (navy) button per screen; outline or ghost for the rest.",
  "Coral only as an accent: unread dots, counts, the Primary tag. Status only through tinted badges.",
  "Lists are rows divided by hairlines, not boxed cards. Empty states are a dashed outline with one or two plain sentences.",
  "Controls are 40 px or taller, form fields 44 px. Dialogs become bottom drawers on phones.",
  "Sentence case everywhere. Buttons name the action (Delete event), never OK or Yes.",
  "Borders separate things; shadows are only for what floats (menus, sheets, prompts).",
  "Entrances ease out in 0.3 to 0.4 s; every animation is off under prefers-reduced-motion.",
];

/** The whole system as one Markdown brief, for pasting into another project or handing to an AI assistant. */
export function designSystemMarkdown() {
  const L: string[] = [];
  L.push("# Design & Concur by Harisumiran: design system", "", "Match this system exactly. Stack: Next.js (App Router), Tailwind CSS v4, shadcn/ui (Radix). Light theme only.", "");
  L.push("## Principles", ...PRINCIPLES.map((p) => `- **${p.title}.** ${p.text}`), "");
  L.push("## Colour tokens", "Use through Tailwind classes; never raw hex in components.", "");
  for (const g of COLOURS) L.push(`### ${g.title}`, ...g.items.map((i) => `- \`${i.token}\` ${TOKENS[i.token]} (\`${i.cls}\`): ${i.use}`), "");
  L.push("### Status (soft background, dark text of the same hue, solid for icons)", ...STATUS.map((s) => `- ${s.name}: \`${s.soft}\` ${TOKENS[s.soft]}, \`${s.text}\` ${TOKENS[s.text]}, \`${s.solid}\` ${TOKENS[s.solid]}. ${s.means}.`), "");
  L.push("## Typography", `Font: Google Sans Flex (Google Fonts). Stack: ${TOKENS["font-sans"]}. Weights 400, 500, 600.`, "", ...TYPE_SCALE.map((t) => `- **${t.name}**: ${t.px}/${t.line} px, weight ${t.weight}${t.tracking ? `, tracking ${t.tracking}` : ""}. \`${t.cls}\`. ${t.use}`), "");
  L.push("## Icons", "Material Symbols Rounded as a ligature font (class `msr`, see CSS). 20 px inline, 24 px for navigation; outline by default, filled for selected or unread.", "", "```tsx", `export function Icon({ name, size = 20, fill = false, className }: { name: string; size?: 20 | 24; fill?: boolean; className?: string }) {\n  return <span aria-hidden className={"msr " + (className ?? "")} data-size={size} data-fill={fill ? "1" : "0"}>{name}</span>;\n}`, "```", "", `Icons in use: ${ICON_NAMES.join(", ")}.`, "");
  L.push("## Corner radius", ...RADII.map((r) => `- \`${r.cls}\` ${r.px === null ? "pill" : `${r.px} px`}: ${r.use}`), "");
  L.push("## Spacing and size", "- 4 px grid (Tailwind default scale). Common gaps: 4, 8, 12, 16, 24, 32, 48 px.", "- Buttons: 28 (xs), 32 (sm), 40 (default), 48 (lg) px tall, 10 px corners; icon-only buttons are round.", "- Fields: 44 px tall, white surface, 1 px `input` outline, navy focus ring at 50%. Label above, 8 px gap, helper text below in 12 px muted.", "");
  L.push("## Buttons", ...BUTTONS.map((b) => `- **${b.name}** (\`variant="${b.variant}"\`): ${b.use}`), "");
  L.push("## State badges", "Pill, 24 px tall, 12 px medium text.", ...STATES.map((s) => `- ${SLOT_STATE_LABEL[s.state]} (\`${s.state}\`): ${s.when}`), "");
  L.push("## Patterns", "- List row: `divide-y divide-border`; each row `flex items-center gap-4 rounded-xl px-3 py-3.5 hover:bg-subtle` with a 40 px `bg-muted` icon disc, two lines of 14 px text (second line muted), and a 10 px coral dot when unread.", "- Empty state: `rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground`.", "- Page header: optional back pill, 24 px semibold title (26 px from 768 px up), one muted 14 px line, actions on the right.", "- Avatar: initials on a `brand-soft` disc with `brand-soft-foreground` text; photo on top when there is one. Organizations are rounded squares.", "- Toast: dark `inverse-surface` bar at the bottom left, 14 px corners, 15 px medium text; the icon carries the status colour.", "- Layout: sidebar from 768 px up, bottom tab bar on phones, a single content column.", "");
  L.push("## Habits", ...HABITS.map((h) => `- ${h}`), "");
  L.push("## Fonts to load", "```html", '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,300..800&display=swap" />', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" />', "```", "");
  L.push("## globals.css (paste as is)", "```css", TOKENS_CSS.trim(), "```", "");
  return L.join("\n");
}
