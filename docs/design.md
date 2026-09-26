# Design & Concur — Figma design notes

**File:** https://www.figma.com/design/tIjcEc7yYYZ2sQPOmK4nNB (team Harisumiran)
**Format dimensions and safe areas:** Harisumiran Creatives › Guidelines — https://www.figma.com/design/9BO6rB9MqA2ugOIPer1YMX/?node-id=1-5
**Sampark Design System (WIP, reference only):** https://www.figma.com/design/jiCKqA20PSMxOSZNJDROZ6

## Direction

Current-day, quiet UI: white surfaces with hairline borders, ink-navy primary buttons (the complement to the logo's coral and marigold), coral
used only as an accent (org mark, FAB, unread dots, "Needs you"), tinted state badges whose text
is the dark shade of the same hue (all ≥ 7:1), radii 10 / 16 / 24, initials avatars, hairline
list rows instead of boxed cards. Mobile media is edge-to-edge. Full token table in PRD §12.1.

## Pages

| Page | Contents |
|---|---|
| 📕 Cover | Title, description, page index |
| 🧩 Components | Button (Primary, Brand, Secondary, Outline, Ghost, Destructive × sm/md/lg), Badge (Requested, In review, Changes requested, Approved, N/A, Draft, Needs you), NavItem (Active), IconButton (Ghost, Outline), Input, Avatar (24/32/40 with initials), FormatCard, EventRow, Sidebar, WizardTopBar |
| 🖥 Desktop (1440 × 900) | 01 Sign in · 02 Awaiting access · 03 Events · 04a New event · Event (calendar popover) · 04b New event · Formats (Need this / Skip) · 05 Event page · 06 Asset page · 07 Inbox · 08 Archive · 09 Settings · Users |
| 📱 Mobile (393 × 852) | M01–M09 mirror the desktop set. M05 shows formats as a full-bleed 2-column media grid; M06 shows the preview at viewport width with a floating toolbar, comments sheet and sticky action bar; M06b is the Approve sheet; M06c is the edge-to-edge @mention picker; M08 runs reference strips edge to edge |

## Tokens

Sampark's variables and components are **not published as a library** and the system itself is
still being worked out, so this file carries its own local collections using Sampark's naming:

- `Color` (Light) — semantic roles (`color/brand/default`, `color/action/primary`,
  `color/status/info-soft`, …). Values are in PRD §12.1.
- `Radius` — sm 6 · md 8 · base 10 · lg 12 · xl 16 · 2xl 24 · full
- `Spacing` — 0 … 96

Every fill, stroke, radius and gap in the file is variable-bound, so retuning a token restyles
every screen. When Sampark settles, its values can be pasted into these collections or the
collections swapped for the library.

## Type and icons

- **Google Sans Flex** text styles: Display/xl 30/36 · Display/lg 24/32 · Heading/xl 20/28 ·
  Heading/lg 17/24 · Body/base 16/24 · Body/sm 14/20 · Label/xs 12/16 · Control/sm 12.8/16 ·
  Label/2xs 10.4/14. Medium variants for each body/label size.
- **Material Symbols Rounded** as text ligatures (`Icon/24`, `Icon/20`). Change an icon by editing
  its text (`event`, `notifications`, `inventory_2`, `settings`, …), matching the
  `<span class="material-symbols-rounded">` pattern in code.

## Component → code mapping (planned)

| Figma | shadcn/ui / app component |
|---|---|
| Button | `Button` variants default (Primary), brand, secondary, outline, ghost, destructive; sizes sm/default/lg |
| Badge | `Badge` with `state`: requested · in_review · changes_requested · approved · na · draft · needs_you |
| NavItem, Sidebar | shadcn/ui `Sidebar` block |
| IconButton | `Button` size icon, variants ghost/outline |
| Input | `Label` + `Input` |
| Avatar | `Avatar` with `AvatarFallback` initials |
| FormatCard | `components/format-card.tsx` |
| EventRow | `components/event-row.tsx` |
| WizardTopBar, step rail | `components/wizard/*` |
| Calendar popover | `Calendar` + `Popover` (react-day-picker) |
| Approve sheet, @mention picker, comments sheet | `Drawer` (vaul) on mobile; `Dialog` / `Command` on desktop |

## Brand marks

`public/brand/`: `logo-full.png` (horizontal lock-up, sign-in on wide screens' docs), `logo-stacked.png` (sign-in),
`logo-mark.png` (the hands, awaiting page), `harisumiran.svg` / `harisumiran-mark.svg` (the parent brand recoloured
to the single cocoa of the wordmark; the full logo sits above Design & Concur on sign-in because the app is one of
the Harisumiran family). App icons are the hands alone on the cream tile: one icon, one idea. The favicon is the
Harisumiran mark on a rounded cream tile.
The installed app is named "Design Seva".

## Asset page

The artwork sits directly on the page, no frame or panel; front and back stack vertically with a caption
under each. A plain toolbar above it: version pills, Upload and a ⋯ (Replace / Add back side / Delete the
current version) on the left for designers; Comment and Guides on the right for everyone. All are the same
outline pill; on phones they collapse to icons. Enlarge appears on hover.

The sticky, edge-to-edge header only says where you are (back, format name + version, n of N) and is
left-aligned so it never shifts with the label. A status card beside the artwork carries the state badge,
version and uploader + time; approvers get Request changes over Approve inside it on desktop and in a
fixed bottom bar on phones. While a version is unsent the badge reads "Not sent yet" and the same spot holds
the designer's single primary action, Send for review; approvers see a one-line note instead. The comments panel holds the whole conversation for the format, across versions, with a thin "v1" / "v2 · this version" rule where the version changes, so the reason v2 exists is right there. Resolved comments are never deleted: they are hidden by default and "Show N resolved" in the panel header brings them back, dimmed, with a Resolved tick and Reopen in their menu. Pins are drawn only for the version on screen. The header counts what is still open. Versions whose files were pruned (only the two newest keep files) show a dashed pill and a one-line note; their comments stay in the thread.

Comments show the author's Google photo (initials when there is none); a pinned comment carries a small
grey chat-bubble token with its number in the meta line, matching the bubble on the design. Enter is a new
line everywhere; ⌘/Ctrl + Enter posts, as does the check / arrow button. Tapping the design enlarges it.

**Guides** read like a print proof: the safe zone is a translucent mint band with a hairline inner
edge; print formats add a dashed pink cut (trim) line with crop ticks outside the corners. Insets
come from the catalog (PRD §9.1). The DRAFT watermark is a single giant outlined word across the
diagonal at 22 % opacity.

## Formats step

A new event starts with every format off; the step is about turning on what this event needs. Digital
formats are one row each with an On / Off chip, notes and the Primary radio. Print is a single dropdown
(an event normally has one print piece, at one size) with a quiet "+ Add a print item" link for the rare
second piece. LED backwall defaults to 3584 × 1536 and can be overridden per event. The asset page header
shows the format's size next to its name (TV 1920 × 1080) so nobody has to look it up.

## Download all approved

The Formats header on the event page grows a "Download approved · N" button as soon as one format is approved
(icon and count only on phones). It fetches one ZIP from `/api/events/[id]/download`, every approved design
named exactly like the single downloads (year_event_format_vN.ext, "-back" for a print back), so a folder of
them sorts sensibly. Per-format downloads on the asset page stay for the one-off case.

## Comment formatting

Comments are written in a small rich-text editor (Tiptap): bold, italic, underline, a palette of five colours,
one level of bullets, links and @-mentions as chips. Nothing else, on purpose. On desktop the tools hover over
the selected text in a dark pill, Google-Chat style, with the colour swatches and the link field dropping out
of it. On phones a floating bubble would fight the system's copy / paste menu and hide under the keyboard, so
the same row is docked to the top of the composer instead: always reachable while typing, never covering the
text. Bodies are stored as a sanitised HTML subset (src/lib/rich-text.ts); notifications and chat posts use the
plain words.
