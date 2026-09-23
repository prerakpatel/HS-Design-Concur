# Design & Concur by Harisumiran — Product Requirements Document

**Status:** v1.0 — agreed after a five-round requirements interview on 2026-09-21
**Owner:** Prerak Patel (Harisumiran)
**Design source:** Sampark Design System (Figma `jiCKqA20PSMxOSZNJDROZ6`) · Harisumiran Creatives (Figma `9BO6rB9MqA2ugOIPer1YMX`, page Guidelines)
**Repo:** `prerakpatel/HS-Design-Concur`

---

## 1. Summary

Design & Concur is a small, controlled-access web app for Harisumiran (the temple) and its
non-profit wing. It replaces Slack threads as the place where event invite artifacts
(Sambandh app assets, mobile, social, TV, website, print) are requested, briefed, designed,
reviewed and approved.

Every event has one brief and a set of format slots. Every design upload becomes a numbered
version, is optimised once, and carries a DRAFT watermark until an approver signs it off.
Approval notifies everyone and releases a clean download. Storage is capped by design so the
app runs on free tiers indefinitely.

Guiding principle: **utmost minimalism**. One question per screen where possible, one obvious
next action, nothing configurable that doesn't need to be.

## 2. Goals

1. One event page shows every format, its state, its owner and what's overdue.
2. Every uploaded design is DRAFT-watermarked automatically until approved.
3. Approval is explicit, auditable, reversible, and notifies everyone at once.
4. Feedback is threaded per version with @mentions and an addressed/confirmed loop.
5. Runs on Vercel + Supabase free tiers forever: hard event cap, aggressive optimisation,
   automatic purge after each event.
6. Access is gated: Google sign-in, then Core Admin approval.

## 3. Non-goals (v1)

- Event *management* (schedules, registrations). Events exist only as asset containers.
- Designing inside the tool. Designers upload exports from their own tools.
- Video or motion files. Static images and GIFs only.
- Storing print-ready originals. Print production is an offline process.
- Public links. Everything is behind login.
- Slack integration (v1.1). Dark mode (tokens wired, not shipped).

---

## 4. People, roles and organisations

### 4.1 Organisations
Two seeded organisations: **Harisumiran** (the temple) and **Atmiya Care Charities**, shown as
**ACC** where space is tight (the non-profit wing). An event belongs to exactly one org. **Each org is a separate view**
with a switcher in the sidebar for users who belong to both. There is no unified feed.

### 4.2 Access
- Sign in with any Google account.
- A first-time account lands on **Awaiting access**. A Core Admin approves it and assigns
  org membership (one or both). Until then the user sees nothing.
- Admin setting **"Not accepting new members"**: when on, the sign-in page shows that message
  and the request button is hidden. Requests already queued are unaffected.

### 4.3 Roles (global, not per org)

| Role | Grants |
|---|---|
| **Member** | Everything below not marked otherwise. |
| **Core Admin** | Approve/deny access, remove users, assign org membership, grant/revoke Approver, promote/demote Core Admins, delete any event, edit org notification settings. Implicitly an Approver. |

There is **no Sub-admin role**. Its only purpose was deleting accidental events, which is
covered by: *the creator of an event may delete it themselves as long as no version on that
event has been sent for review.* After that, only a Core Admin can delete.

### 4.4 Capabilities and function tags
- **Approver** (toggle, granted by a Core Admin): may approve, request changes on, and reopen
  assets. Core Admins have it implicitly.
- **Function tags** (multi-select, informational, set by a Core Admin):
  **Central** (executives), **Publication** (writers), **Designer**.
  Tags route notifications and default assignees. Two things are gated by tag:
  - Designers and Core Admins may add or edit format catalog rows in-line.
  - Designers and Core Admins receive the yearly device-preset reminder (§9.5).

### 4.5 Rails
- A user cannot approve a version they uploaded.
- The last remaining Core Admin cannot be demoted or removed.
- Every role, tag and membership change is written to the activity log.

---

## 5. Domain model

