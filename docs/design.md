# Design & Concur — Figma design notes

**File:** https://www.figma.com/design/tIjcEc7yYYZ2sQPOmK4nNB (team Harisumiran)
**Source tokens:** Sampark Design System — https://www.figma.com/design/jiCKqA20PSMxOSZNJDROZ6
**Format dimensions and safe areas:** Harisumiran Creatives › Guidelines — https://www.figma.com/design/9BO6rB9MqA2ugOIPer1YMX/?node-id=1-5

## Pages

| Page | Contents |
|---|---|
| 📕 Cover | Title, description, page index |
| 🧩 Components | Button (Variant × Size), Badge (State), NavItem (Active), IconButton, Input, FormatCard, EventRow, Sidebar, WizardTopBar |
| 🖥 Desktop (1440 × 900) | 01 Sign in · 02 Awaiting access · 03 Events · 04a New event · Basics (with calendar popover) · 04b New event · Formats (Requested / N/A) · 05 Event page · 06 Asset page · 07 Inbox · 08 Archive · 09 Settings · Users |
| 📱 Mobile (393 × 852) | M01–M09 mirror the desktop set. M06 Asset viewer has a sticky Request changes / Approve bar; M06b is the two-option Approve sheet; M06c is the edge-to-edge @mention picker |

## Tokens

Sampark's variables and components are **not published as a library**, so `importVariableByKeyAsync` and
`importComponentSetByKeyAsync` fail from another file. The Design & Concur file therefore carries local
collections that mirror Sampark's light-mode values exactly:

- `Color` (Light) — 27 semantic roles, same names as Sampark (`color/brand/default`, `color/surface/background`, …)
- `Radius` — sm 4 · md 6 · base 8 · lg 8 · xl 12 · full 999
- `Spacing` — 0 … 96 on the Sampark scale

When Sampark is published, swap the local collections for the library ones with Figma's
"swap library" flow; every fill, stroke, radius and gap in the file is variable-bound, so nothing
needs to be recoloured by hand.

## Type and icons

- Text styles use **Google Sans Flex** (the Sampark file uses Inter; the PRD calls for Google Sans).
  Display/xl 32 · Display/lg 28 · Heading/xl 20 · Heading/lg 18 · Body/base 16 · Body/sm 14 · Label/xs 12 · Control/sm 12.8 · Label/2xs 10.4.
- Icons are **Material Symbols Rounded** rendered as text ligatures (styles `Icon/24`, `Icon/20`), so an
  icon is changed by editing its text (`event`, `notifications`, `inventory_2`, `settings`, …). This maps
  1:1 to the `<span class="material-symbols-rounded">` pattern in code.

## Component → code mapping (planned)

| Figma | shadcn/ui / app component |
|---|---|
| Button | `Button` variants default (Primary), secondary, outline, ghost, destructive; sizes default/lg |
| Badge | `Badge` with a `state` prop: requested · in_review · changes_requested · approved · na · draft |
| NavItem, Sidebar | `Sidebar` from shadcn/ui sidebar block |
| Input | `Label` + `Input` |
| FormatCard | `components/format-card.tsx` (Card + Badge) |
| EventRow | `components/event-row.tsx` |
| WizardTopBar | `components/wizard/top-bar.tsx` |
| Calendar popover | `Calendar` + `Popover` (react-day-picker) |
| Approve sheet, @mention picker | `Drawer` (vaul) on mobile, `Dialog` / `Command` on desktop |

## Preview frames (Asset page)

The IG Post preview shows the measured safe areas (top and bottom 168 px of 1350) as translucent red
bands with a dashed edge, the tiled 45° DRAFT watermark, and the `DRAFT · v2 · date` caption. The same
treatment applies per format using the insets in the catalog (PRD §9.1).
