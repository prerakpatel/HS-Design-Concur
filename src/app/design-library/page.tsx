import type { Metadata } from "next";
import { TOKENS } from "@/config/design-tokens";
import { ICON_NAMES } from "@/config/icons";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/material-icon";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { UserAvatar } from "@/components/user-avatar";
import { OrgMark } from "@/components/org-mark";
import { RoleChips } from "@/components/role-chips";
import { InfoTip } from "@/components/info-tip";
import { AspectIcon } from "@/components/aspect-icon";
import { CountBubble } from "@/components/unread-count";
import { BackLink, PageHeader, SectionHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateField } from "@/components/ui/date-field";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Code, Copy, IconGallery, OverlayDemos, Replay, Swatch, ToastDemo } from "./demos";
import { RADII, TYPE_SCALE } from "./spec";

// A public page: anyone with the link can read it, no sign-in. It shows the real tokens and the real components with
// made-up sample content, and never reads the database. Kept out of search engines; share it by link.
export const metadata: Metadata = {
  title: "Design library",
  description: "The design system behind Design & Concur by Harisumiran: colours, type, icons, components and patterns, ready to reuse.",
  robots: { index: false, follow: false },
};

const NAV = [
  ["principles", "Principles"], ["colour", "Colour"], ["type", "Typography"], ["icons", "Icons"], ["shape", "Shape and space"], ["motion", "Motion"],
  ["buttons", "Buttons"], ["badges", "Badges and chips"], ["forms", "Forms"], ["people", "People and orgs"], ["layout", "Page layout"], ["lists", "Lists and states"],
  ["overlays", "Overlays and toasts"], ["brand", "Brand marks"], ["reuse", "Use it in another app"],
] as const;

const PRINCIPLES = [
  { icon: "image", title: "Quiet surfaces", text: "White pages, hairline borders, almost no shadows. The artwork people are reviewing is the loudest thing on screen." },
  { icon: "check_circle", title: "One primary action", text: "Each screen has a single ink-navy button for the next step. Everything else is outline or ghost." },
  { icon: "auto_awesome", title: "Coral is an accent", text: "The brand coral marks what needs you: unread dots, counts, the Primary tag. It is never a page or button fill." },
  { icon: "rule", title: "State is a tinted badge", text: "A soft tint with text in the dark shade of the same hue, so status reads at a glance and stays legible." },
  { icon: "devices", title: "Phone first", text: "Controls are 40 to 48 px tall, dialogs become bottom drawers, and media runs edge to edge on small screens." },
  { icon: "edit_note", title: "Plain words", text: "Short sentences, no jargon, sentence case. Empty states say what will appear there and why." },
];