```
Organisation
└── Event  (draft | active | archived; soft-deleted with 7-day restore)
    ├── title, org, event date, venue, created_by
    ├── Brief  (description, timing lines[], venue, notes)   — locks at first upload
    └── Format Slot   (one per catalog row; state: requested | n/a)
        ├── notes for this format, assignee, due date
        ├── workflow state (see §6)
        └── Version 1..n
            ├── sides: Front [, Back]   (print only)
            ├── optimised file, watermarked preview, thumbnail, reference (post-purge)
            ├── Comment (threaded, pinnable x/y, @mentions, addressed/confirmed)
            └── Decision (approved | changes requested | reopened) by whom, when
```

See `CONTEXT.md` for the glossary.

---

## 6. Workflow

### 6.1 Event creation wizard
Anyone can start an event. The wizard is modelled on a stepped, one-question-per-screen flow
with a left rail of step icons, "Step n of 5" in the header, **Back**, **Next**, and
**Save and exit** at every step. A saved draft can be resumed by anyone in the org.

| Step | Screen | Fields |
|---|---|---|
| 1 | Basics | Org (pre-filled from current view), title, **event date** (calendar picker, no free text), venue |
| 2 | Brief | Description (rich text), timing lines (one by default, "+ add timing": label, date via calendar picker, start, end), notes |
| 3 | Formats | Every catalog row listed; each toggled **Requested** or **N/A**. Per-row "notes for this format". |
| 4 | Assign | Per requested slot: assignee (defaults to users tagged Designer), optional due date (calendar picker) |
| 5 | Review | Summary; **Create event** |

Rules:
- A draft event is not counted toward the cap (§8) and is swept 30 days after its last edit,
  with a warning email to the creator 7 days before.
- The brief must exist before any version can be uploaded. After the first upload the brief is
  read-only; further content changes travel as comments.
- **Edit event** on the Event page reopens the wizard at the chosen step (brief step locked
  once uploads exist). Formats can be flipped between Requested and N/A at any time by
  anyone; flipping to N/A on a slot with versions keeps the versions but hides the slot from
  pending counts.

### 6.2 Format slot state machine

```
REQUESTED ──upload──► IN_REVIEW ──approve──► APPROVED
    ▲                    │  ▲                    │
    │                    ▼  │ upload             │ reopen (approver)
    └──── N/A ◄──── CHANGES_REQUESTED ◄──────────┘
```

| Transition | Who | Effect | Notified |
|---|---|---|---|
| Upload version | anyone | New version n; optimise, watermark, thumbnail. Slot → In review. | Approvers, Central, requester |
| Request changes | Approver | Slot → Changes requested. Comments required (≥1). | Assignee, Publication |
| Mark addressed | anyone | Per-comment flag on the new version. | Comment author |
| Confirm / reopen comment | Approver | Closes or re-flags the comment. | Assignee |
| **Approve and notify** | Approver | Confirmation dialog ("Approve *Sambandh Event v3*? This notifies everyone on the event."). Slot → Approved. | Everyone on the event, both orgs' channels per settings |
| **Approve and download** | Approver | Same as above, then downloads the optimised file (or a ZIP of Front + Back). | Same |
| Bulk approve | Approver | Multi-select slots on the Event page → one confirmation dialog listing them. No "Approve all" button exists. | Same |
| Reopen | Approver | Explicit switch on an approved slot with a reason. Slot → Changes requested. Prior approval recorded as *superseded*. | Everyone on the event |

"Everyone on the event" = creator, all assignees, everyone who has commented, all Approvers
in the org, all Core Admins.

### 6.3 Comments
- Threaded per version. Optional pin at an x/y point on the preview.
- **@mentions**: typing `@` opens a picker of members of the current org (edge-to-edge sheet
  on mobile). A mention notifies that user.
- Each comment has an **addressed** flag (set by anyone, typically the designer on the next
  upload) and a **confirmed** flag (set by an Approver). Unconfirmed comments are listed as a
  checklist on the newest version.

---

## 7. Files, optimisation and watermark

### 7.1 Upload
- Limit **8 MB** per file. Direct browser-to-storage upload via a signed URL, then a server
  job processes it.
- Accepted: PNG, JPG, WebP, GIF. **PDF only for print formats**, max 2 pages.
- Print formats accept **either** one PDF (pages 1–2 become Front/Back) **or** one or two
  images labelled Front and Back.

