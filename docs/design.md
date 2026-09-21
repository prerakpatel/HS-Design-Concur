# Design & Concur — Figma design notes

**File:** https://www.figma.com/design/tIjcEc7yYYZ2sQPOmK4nNB (team Harisumiran)
**Format dimensions and safe areas:** Harisumiran Creatives › Guidelines — https://www.figma.com/design/9BO6rB9MqA2ugOIPer1YMX/?node-id=1-5
**Sampark Design System (WIP, reference only):** https://www.figma.com/design/jiCKqA20PSMxOSZNJDROZ6

## Direction

Current-day, quiet UI: white surfaces with hairline borders, near-black primary buttons, coral
used only as an accent (org mark, FAB, unread dots, "Needs you"), tinted state badges whose text
is the dark shade of the same hue (all ≥ 7:1), radii 10 / 16 / 24, initials avatars, hairline
list rows instead of boxed cards. Mobile media is edge-to-edge. Full token table in PRD §12.1.

## Pages

| Page | Contents |
|---|---|
| 📕 Cover | Title, description, page index |
| 🧩 Components | Button (Primary, Brand, Secondary, Outline, Ghost, Destructive × sm/md/lg), Badge (Requested, In review, Changes requested, Approved, N/A, Draft, Needs you), NavItem (Active), IconButton (Ghost, Outline), Input, Avatar (24/32/40 with initials), FormatCard, EventRow, Sidebar, WizardTopBar |
| 🖥 Desktop (1440 × 900) | 01 Sign in · 02 Awaiting access · 03 Events · 04a New event · Basics (calendar popover) · 04b New event · Formats (Requested / N/A) · 05 Event page · 06 Asset page · 07 Inbox · 08 Archive · 09 Settings · Users |
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

## Preview frames (Asset page)

The IG Post preview shows the measured safe areas (top and bottom 168 px of 1350) as translucent
red bands with a dashed edge, the tiled 45° DRAFT watermark, and a `DRAFT · v2 · date` caption
pill. The same treatment applies per format using the insets in the catalog (PRD §9.1).