type Sw = { token: string; cls: string; use: string; bordered?: boolean };
const COLOURS: { title: string; note: string; items: Sw[] }[] = [
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

const STATUS: { name: string; solid: string; soft: string; text: string; means: string }[] = [
  { name: "Info", solid: "info", soft: "info-soft", text: "info-text", means: "In review, neutral notices" },
  { name: "Success", solid: "success", soft: "success-soft", text: "success-text", means: "Approved, done, progress" },
  { name: "Warning", solid: "warning", soft: "warning-soft", text: "warning-text", means: "Draft, not sent yet, take care" },
  { name: "Destructive", solid: "destructive", soft: "destructive-soft", text: "destructive-text", means: "Changes requested, delete, errors" },
];

/** WCAG contrast ratio of two hex colours. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const grade = (r: number) => (r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "Large text and icons only" : "Decorative only");

const PAIRS: { label: string; fg: string; bg: string }[] = [
  { label: "Body text on the page", fg: "foreground", bg: "background" },
  { label: "Muted text on the page", fg: "muted-foreground", bg: "background" },
  { label: "Primary button", fg: "primary-foreground", bg: "primary" },
  { label: "Coral accent with white", fg: "brand-foreground", bg: "brand" },
  { label: "Avatar and Needs you", fg: "brand-soft-foreground", bg: "brand-soft" },
  { label: "Toast", fg: "inverse-on-surface", bg: "inverse-surface" },
  ...STATUS.map((s) => ({ label: `${s.name} badge`, fg: s.text, bg: s.soft })),
];

const STATES: { state: BadgeState; when: string }[] = [
  { state: "requested", when: "Asked for, nothing uploaded yet" },
  { state: "unsent", when: "Uploaded but not sent for review" },
  { state: "in_review", when: "Waiting on an approver" },
  { state: "changes_requested", when: "Sent back with comments" },
  { state: "approved", when: "Signed off" },
  { state: "needs_you", when: "The viewer has to act" },
  { state: "draft", when: "An event still being set up" },
  { state: "na", when: "Not needed for this event" },
];

const BUTTONS = [
  { variant: "default", name: "Primary", use: "The one next step on a screen" },
  { variant: "outline", name: "Outline", use: "Everyday actions beside the primary" },
  { variant: "secondary", name: "Secondary", use: "A quiet filled alternative" },
  { variant: "ghost", name: "Ghost", use: "Cancel, and actions inside toolbars" },
  { variant: "destructive", name: "Destructive", use: "Delete and other one-way actions" },
  { variant: "link", name: "Link", use: "Inline navigation in a sentence" },
] as const;

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-border py-12 lg:scroll-mt-8">
      <h2 className="text-[24px] font-semibold leading-8 tracking-[-0.02em]">{title}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{intro}</p>
      <div className="mt-8 space-y-10">{children}</div>
    </section>
  );
}

function Block({ title, note, code, plain, children }: { title: string; note?: string; code?: string; plain?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="text-lg font-semibold leading-7 tracking-[-0.01em]">{title}</h3>
      {note && <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">{note}</p>}
      <div className={cn("mt-4", !plain && "rounded-2xl border border-border p-5 sm:p-6")}>{children}</div>
      {code && <div className="mt-3"><Code code={code} /></div>}
    </div>
  );
}

const Spec = ({ children }: { children: React.ReactNode }) => <span className="font-mono text-xs text-muted-foreground">{children}</span>;

export default function DesignLibraryPage() {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <header className="pb-10 pt-10 sm:pt-14">
          <div className="flex items-center gap-3">
            <img src="/brand/logo-mark.png" alt="" className="size-11 object-contain" />
            <p className="text-sm font-medium text-muted-foreground">Design &amp; Concur by Harisumiran</p>
          </div>
          <h1 className="mt-6 text-[32px] font-semibold leading-10 tracking-[-0.02em] sm:text-[40px] sm:leading-[48px]">Design library</h1>
          <p className="mt-3 max-w-2xl text-base leading-6 text-muted-foreground">The colours, type, icons, components and patterns the app is built from. Everything on this page is the real thing, drawn from the same code and tokens as the app, so it can be copied into the next one.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild><a href="#reuse">Use it in another app</a></Button>
            <Button asChild variant="outline"><a href="/design-library/tokens.css" download="design-concur-tokens.css"><Icon name="download" className="!text-[18px]" />tokens.css</a></Button>
            <Button asChild variant="outline"><a href="/design-library/tokens.json" download="design-concur-tokens.json"><Icon name="download" className="!text-[18px]" />tokens.json</a></Button>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
          <nav aria-label="Sections" className="sticky top-0 z-20 -mx-5 border-y border-border bg-background/90 px-5 py-2.5 backdrop-blur sm:-mx-8 sm:px-8 lg:top-8 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
              {NAV.map(([id, label]) => <li key={id} className="shrink-0"><a href={`#${id}`} className="block rounded-full px-3 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-muted hover:text-foreground lg:rounded-lg">{label}</a></li>)}
            </ul>
          </nav>

          <main className="min-w-0 pb-24">
            <Section id="principles" title="Principles" intro="Six ideas that decide most questions before they come up.">
              <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
                {PRINCIPLES.map((p) => (
                  <li key={p.title}>
                    <span className="flex size-10 items-center justify-center rounded-full bg-muted"><Icon name={p.icon} /></span>
                    <h3 className="mt-3 text-sm font-medium">{p.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{p.text}</p>
                  </li>
                ))}
              </ul>
            </Section>

            <Section id="colour" title="Colour" intro="Colours are named by what they do, not what they look like. Components use these names through Tailwind (bg-brand-soft, text-info-text) and never a raw hex value. Press a swatch to copy its class.">
              {COLOURS.map((g) => (
                <Block key={g.title} title={g.title} note={g.note} plain>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 xl:grid-cols-6">{g.items.map((s) => <Swatch key={s.token} {...s} value={TOKENS[s.token]} />)}</div>
                </Block>
              ))}

              <Block title="Status" note="Each status has three shades: a soft tint for the background, a dark shade of the same hue for text on that tint, and a solid for icons and bars." plain>
                <div className="grid gap-3 sm:grid-cols-2">
                  {STATUS.map((s) => (
                    <div key={s.name} className="overflow-hidden rounded-2xl border border-border">
                      <div className="flex items-center justify-between gap-3 px-4 py-5" style={{ background: `var(--${s.soft})`, color: `var(--${s.text})` }}>
                        <span><span className="block text-sm font-medium">{s.name}</span><span className="block text-xs">{s.means}</span></span>
                        <span className="size-8 shrink-0 rounded-full" style={{ background: `var(--${s.solid})` }} />
                      </div>
                      <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
                        {[s.soft, s.text, s.solid].map((t) => <Copy key={t} value={`bg-${t}`} className="px-1 py-2 !text-center hover:bg-subtle"><span className="block truncate text-xs font-medium">{t}</span><Spec>{TOKENS[t]}</Spec></Copy>)}
                      </div>
                    </div>
                  ))}
                </div>
              </Block>

              <Block title="Contrast" note="Worked out from the token values above, against the WCAG 2 thresholds (4.5 : 1 for normal text, 3 : 1 for large text and icons)." plain>
                <ul className="divide-y divide-border">
                  {PAIRS.map((p) => { const r = contrast(TOKENS[p.fg], TOKENS[p.bg]); return (
                    <li key={p.label} className="flex items-center gap-4 py-3">
                      <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ring-1 ring-inset ring-border" style={{ background: `var(--${p.bg})`, color: `var(--${p.fg})` }}>Aa</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{p.label}</span><span className="block truncate text-xs text-muted-foreground">{p.fg} on {p.bg}</span></span>
                      <span className="shrink-0 text-right"><span className="block text-sm font-medium tabular-nums">{r.toFixed(1)} : 1</span><span className={cn("block text-xs", r >= 4.5 ? "text-success-text" : "text-warning-text")}>{grade(r)}</span></span>
                    </li>
                  ); })}
                </ul>
              </Block>

              <Block title="Comment colours" note="The five colours people can use to highlight words in a comment. Not used for interface elements.">
                <div className="flex flex-wrap gap-5">
                  {["red", "blue", "green", "yellow", "gray"].map((c) => (
                    <span key={c} className="flex items-center gap-2 text-sm"><span className="size-6 rounded-full" style={{ background: `var(--comment-${c})` }} /><span><span className="block font-medium capitalize">{c}</span><Spec>{TOKENS[`comment-${c}`]}</Spec></span></span>
                  ))}
                </div>
              </Block>
            </Section>

            <Section id="type" title="Typography" intro="One family, Google Sans Flex, in three weights: regular 400 for reading, medium 500 for anything that should stand out, semibold 600 for headings. 14 px is the default size; most of the app is set in it.">
              <Block title="Scale" plain>
                <ul className="divide-y divide-border">
                  {TYPE_SCALE.map((t) => (
                    <li key={t.name} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center">
                      <p className="min-w-0 truncate" style={{ fontSize: t.px, lineHeight: `${t.line === t.px ? t.px + 4 : t.line}px`, fontWeight: t.weight, letterSpacing: t.tracking }}>{t.sample}</p>
                      <Copy value={t.cls} label={`${t.name} classes`} className="rounded-lg"><span className="block text-sm font-medium">{t.name}</span><Spec>{t.px} / {t.line} · {t.weight}{t.tracking ? ` · ${t.tracking}` : ""}</Spec><span className="block text-xs text-muted-foreground">{t.use}</span></Copy>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="Writing" note="How the words sit in the type.">
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6">
                  <li>Sentence case everywhere, including buttons and headings: <span className="font-medium">Send for review</span>, not Send For Review.</li>
                  <li>Buttons name the action (<span className="font-medium">Delete event</span>), never just OK or Yes.</li>
                  <li>Meta lines join facts with a middle dot: <span className="text-muted-foreground">v2 · uploaded 3 hours ago</span>.</li>
                  <li>Numbers that change or line up use tabular figures (<Spec>tabular-nums</Spec>).</li>
                </ul>
              </Block>
            </Section>

            <Section id="icons" title="Icons" intro="Material Symbols Rounded, drawn as a font so an icon is just its name. Two sizes, 20 px inline and 24 px for navigation, outline by default and filled for the selected or unread state. Press an icon to copy its name.">
              <Block title="Sizes and fill" code={`<Icon name="notifications" />              // 20 px, outline\n<Icon name="notifications" size={24} fill />  // 24 px, filled: selected or unread`}>
                <div className="flex flex-wrap items-end gap-8">
                  {([[20, false], [20, true], [24, false], [24, true]] as const).map(([size, fill]) => (
                    <span key={`${size}${fill}`} className="flex flex-col items-center gap-2"><Icon name="notifications" size={size} fill={fill} /><Spec>{size}{fill ? " filled" : ""}</Spec></span>
                  ))}
                  <span className="flex flex-col items-center gap-2"><span className="flex size-10 items-center justify-center rounded-full bg-muted"><Icon name="event" /></span><Spec>in a 40 disc</Spec></span>
                </div>
              </Block>
              <Block title="The set" note="Only these glyphs are downloaded, which keeps the icon font to a few kilobytes. Any other Material Symbol can be added by name." plain>
                <IconGallery names={ICON_NAMES} />
              </Block>
            </Section>

            <Section id="shape" title="Shape and space" intro="Rounded, but not bubbly. Corners grow with the size of the thing; controls that are pills stay pills.">
              <Block title="Corner radius" plain>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-7">
                  {RADII.map((r) => (
                    <Copy key={r.name} value={r.cls} className="rounded-xl">
                      <span className="block h-20 border border-border bg-subtle" style={{ borderRadius: r.px === null ? 9999 : r.px }} />
                      <span className="mt-2 block text-sm font-medium">{r.name}</span><Spec>{r.px === null ? "pill" : `${r.px} px`}</Spec>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{r.use}</span>
                    </Copy>
                  ))}
                </div>
              </Block>
              <Block title="Spacing" note="A 4 px grid (Tailwind's default scale). These steps cover nearly every gap in the app.">
                <ul className="space-y-2.5">
                  {[[1, "Icon to its label inside a chip"], [2, "Between buttons, between chips"], [3, "Inside list rows, label to field"], [4, "Card and panel padding, row gaps"], [6, "Between groups in a form, page gutters"], [8, "Between blocks on a page"], [12, "Between sections"]].map(([n, use]) => (
                    <li key={n} className="flex items-center gap-4 text-sm"><span className="w-20 shrink-0"><span className="font-medium">{n}</span> <Spec>{Number(n) * 4} px</Spec></span><span className="h-3 shrink-0 rounded-sm bg-primary/80" style={{ width: Number(n) * 4 }} /><span className="text-muted-foreground">{use}</span></li>
                  ))}
                </ul>
              </Block>
              <Block title="Elevation" note="Borders do the separating. Shadows are kept for things that float above the page.">
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {[["shadow-xs", "Pills on the page"], ["shadow-sm", "Tags over artwork"], ["shadow-lg", "Menus, popovers, sheets"], ["shadow-xl", "Floating cards and prompts"]].map(([cls, use]) => (
                    <Copy key={cls} value={cls} className="rounded-2xl"><span className={cn("block h-20 rounded-2xl border border-border bg-card", cls)} /><span className="mt-3 block text-sm font-medium">{cls}</span><span className="block text-xs text-muted-foreground">{use}</span></Copy>
                  ))}
                </div>
              </Block>
              <Block title="Control heights" note="Tall enough for a thumb. The default is 40 px, forms use 44 px fields, and the main action on a phone is 48 px.">
                <div className="flex flex-wrap items-end gap-3">
                  {([["xs", 28], ["sm", 32], ["default", 40], ["lg", 48]] as const).map(([size, px]) => <span key={size} className="flex flex-col items-center gap-2"><Button size={size} variant="outline">Button</Button><Spec>{size} · {px}</Spec></span>)}
                  <span className="flex flex-col items-center gap-2"><Input readOnly value="Field" className="w-28" aria-label="Field height sample" /><Spec>field · 44</Spec></span>
                </div>
              </Block>
            </Section>

            <Section id="motion" title="Motion" intro="Short and soft. Things ease out into place and nothing loops unless it is waiting on something. Every animation switches off for people who ask their device to reduce motion.">
              <Block title="Easing" code={`--ease-out-soft: ${TOKENS["ease-out-soft"]};  /* fast start, gentle landing */`}>
                <p className="text-sm leading-6">One curve for entrances, <Spec>--ease-out-soft</Spec>. Durations: about 0.3 s for small things (the loader, a menu), 0.4 s for a page or a card arriving.</p>
              </Block>
              <div className="grid gap-10 md:grid-cols-2">
                <Block title="Page arriving" note="A new page slides in 32 px from the right while fading in."><Replay><div className="page-enter rounded-xl bg-subtle p-5 text-sm ring-1 ring-border"><span className="font-medium">Events</span><span className="block text-muted-foreground">.page-enter · 0.4 s</span></div></Replay></Block>
                <Block title="A nudge card" note="Prompts fade in while drifting a few pixels into place."><Replay><div className="animate-nudge rounded-xl bg-inverse-surface p-5 text-sm text-inverse-on-surface"><span className="font-medium">Turn on notifications?</span><span className="block opacity-70">.animate-nudge · 0.4 s</span></div></Replay></Block>
                <Block title="Loading" note="Three coral dots bobbing in turn, on a frosted card in the middle of the screen. It waits a beat before showing, so quick loads never flash it.">
                  <div className="flex items-center gap-6"><div className="flex items-center gap-2 rounded-3xl border border-border bg-card px-7 py-5 shadow-lg">{[0, 1, 2].map((i) => <span key={i} className="loader-dot size-2.5 rounded-full bg-brand" style={{ animationDelay: `${i * 0.16}s` }} />)}</div><Spec>{"<PageLoader />"}</Spec></div>
                </Block>
                <Block title="Something new" note="A light sweep across a label until it has been read. Used once, for What's new.">
                  <div className="flex items-center gap-2 text-sm"><Icon name="auto_awesome" fill className="shimmer text-brand" /><span className="shimmer-text font-medium">What&apos;s new</span></div>
                </Block>
              </div>
            </Section>

            <Section id="buttons" title="Buttons" intro="One primary per screen. Buttons have 10 px corners; buttons that are only an icon are round.">
              <Block title="Variants" plain>
                <ul className="divide-y divide-border">
                  {BUTTONS.map((b) => (
                    <li key={b.variant} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3.5">
                      <span className="w-40 shrink-0"><Button variant={b.variant}>{b.name}</Button></span>
                      <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{b.name}</span> <Spec>variant=&quot;{b.variant}&quot;</Spec><span className="block text-muted-foreground">{b.use}</span></span>
                      <Button variant={b.variant} disabled>Disabled</Button>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="With icons, and icon only" note="An icon sits before the label at 18 px. Icon-only buttons need an aria-label." code={`<Button><Icon name="add" className="!text-[18px]" />New event</Button>\n<Button variant="outline" size="sm">Send for review</Button>\n<Button variant="ghost" size="icon" aria-label="More"><Icon name="more_vert" /></Button>`}>
                <div className="flex flex-wrap items-center gap-3">
                  <Button><Icon name="add" className="!text-[18px]" />New event</Button>
                  <Button variant="outline"><Icon name="upload" className="!text-[18px]" />Upload</Button>
                  <Button variant="outline" size="sm"><Icon name="download" className="!text-[16px]" />Download approved · 4</Button>
                  <Button variant="ghost" size="icon" aria-label="More"><Icon name="more_vert" /></Button>
                  <Button variant="outline" size="icon" aria-label="Edit"><Icon name="edit" /></Button>
                  <Button variant="outline" size="icon-sm" aria-label="Close"><Icon name="close" className="!text-[18px]" /></Button>
                </div>
              </Block>
              <Block title="Back link" note="Reads as a control, not a breadcrumb. Sits above the page title." code={`<BackLink href="/events" label="Events" />`}>
                <BackLink href="#buttons" label="Events" />
              </Block>
            </Section>

            <Section id="badges" title="Badges and chips" intro="Small pills that label things. State always goes through StateBadge so a status looks the same everywhere.">
              <Block title="State badge" code={`<StateBadge state="in_review" />\n<StateBadge state="approved" label="Approved · v3" />`} plain>
                <ul className="grid gap-x-8 sm:grid-cols-2">
                  {STATES.map((s) => <li key={s.state} className="flex items-center gap-4 border-b border-border py-3"><span className="w-40 shrink-0"><StateBadge state={s.state} /></span><span className="min-w-0 text-sm"><Spec>{s.state}</Spec><span className="block text-muted-foreground">{s.when}</span></span></li>)}
                </ul>
              </Block>
              <Block title="Counts, tags and dots" note="Coral marks what is new or most important.">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm">
                  <span className="flex items-center gap-2"><CountBubble count={3} /><CountBubble count={12} /><span className="text-muted-foreground">Unread count</span></span>
                  <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-brand" /><span className="text-muted-foreground">Unread dot</span></span>
                  <span className="flex items-center gap-2"><span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-brand-foreground">Primary</span><span className="text-muted-foreground">The one that matters most</span></span>
                  <span className="flex items-center gap-2"><RoleChips roles={["Core Admin", "Approver", "Design"]} /><span className="text-muted-foreground">Roles, with the rest behind +N</span></span>
                </div>
              </Block>
              <Block title="Format shape" note="A small outline at a format's real proportions, so tall, wide and square read without numbers. Dashed when the size is free." code={`<AspectIcon size="1080 × 1920" />`}>
                <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
                  {[["1080 × 1920", "Story"], ["1080 × 1350", "Post"], ["1080 × 1080", "Square"], ["1920 × 1080", "TV"], ["3584 × 1536", "LED wall"]].map(([size, name]) => <span key={name} className="flex items-center gap-2"><AspectIcon size={size} /><span>{name} <span className="text-muted-foreground">{size}</span></span></span>)}
                  <span className="flex items-center gap-2"><AspectIcon ratio={null} /><span>Custom</span></span>
                </div>
              </Block>
            </Section>

            <Section id="forms" title="Forms" intro="Label above the field, 8 px apart, helper text below in the muted colour. Fields are 44 px tall on a white card surface with a hairline outline that turns navy on focus.">
              <Block title="Fields" code={`<div className="space-y-2">\n  <Label htmlFor="title">Event title</Label>\n  <Input id="title" name="title" placeholder="e.g. Sharad Purnima" />\n  <p className="text-xs text-muted-foreground">Shown on every page of the event.</p>\n</div>`}>
                <div className="grid max-w-3xl gap-6 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="dl-title">Event title</Label><Input id="dl-title" placeholder="e.g. Sharad Purnima" /><p className="text-xs text-muted-foreground">Shown on every page of the event.</p></div>
                  <div className="space-y-2"><Label htmlFor="dl-bad">With an error</Label><Input id="dl-bad" aria-invalid defaultValue="Sharad" /><p className="text-xs text-destructive-text">Add the year so it can be told apart later.</p></div>
                  <div className="space-y-2"><Label htmlFor="dl-off">Disabled</Label><Input id="dl-off" disabled defaultValue="Harisumiran" /></div>
                  <div className="space-y-2"><Label htmlFor="dl-date">Date</Label><DateField id="dl-date" name="dl-date" defaultValue="2026-11-10" /></div>
                  <div className="space-y-2"><Label htmlFor="dl-sel" className="flex items-center gap-1">Organization<InfoTip text="An (i) next to a label explains it on hover or tap." /></Label><SelectField id="dl-sel" defaultValue="hs"><option value="hs">Harisumiran</option><option value="acc">Atmiya Care Charities</option></SelectField></div>
                  <div className="space-y-2"><Label>Print size</Label><Select defaultValue="a4"><SelectTrigger aria-label="Print size" className="h-11 w-full rounded-lg bg-card px-3.5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a4">A4 flyer</SelectItem><SelectItem value="a3">A3 poster</SelectItem><SelectItem value="banner">Standing banner</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2 sm:col-span-2"><Label htmlFor="dl-notes">Notes for the designer</Label><Textarea id="dl-notes" rows={3} placeholder="Anything they should know" /></div>
                </div>
              </Block>
              <Block title="Choice chips" note="For short sets of options: pick one, or several. They replace radio buttons and checkboxes." code={`<ChoiceChips name="org" options={orgs} defaultValue="hs" />\n<ChoiceChips name="tags" options={tags} multiple size="sm" />`}>
                <div className="space-y-5">
                  <div className="space-y-2"><Label>Pick one</Label><ChoiceChips name="dl-org" defaultValue="hs" options={[{ value: "hs", label: "Harisumiran" }, { value: "acc", label: "Atmiya Care Charities" }]} /></div>
                  <div className="space-y-2"><Label>Pick any, small</Label><ChoiceChips name="dl-tags" multiple size="sm" defaultValue={["design"]} options={[{ value: "design", label: "Design" }, { value: "print", label: "Print" }, { value: "social", label: "Social" }, { value: "video", label: "Video" }]} /></div>
                </div>
              </Block>
              <Block title="Switch" note="For a setting that takes effect at once. The label sits beside it.">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                  <label className="flex items-center gap-2"><Switch defaultChecked />Custom per event</label>
                  <label className="flex items-center gap-2"><Switch />Off</label>
                  <label className="flex items-center gap-2"><Switch size="sm" defaultChecked className="data-checked:bg-brand" />Small, coral for Primary</label>
                </div>
              </Block>
            </Section>

            <Section id="people" title="People and orgs" intro="People are round, organizations are rounded squares. Both fall back to an initial on a brand colour when there is no picture.">
              <Block title="Avatar" note="Initials on the soft coral disc; the person's photo sits on top when there is one." code={`<UserAvatar initials="PP" size={32} src={user.avatar_url} />`}>
                <div className="flex flex-wrap items-end gap-6">
                  {([24, 28, 32, 36, 40] as const).map((s) => <span key={s} className="flex flex-col items-center gap-2"><UserAvatar initials="PP" size={s} /><Spec>{s}</Spec></span>)}
                  <span className="flex flex-col items-center gap-2"><span className="flex -space-x-2">{["AK", "MS", "RD"].map((i) => <UserAvatar key={i} initials={i} size={32} className="ring-2 ring-background" />)}</span><Spec>stacked</Spec></span>
                </div>
              </Block>
              <Block title="Organization mark" code={`<OrgMark org={org} size={40} />`}>
                <div className="flex flex-wrap items-end gap-6">
                  {([24, 32, 40, 48, 64] as const).map((s) => <span key={s} className="flex flex-col items-center gap-2"><OrgMark org={{ short_name: "Harisumiran" }} size={s} /><Spec>{s}</Spec></span>)}
                </div>
              </Block>
            </Section>

            <Section id="layout" title="Page layout" intro="A sidebar on desktop, a bottom tab bar on phones, and a single column of content that starts with a title. Pages do not use boxed cards for their main content.">
              <Block title="Page header" note="Optional back link, the title, one muted line under it, actions on the right." code={`<PageHeader title="Diwali Annakut 2026" subtitle="Harisumiran · Sat 7 Nov"\n  back={<BackLink href="/events" label="Events" />}\n  actions={<Button>Edit event</Button>} />`}>
                <PageHeader title="Diwali Annakut 2026" subtitle="Harisumiran · Sat 7 Nov · 8 formats" back={<BackLink href="#layout" label="Events" />} actions={<><Button variant="outline">Share</Button><Button>Edit event</Button></>} />
              </Block>
              <Block title="Section header" note="A title, a muted count or note beside it, and at most one action." code={`<SectionHeader title="Formats" meta="5 of 8 approved" action={…} />`}>
                <SectionHeader title="Formats" meta="5 of 8 approved" action={<Button variant="outline" size="sm"><Icon name="download" className="!text-[16px]" />Download approved · 5</Button>} />
              </Block>
              <Block title="Breakpoints" note="Tailwind's defaults. Layout changes at two of them.">
                <ul className="space-y-1.5 text-sm">
                  <li><span className="font-medium">Below 768 px (phones):</span> <span className="text-muted-foreground">bottom tab bar, dialogs become drawers, toolbars collapse to icons, media runs edge to edge.</span></li>
                  <li><span className="font-medium">768 px and up (md):</span> <span className="text-muted-foreground">sidebar appears, page title grows to 26 px, side-by-side panels.</span></li>
                  <li><span className="font-medium">1024 px and up (lg):</span> <span className="text-muted-foreground">extra columns in lists and wider gutters.</span></li>
                </ul>
              </Block>
            </Section>

            <Section id="lists" title="Lists and states" intro="Lists are rows divided by a hairline, not stacks of cards. Each row has a leading disc or thumbnail, two lines of text, and a trailing mark.">
              <Block title="List row" code={`<ul className="divide-y divide-border">\n  <li><a className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 hover:bg-subtle">…</a></li>\n</ul>`} plain>
                <ul className="divide-y divide-border">
                  {[{ icon: "rule", text: "Meera asked for changes on Instagram post", meta: "Diwali Annakut 2026 · 5 minutes ago", unread: true }, { icon: "check_circle", text: "A4 flyer was approved", meta: "Sharad Purnima · 2 hours ago", unread: true }, { icon: "assignment_ind", text: "You were assigned TV slide", meta: "Diwali Annakut 2026 · yesterday", unread: false }].map((n) => (
                    <li key={n.text}><a href="#lists" className="-mx-3 flex items-center gap-4 rounded-xl px-3 py-3.5 hover:bg-subtle">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><Icon name={n.icon} /></span>
                      <span className="min-w-0 flex-1"><span className={cn("block text-sm leading-6", n.unread && "font-medium")}>{n.text}</span><span className="block text-sm text-muted-foreground">{n.meta}</span></span>
                      {n.unread && <span className="size-2.5 shrink-0 rounded-full bg-brand" />}
                    </a></li>
                  ))}
                </ul>
              </Block>
              <div className="grid gap-10 md:grid-cols-2">
                <Block title="Empty state" note="A dashed outline and one or two plain sentences: what will show up here, and when." plain>
                  <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">Nothing archived yet. Events move here a week after their date.</p>
                </Block>
                <Block title="Loading placeholder" note="Grey bars in the shape of what is coming, pulsing gently." plain>
                  <div className="flex items-center gap-4 py-3.5"><Skeleton className="size-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div></div>
                </Block>
                <Block title="Progress" note="A thin track; the solid part is approved, the pale part is uploaded and waiting.">
                  <div className="space-y-2"><div className="relative h-1.5 overflow-hidden rounded-full bg-muted-strong" aria-hidden><div className="absolute inset-y-0 left-0 w-3/4 rounded-full bg-success/30" /><div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-success" /></div><p className="text-xs text-muted-foreground">4 approved · 2 in review · 2 to go</p></div>
                </Block>
                <Block title="Divider" note="The same hairline, on its own.">
                  <div className="text-sm"><p>Above</p><Separator className="my-3" /><p className="text-muted-foreground">Below</p></div>
                </Block>
              </div>
            </Section>

            <Section id="overlays" title="Overlays and toasts" intro="Dialogs ask one question and name the action on the button. On phones the same content comes up from the bottom as a drawer. Try them.">
              <Block title="Dialog, drawer, sheet, menu, popover, tooltip"><OverlayDemos /></Block>
              <Block title="Toast" note="A dark bar at the bottom left that confirms what just happened, in a few words. The icon carries the colour." code={`toast.success("Event saved");\ntoastError(e);  // errors from server actions`}><ToastDemo /></Block>
            </Section>

            <Section id="brand" title="Brand marks" intro="The app is one of the Harisumiran family, so the parent mark sits quietly above the app's own logo on the sign-in page. The hands alone are the app icon.">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[["/brand/logo-full.png", "Horizontal lock-up", "logo-full.png"], ["/brand/logo-stacked.png", "Stacked, for sign-in", "logo-stacked.png"], ["/brand/logo-mark.png", "The hands, alone", "logo-mark.png"], ["/brand/harisumiran.svg", "Harisumiran, the parent brand", "harisumiran.svg"], ["/brand/harisumiran-mark.svg", "Harisumiran mark", "harisumiran-mark.svg"], ["/brand/icon-192.png", "App icon", "icon-192.png"]].map(([src, name, file]) => (
                  <a key={src} href={src} download className="group rounded-2xl border border-border p-4 transition-colors hover:bg-subtle">
                    <span className="flex h-32 items-center justify-center"><img src={src} alt={name} className="max-h-24 max-w-[75%] object-contain" /></span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-sm"><span><span className="block font-medium">{name}</span><Spec>{file}</Spec></span><Icon name="download" className="text-muted-foreground group-hover:text-foreground" /></span>
                  </a>
                ))}
              </div>
            </Section>

            <Section id="reuse" title="Use it in another app" intro="The look lives in one stylesheet of tokens plus a set of standard open-source parts. A new app that starts from the same parts and pastes in the tokens will match this one.">
              <Block title="1. Start from the same parts" note="Next.js with Tailwind CSS v4 and shadcn/ui (Radix). The components on this page are shadcn/ui components restyled by the tokens." code={`npx create-next-app@latest my-app --typescript --tailwind --app\ncd my-app\nnpx shadcn@latest init\nnpx shadcn@latest add button input label textarea select switch dialog drawer sheet dropdown-menu popover tooltip sonner skeleton separator`} plain><span /></Block>
              <Block title="2. Paste in the tokens" note="Replace the contents of the new app's globals.css with tokens.css. That one file carries every colour, the corner radius, the font and the icon class." plain>
                <div className="flex flex-wrap gap-2">
                  <Button asChild><a href="/design-library/tokens.css" download="design-concur-tokens.css"><Icon name="download" className="!text-[18px]" />Download tokens.css</a></Button>
                  <Button asChild variant="outline"><a href="/design-library/tokens.css" target="_blank" rel="noreferrer">View it<Icon name="arrow_outward" className="!text-[18px]" /></a></Button>
                  <Button asChild variant="outline"><a href="/design-library/tokens.json" target="_blank" rel="noreferrer">tokens.json, for other tools<Icon name="arrow_outward" className="!text-[18px]" /></a></Button>
                </div>
              </Block>
              <Block title="3. Load the fonts" note="Google Sans Flex for text and Material Symbols Rounded for icons, both from Google Fonts. Put these in the head of the root layout." code={`<link rel="preconnect" href="https://fonts.googleapis.com" />\n<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,300..800&display=swap" />\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block" />`} plain><span /></Block>
              <Block title="4. Add the icon component" note="Icons are text set in the icon font, so the component is tiny." code={`export function Icon({ name, size = 20, fill = false, className }: { name: string; size?: 20 | 24; fill?: boolean; className?: string }) {\n  return <span aria-hidden className={"msr " + (className ?? "")} data-size={size} data-fill={fill ? "1" : "0"}>{name}</span>;\n}`} plain><span /></Block>
              <Block title="5. Follow the same habits" note="The tokens give the colours; these habits give the feel.">
                <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6">
                  <li>Use the named colours (<Spec>bg-brand-soft</Spec>, <Spec>text-muted-foreground</Spec>), never a hex value in a component.</li>
                  <li>One primary button per screen; outline or ghost for the rest.</li>
                  <li>Coral only as an accent. Status only through tinted badges.</li>
                  <li>Rows with hairlines instead of boxed cards. Dashed outline for empty states.</li>
                  <li>Controls at 40 px or taller; dialogs become bottom drawers on phones.</li>
                  <li>Give this page&apos;s link to whoever, or whichever AI assistant, is building the next app, and ask them to match it.</li>
                </ul>
              </Block>
            </Section>

            <footer className="border-t border-border pt-8 text-sm text-muted-foreground">Design &amp; Concur by Harisumiran. This page is generated from the app&apos;s own code and tokens, so it stays current as the app changes.</footer>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