### 7.2 What is stored (per version)
Nothing is kept at original size. Each side is optimised once and only the derived files exist:

| File | Purpose | Spec |
|---|---|---|
| `optimised` | the asset itself; served on approved download | Visually lossless: WebP or MozJPEG q≈82–85; PNG only if transparency; GIF passed through untouched (size-checked only). Print PDFs rasterised at 150 dpi to the same rule. |
| `preview` | shown before approval | `optimised` + baked DRAFT watermark, long edge ≤ 1600 px |
| `thumb` | cards and lists | long edge 400 px WebP |
| `reference` | created at purge, replaces all of the above | long edge 800 px WebP q60, ≈ 50–80 KB |

All versions are kept until the event purge; with files this small no pruning is needed.

### 7.3 Watermark
- One giant "DRAFT" along the diagonal, white with a dark outline so it reads on any background,
  faded to 22 % opacity. Version, uploader and time show in the page header, not on the image.
- Previews stamped with an older mark are re-rendered on first view (`version_sides.mark_version`).
- **GIFs are not baked.** The viewer draws the same watermark as a CSS overlay over the
  animated GIF. Protection is by access control, not by the file.
- Approved = the `preview` is no longer served; the `optimised` file is.

---

## 8. Storage cap and retention

| Rule | Behaviour |
|---|---|
| **Event cap** | At most **10 non-draft, non-archived events** across both orgs combined. Each org view shows the shared count ("7 of 10 event slots used across Harisumiran"). |
| **Horizon** | An event date may not be more than **6 months** in the future. |
| **Cap reached** | Creating (or publishing a draft as) the 11th event is **blocked** with a message naming the oldest event and its date. |
| **Auto-archive + purge** | Nightly: for events whose date is **≥ 7 days** past: the **primary** format (or, if none was marked, the first approved format) keeps one `reference` image per side from its approved version; every other file, in every other format, is deleted. Text (brief, comments, decisions, activity) is kept. The event becomes **archived** (read-only) in the same pass, which frees its event slot. *(v1.1: the separate 6-month archive rule was folded into this one; it was redundant once archiving happens at purge time.)* |
| **Archive view** | Read-only list of archived events with reference image, brief, decision history and comments. |
| **Delete event** | Soft delete; Core Admins can restore for 7 days; files purged after. Creator may delete their own event only if no version has ever been sent for review. |
| **Draft sweep** | Drafts untouched for 30 days are deleted; the creator is notified (in-app + email) at day 23 and again when it goes. Editing the draft resets the clock. |
| **Device reminder** | Every 1 November, Designers and Core Admins get a reminder to refresh the phone preview presets (§9.5). |

Budget sanity check: 10 events × ~10 slots × ~3 versions × ~0.4 MB ≈ 120 MB steady state,
against Supabase's 1 GB free storage.

---

## 9. Format catalog and previews

### 9.1 Seeded rows (from Harisumiran Creatives › Guidelines)

| # | Key | Name | Request size (px) | Frame | Safe area (px) | Class |
|---|---|---|---|---|---|---|
| 1 | sambandh_event | Sambandh Event | 1125 × 1200 | phone, 375 × 400 viewport | top 249 | digital |
| 2 | sambandh_glimpse | Sambandh Glimpse | 1074 × 645 | card, 358 × 215 | none | digital |
| 3 | mobile | Mobile | 1179 × 2556 | phone frames (§9.4) | top 264 | digital |
| 4 | ig_story | IG Reel / Story | 1080 × 1920 | phone | top 240, bottom 240 | digital |
| 5 | ig_post | IG Post | 1080 × 1350 | flat | top 168, bottom 168 | digital |
| 6 | tv | TV | 1920 × 1080 | TV bezel | none | digital |
| 7 | web_hero | Website Hero | 1920 × 540 | flat | none | digital |
| 8 | web_alt | Web (1500) | 1500 × 548 | flat | none | digital |
| 9 | print_7x5 | Print 7 × 5 in | 7.5 × 5.5 in @ 300 dpi | print | bleed 0.25 in, safe 0.25 in | print |
| 10 | print_9x6 | Print 9 × 6 in | 9.5 × 6.5 in @ 300 dpi | print | bleed 0.25 in, safe 0.25 in | print |
| 11 | print_10x7 | Print 10 × 7 in | 10.5 × 7.5 in @ 300 dpi | print | bleed 0.25 in, safe 0.25 in | print |
| 12 | led_backwall | LED backwall | custom W × H per request | LED (decorative seams) | none | digital |

Print sizes follow the existing Figma templates: the file is trim + 0.125 in bleed on each side (a 7 × 5 in
card is a 7.25 × 5.25 in file). The viewer
draws the trim as a dashed cut line with crop ticks and the safe margin as a translucent mint band.

### 9.2 Catalog editing
Rows are editable **in-line** by users tagged Designer and by Core Admins, including adding
a row. Fields: name, width, height, unit (px | in), dpi (print), class (print | digital),
frame type, safe-area insets (top/right/bottom/left), bleed and safe margin (print), allowed
formats, active flag. Deactivated rows stay on old events.

### 9.3 Preview viewer (Asset page)
- Frame chosen by the row's frame type. **Phones**: muted flat frame with a status-bar area,
  no replica of any app chrome. **TV**: 16:9 bezel. **LED**: rectangle at requested ratio
  with decorative panel seams (not a real panel count). **Print**: flat sheet with dotted red
  bleed line and lighter dotted safe line, and a **lightbox** with Front/Back flip.
- **Safe-area toggle** overlays the row's insets as translucent red. Semantics: artwork may
  extend into the zone, but nothing important (text, murti, logos) should sit there.
- One mobile upload is scaled to fit each phone frame; overflow shows as letterbox.
- Zoom, version switcher, comment pins.

### 9.4 Device presets (`config/devices.ts`)
Labels and dimensions follow Figma's frame presets. Seeded: iPhone 16 Pro 402 × 874,
iPhone 16 Pro Max 440 × 956, Android Compact 412 × 917, Android Medium 700 × 840. Values are
config, not logic, and are expected to be corrected from Figma's frame panel.

### 9.5 Yearly reminder
Every **1 November**, an email goes to everyone tagged Designer and to Core Admins with a link
to `config/devices.ts` and the one-line update command.

---

## 10. Notifications

| Channel | Scope | Controls |
|---|---|---|
| In-app inbox | always on | bell with unread count |
| Email | per user | user can switch to a daily digest or off; **Core Admins can turn email off org-wide** in Settings |
| Google Chat | per org | incoming-webhook URL in Settings › Notifications; **Core Admins can turn it off**; posts on: sent for review, changes requested, approved, reopened |
| Slack | v1.1 | same event set |

Events that notify: access approved; assigned to you; @mentioned; version uploaded (approvers);
changes requested (assignee, Publication); approved / reopened (everyone on the event); due
in 3 days / due today (assignee); draft sweep warning (creator); event deleted (everyone on
the event); yearly device reminder (Designers, Core Admins).

---

## 11. Screens

1. **Sign in** — logo, one Google button, one line of copy (or the "not accepting" message).
2. **Awaiting access** — status only.
3. **Events** (home, per org) — *Upcoming* / *Drafts* / *Past* groups. Row: title, date,
   progress ("5 of 8 approved"), overdue badge, "needs you" dot. Shared slot count in header.
   Primary: **New event**.
4. **New / edit event wizard** — §6.1.
5. **Event page** — header (title, date, venue, creator, Edit event), brief (collapsible),
   grid of format cards (thumb, name, state badge, vN, assignee, due; N/A cards dimmed),
   multi-select → **Approve selected**, activity feed.
6. **Asset page** — viewer (§9.3) left; tabs *Brief* · *Comments* · *Activity* right.
   Actions by state: Upload version · Request changes · Approve and notify · Approve and
   download · Reopen · Download. Mobile: sticky bar with **Request changes** and **Approve**
   (opens a two-option sheet). Every approve/reopen passes an "Are you sure?" dialog.
7. **Inbox**.
8. **Archive** — read-only.
9. **Settings** (Core Admin) — *Access requests* · *Users* (roles, tags, orgs, Approver) ·
   *Formats* (in-line catalog) · *Notifications* (email on/off, Google Chat webhook + on/off,
   "not accepting new members") · *Storage* (slot usage, next purge dates).

---

## 12. Design system

### 12.1 Colour (light; Sampark is WIP, so these are the app's own tokens with Sampark's names)

| Role | Token | Hex | Notes |
|---|---|---|---|
| Brand accent | `--color-brand` / hover / foreground / soft | `#F27267` / `#E05F55` / `#672D15` / `#FFF0EC` | The logo's coral is an accent (FAB, unread dots, "Needs you", initials discs). Text on it is the cocoa foreground. |
| Primary action | `--color-primary` / foreground | `#1E3A5F` / `#FFFFFF` | Ink navy: the complement to the logo's coral and marigold, 10.9:1. |
| Secondary action | `--color-secondary` / foreground | `#F4F4F5` / `#18181B` | Tinted neutral. |
| Background / Card | `--color-background`, `--color-card` | `#FFFFFF` | Subtle surface `#FAFAFA`, viewer canvas `#F4F4F5`. |
| Foreground | `--color-foreground` | `#09090B` | |
| Muted / Muted fg | `--color-muted` / `--color-muted-foreground` | `#F4F4F5` / `#52525B` | Muted text is 7.5:1 on white (was 4.3:1). |
| Border / Input / Ring | `--color-border`, `--color-input`, `--color-ring` | `#E4E4E7` / `#E4E4E7` / `#1E3A5F` | Hairlines, no drop shadows on lists. |
| Info | `--color-info` / soft / text | `#2563EB` / `#DBEAFE` / `#1E40AF` | In review. |
| Success | `--color-success` / soft / text | `#15803D` / `#DCFCE7` / `#166534` | Approved, progress bars. |
| Warning | `--color-warning` / soft / text | `#D97706` / `#FEF3C7` / `#92400E` | Draft. |
| Destructive | `--color-destructive` / fg / soft / text | `#DC2626` / `#FFFFFF` / `#FEE2E2` / `#991B1B` | Changes requested, destructive buttons. |
| Sidebar | bg / fg / accent / accent-fg / border | `#FAFAFA` / `#3F3F46` / `#EFEFF1` / `#18181B` / `#E4E4E7` | |

State badges are **tinted pills**: soft background with the dark text of the same hue, all
≥ 7:1. Requested = muted · In review = info · Changes requested = destructive · Approved =
success + check · N/A = dashed outline · Draft = warning · Needs you = brand soft.
Dark mode is not shipped; tokens are named so it can be added as a second mode.

### 12.2 Type, radius, icons
Google Sans Flex via `next/font` (the only Google Sans family available in the team's Figma; swap for Google Sans Text/Display if licensed). Sampark scale: Heading/xl
20/20 −2.5 % · Heading/lg 18/18 · Body/base 16/24 · Body/sm 14/20 · Label/xs 12/16 ·
Control/sm 12.8/16. Radius: sm 6 · md 8 · base 10 · lg 12 · xl 16 · 2xl 24 · full. Buttons use base, cards xl, sheets 2xl. Material Symbols Rounded,
weight 400, filled only for active nav and the Approved badge.

### 12.3 Layout
- ≥ 1024 px: 240 px sidebar (org switcher, Events, Inbox, Archive, Settings) + content ≤ 1200 px.
- 640–1023 px: icon rail.
- < 640 px: bottom tab bar (Events, Inbox, Archive, Profile; Profile holds the org switcher, Settings and sign-out); **media is edge-to-edge**: the Event page shows format slots as a
  2-column full-bleed media grid with 2 px gutters and overlaid state badges, the Asset page
  preview fills the viewport width, Archive reference strips run edge to edge, and lists use
  hairline dividers instead of boxed cards. The Asset page has a slide-up comment sheet and a
  sticky Request changes / Approve bar. Touch targets ≥ 44 px.
- All dates through one calendar-picker component; never free-text.

---

## 13. Technical architecture

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript, server actions |
| UI | shadcn/ui on Tailwind CSS v4; tokens from §12 as CSS variables |
| Auth | Supabase Auth, Google provider; RLS on every table |
| Database | Supabase Postgres (new project in org `pshkr`) |
| Storage | Supabase Storage, private buckets `assets` (optimised/preview/thumb/reference); signed URLs ≤ 10 min |
| Processing | `sharp` (MozJPEG/WebP/PNG), `pdf-lib` + `pdfjs` for PDF split/raster, in a Node runtime route triggered after upload |
| Jobs | Vercel Cron: nightly `retention` (archive, purge, draft sweep), hourly `digest`, yearly `device-reminder` |
| Email | Resend (free tier) with React Email templates |
| Chat | Google Chat incoming webhook (POST JSON card) |
| Hosting | Vercel Hobby, Git integration on `main`, preview deployments per PR |
| Config | `config/devices.ts`, `config/orgs.ts`, env: `INITIAL_CORE_ADMIN_EMAILS` (three addresses), `APP_TIMEZONE=America/New_York` |

Non-functional: responsive 360–1920 px; Lighthouse mobile ≥ 90 on Events and Asset pages;
previews ≤ 1600 px WebP, lazy-loaded; WCAG 2.1 AA contrast (brand coral is used for fills
with dark foreground, never small text on white); all times displayed in America/New_York.

---

## 14. Data model (draft)

```sql
organisations(id, slug, name, chat_webhook_url, email_enabled bool, chat_enabled bool, accepting_signups bool)
users(id ← auth.users, email, name, avatar_url, role enum('member','core_admin'),
      is_approver bool, function_tags text[] /* central|publication|designer */,
      status enum('pending','active','removed'), email_pref enum('instant','digest','off'))
org_memberships(user_id, org_id)
access_requests(id, user_id, requested_at, decided_by, decided_at, decision)
formats(id, key, name, width, height, unit enum('px','in'), dpi, class enum('print','digital'),
        frame enum('phone','card','flat','tv','led','print'), safe_top, safe_right, safe_bottom, safe_left,
        bleed_in numeric, safe_margin_in numeric, allow_custom_size bool, allowed_mimes text[], active bool, sort)
events(id, org_id, title, event_date date, venue, status enum('draft','active','archived'),
       created_by, brief_locked_at, deleted_at, last_edited_at, created_at)
brief(event_id pk, description, venue, notes)
briefs(event_id, description [invite text], time_text [all timings, free text, one line each], venue_name, venue_address, notes)  — v1.1: replaced the brief_timings table
slots(id, event_id, format_id, requested bool /* false = N/A */, custom_w, custom_h, notes,
      assignee_id, due_on, state enum('requested','in_review','changes_requested','approved'))
versions(id, slot_id, number, uploaded_by, created_at, decision enum('pending','approved','changes_requested','superseded'),
         decided_by, decided_at, reopen_reason, purged_at)
version_sides(id, version_id, side enum('front','back'), mime, width, height, bytes,
              optimised_path, preview_path, thumb_path, reference_path)
comments(id, version_id, author_id, parent_id, body, mentions uuid[], pin_x, pin_y,
         addressed_at, addressed_by, confirmed_at, confirmed_by, created_at)
activity(id, org_id, event_id, slot_id, version_id, actor_id, kind, payload jsonb, created_at)
notifications(id, user_id, kind, payload jsonb, read_at, emailed_at, created_at)
```

---

## 15. Delivery plan

| Step | Deliverable |
|---|---|
| 1 | PRD v1.0 (this document) → PR to `main` |
| 2 | Figma: new file "Design & Concur" consuming Sampark as a library; components + the nine screens at desktop and mobile widths via Figma MCP |
| 3 | Scaffold: Next.js + Tailwind v4 + shadcn/ui + Google Sans + Material Symbols; tokens; Supabase project, schema, RLS, seed (orgs, formats, bootstrap admins) |
| 4 | Auth, awaiting-access, Settings › Access & Users |
| 5 | Event wizard, Event page, format slots, N/A, calendar picker |
| 6 | Upload pipeline (optimise, watermark, thumbs), Asset page viewer with frames, safe areas, lightbox |
| 7 | Comments, @mentions, addressed/confirmed, approvals, reopen, bulk approve, confirmation dialogs |
| 8 | Notifications: inbox, email, Google Chat; retention, draft sweep, device reminder crons |
| 9 | Vercel project, env vars, first deploy, admin onboarding |
