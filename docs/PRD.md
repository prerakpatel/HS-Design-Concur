# Design & Concur by Harisumiran — Product Requirements Document

**Status:** Draft v0.1 (awaiting answers to the Open Questions in §14)
**Owner:** Prerak Patel
**Last updated:** 2026-09-21

---

## 1. Summary

Design & Concur is a small, controlled-access web app for Harisumiran (the temple) and its
non-profit wing to request, write, design, review and approve event invite artifacts
(flyers, banners, posters, social posts, Sambandh app assets, LED backwall, TV assets, etc.).

Today this happens over Slack: versions get lost, comments are scattered, and nobody can tell
which file is the approved one. Design & Concur replaces that with one place per event where
every asset has a clear owner, a clear state, a versioned history, threaded feedback and a
single "approved" download that is automatically de-watermarked.

Guiding principle: **utmost minimalism**. Few screens, few buttons, no configuration for
configuration's sake. Every screen answers "what needs my attention right now?"

---

## 2. Goals

1. One event page shows every requested asset, who owns the next step, and its state.
2. Every uploaded design is automatically watermarked **DRAFT** until approved.
3. Approval flips the asset to a clean, downloadable file and notifies everyone involved.
4. Feedback is threaded per asset version, never lost, and visibly "resolved" or not.
5. Runs entirely on free tiers (Vercel + a free database/storage provider) with automatic
   retention rules so storage never grows unbounded.
6. Access is gated: Google sign-in, then explicit admin approval before seeing anything.

## 3. Non-goals (v1)

- Event *management* (scheduling, ticketing, registrations). Events exist here only as a
  container for assets.
- Designing inside the tool. Designers work in their own tools and upload exports.
- Public sharing or public links. Everything is behind login.
- Video watermarking (see Q7). v1 watermarks raster images and PDFs.
- Slack integration (see Q13) — considered for v1.1 once the core flow is proven.

---

## 4. Users and roles

Everyone signs in with Google. A new Google account lands on a **"Awaiting access"** screen
until a Core Admin approves the request.

| Role | Who | Distinct permissions |
|---|---|---|
| **Member** | Executives, publishers/writers, designers, approvers | Everything except the admin actions below. Can create events, request assets, write content, upload designs, comment, approve, download. |
| **Sub-admin** | Trusted members chosen by a Core Admin | Member + **delete an event**. |
| **Core Admin** | Founding admin (bootstrapped by config) and anyone a Core Admin promotes | Sub-admin + **approve/deny access requests**, **remove users**, **promote/demote Sub-admins and Core Admins**, **manage the asset-type catalog**. |

Design note: the user stated that all non-admin permissions are universal. The app therefore
does **not** enforce "only executives can approve". Instead each member carries an
informational **function tag** (Executive · Publisher · Designer · Approver, multi-select) used
for routing notifications and defaulting assignees. See Q1 — this is the single most
consequential open question.

Safety rails that apply to everyone:
- A user cannot approve a version they uploaded themselves.
- Deleting an event is a soft delete with a 7-day restore window visible to admins.
- The last remaining Core Admin cannot be demoted or removed.

---

## 5. Core objects

```
Organization (Temple | Non-profit wing)
└── Event
    ├── title, org, event date(s), venue, owner (creator)
    ├── retention state (active | completed | archived-reference)
    └── Asset Request  (one per medium requested, e.g. "Instagram square")
        ├── asset type (from catalog) → target dimensions / format
        ├── content brief (description, timings[], venue, notes)   ← Publisher fills
        ├── assignee (designer), due date
        ├── state machine (see §6)
        └── Asset Version (v1, v2, …)                              ← Designer uploads
            ├── original file (private), watermarked derivative, thumbnail
            ├── comments (threaded, resolvable, optional x/y pin on the image)
            └── decision (approved | changes requested) by whom, when
```

### 5.1 Asset type catalog (seeded, admin-editable)

| Key | Name | Default size | Format |
|---|---|---|---|
| flyer_letter | Flyer (print, US Letter) | 2550 × 3300 px @300dpi | PDF/PNG |
| poster_a3 | Poster A3 | 3508 × 4961 px | PDF/PNG |
| banner_outdoor | Outdoor banner | custom (W × H in ft + resolution) | PDF |
| ig_square | Instagram / WhatsApp square | 1080 × 1080 | PNG/JPG |
| ig_story | Story / mobile vertical | 1080 × 1920 | PNG/JPG/MP4 |
| fb_cover | Facebook cover | 1640 × 856 | PNG/JPG |
| sambandh_card | Sambandh app card | **TBD (Q5)** | PNG |
| sambandh_banner | Sambandh app banner | **TBD (Q5)** | PNG |
| led_backwall | LED backwall backdrop | custom per venue (px) | PNG/MP4 |
| tv_landscape | TV / lobby screen | 1920 × 1080 | PNG/MP4 |

Adding a new medium = adding a catalog row (name, width, height, allowed formats, notes).
No code change required.

---

## 6. Workflow and state machine

```
 REQUESTED ──► CONTENT_READY ──► IN_DESIGN ──► IN_REVIEW ──► APPROVED
   (exec)        (publisher)      (designer)    (approver)
                                      ▲              │
                                      └── CHANGES_REQUESTED ◄┘
```

| Step | Actor | What happens | Notification |
|---|---|---|---|
| 1. Request | Executive | Creates an event (or picks an existing one), ticks the mediums needed, optionally sets due dates and assignees. Can be done months ahead. | Publishers + assigned designers |
| 2. Content | Publisher | Fills the content brief: rich-text description, one or more timing lines (date, start–end, label), venue, extra notes. Marks "Content ready". | Assigned designer(s) |
| 3. Design | Designer | Uploads a file → becomes **Version n**. Server generates a DRAFT-watermarked derivative and a thumbnail. State → In review. | Approvers (function tag) + requester |
| 4. Review | Approver | Views watermarked version, leaves threaded comments (optionally pinned to a point on the image), then either **Request changes** or **Approve**. | Designer + publisher on changes; **everyone on the event** on approve |
| 5. Approved | System | Watermarked derivative hidden; original becomes downloadable via a short-lived signed URL. Version locked. | All event participants |

Rules:
- Content and design may proceed in parallel (a designer can upload before content is
  marked ready) but the asset cannot be **approved** until content is marked ready. (Q3)
- One approval is sufficient (Q2). Approving any version supersedes earlier versions.
- A new upload after approval re-opens the asset (state → In review) and clearly labels the
  previously approved version as "Approved (superseded)".
- Every state change is written to an immutable **activity log** shown on the asset page.

---

## 7. Draft watermark

- Applied **server-side** at upload; the un-watermarked original is never served before
  approval.
- Pattern: diagonal, tiled "DRAFT" text at 45°, ~12% opacity, sized to ~1/6 of the shorter
  edge, plus a small "DRAFT · v{n} · {date}" caption in the bottom-right corner.
- Works on PNG, JPG, WebP, single- and multi-page PDF (each page rasterised for preview;
  the PDF itself gets a text overlay layer).
- Video (MP4): v1 stores the original and shows a **watermarked poster frame** only; no
  in-browser playback of un-watermarked video before approval. (Q7)

---

## 8. Storage, retention and the free-tier budget

### 8.1 Hard limits (from the brief)
1. **Rolling window:** keep at most **10 events** *or* events whose date is within **6 months**
   of today, whichever bound is hit first.
2. When the limit is reached and a new event is created, archive the **oldest completed
   event** (by event date) to make room. If no event is completed, creation is still allowed
   but the creator sees a warning that the window is over capacity. (Q9)
3. **7 days after an event's actual event date**, purge that event's full-resolution
   originals and every non-final version. Keep **one heavily compressed reference image per
   approved asset** (long edge 800 px, WebP ≈ 60 quality, ~50–80 KB) so the event is still
   browsable as a visual record. (Q10 — per asset vs. per event)
4. Archived-reference events remain visible under an **Archive** tab, read-only.

### 8.2 Budget model (Supabase free tier as the baseline, see §10)
| Resource | Free limit | Planned usage |
|---|---|---|
| Object storage | 1 GB | 10 events × ~8 assets × ~3 versions × ~8 MB ≈ 1.9 GB **worst case** → mitigated by per-file cap of 25 MB, version pruning after approval (keep latest 2 + approved), and the 7-day purge. Typical steady state ≈ 400–600 MB. |
| Database | 500 MB | Negligible (metadata only). |
| Egress | 5 GB/mo | Watermarked previews are served at max 1600 px; originals only on approved download. |
| Auth MAUs | 50 000 | ~20–40 users. |
| Scheduled jobs | Vercel Cron (2 jobs on Hobby) | Nightly retention job + hourly notification digest. |

Uploads go **directly from the browser to storage** via a signed upload URL (Vercel
serverless bodies are capped at 4.5 MB); the server then processes the watermark asynchronously.

---

## 9. Notifications

- **In-app inbox** (bell icon, unread count) — always on.
- **Email** for: access approved, asset assigned to you, changes requested on your version,
  asset approved (to all event participants), event deleted. Daily digest option per user.
- Channel: transactional email via a free-tier provider (Resend, 3 000/mo). (Q13 — Slack)

---

## 10. Technical architecture (proposed)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router), React 19, TypeScript** | Vercel-native, server actions for mutations, easy SSR for a small controlled app. |
| UI | **shadcn/ui** on Tailwind CSS v4, **Google Sans** (via `next/font`), **Material Symbols Rounded** icons | Matches the brief; shadcn tokens map 1:1 to the Sampark colour roles below. |
| Auth | **Supabase Auth — Google provider** | Free, handles the Google OAuth dance, gives us row-level security. |
| Database | **Supabase Postgres** with RLS | Free tier, relational fit (events → requests → versions → comments). |
| Storage | **Supabase Storage** (private buckets: `originals`, `derivatives`) | Signed URLs, direct browser upload, same project. |
| Image processing | `sharp` in a Vercel serverless route (Node runtime), `pdf-lib` for PDF overlay | Watermark + thumbnails + compressed reference. |
| Jobs | **Vercel Cron** → `/api/jobs/retention` (nightly), `/api/jobs/digest` (hourly) | No extra infra. |
| Email | Resend | Free tier, React email templates. |
| Hosting | **Vercel Hobby** | As requested. |
| Repo | GitHub `prerakpatel/HS-Design-Concur`, branch-per-feature, Vercel Git integration for preview deployments. |

Alternative considered: Vercel Postgres + Vercel Blob. Rejected for v1 because Vercel Blob's
free allowance is smaller and there is no bundled auth. Firebase is a viable second choice
if you already use it for Sambandh (Q11).

---

## 11. Design system

### 11.1 Colour — from Sampark Design System (Figma `jiCKqA20PSMxOSZNJDROZ6`, page 🧭 Foundations)

Light mode values as exported from the Figma variables. Dark mode exists in the file but the
values did not come through the variable export; they will be pulled when the Figma frames
are built (Step 2).

| Role | Token | Hex |
|---|---|---|
| Brand | `--color-brand` | `#FF5A52` |
| Brand hover | `--color-brand-hover` | `#E04840` |
| Background | `--color-background` | `#F9FAFB` |
| Foreground | `--color-foreground` | `#020817` |
| Card / Popover | `--color-card`, `--color-popover` | `#FFFFFF` |
| Primary | `--color-primary` | `#FF5A52` |
| Primary foreground | `--color-primary-foreground` | `#020817` |
| Secondary / Accent / Success | `--color-secondary`, `--color-accent`, `--color-success` | `#0567A3` |
| Secondary/Accent/Success foreground | `…-foreground` | `#F8FAFC` |
| Destructive | `--color-destructive` | `#DC2828` |
| Destructive foreground | `--color-destructive-foreground` | `#F8FAFC` |
| Muted | `--color-muted` | `#F1F5F9` |
| Muted foreground | `--color-muted-foreground` | `#64748B` |
| Border / Input | `--color-border`, `--color-input` | `#E2E8F0` |
| Ring | `--color-ring` | `#020817` |
| Sidebar bg | `--color-sidebar` | `#FAFAFA` |
| Sidebar fg | `--color-sidebar-foreground` | `#3F3F46` |
| Sidebar primary | `--color-sidebar-primary` | `#18181B` |
| Sidebar primary fg | `--color-sidebar-primary-foreground` | `#FAFAFA` |
| Sidebar accent | `--color-sidebar-accent` | `#F4F4F5` |
| Sidebar accent fg | `--color-sidebar-accent-foreground` | `#18181B` |
| Sidebar border | `--color-sidebar-border` | `#E5E7EB` |
| Sidebar ring | `--color-sidebar-ring` | `#3B82F6` |

Status colours for asset states (proposed, derived from the palette):
Requested = muted · Content ready = secondary/blue · In design = secondary/blue ·
In review = brand/coral · Changes requested = destructive · Approved = success/blue with check.
(Note: Sampark maps *success* to the same blue as secondary; if a green is wanted for
"Approved" that is a new token — Q15.)

### 11.2 Typography (Sampark scale)
Heading/xl 20/20 −2.5% · Heading/lg 18/18 −2.5% · Body/base 16/24 · Body/sm 14/20 ·
Label/xs 12/16 · Control/sm 12.8/16 · Label/2xs 10.4/14 · Mono/xs 12/16.
Family: **Google Sans** (Text for body, Display for headings). Fallback: system-ui.

### 11.3 Radius: sm 4 · md 6 · base 8 · lg 8 · xl 12.

### 11.4 Iconography: Material Symbols Rounded, weight 400, optical size 20/24, filled
variant only for the active nav item and the "Approved" badge.

### 11.5 Layout
- ≥1024 px: fixed 240 px sidebar (Events · Inbox · Archive · Admin) + content column max 1200 px.
- 640–1023 px: collapsible sidebar (icon rail).
- <640 px: bottom tab bar; asset review becomes a full-screen viewer with a slide-up
  comment sheet. Approve / Request changes are sticky at the bottom.

---

## 12. Screens (v1)

1. **Sign in** — single Google button, logo, one line of copy.
2. **Awaiting access** — shown until approved; admins see the same person in Admin › Access.
3. **Events** (home) — list grouped by *Upcoming* / *Past*, each row: title, org chip, date,
   asset progress (e.g. "5 of 8 approved"), "needs you" indicator. Filter by org, by "assigned
   to me", by state. Primary button: **New event**.
4. **New event / Request assets** — one form: org, title, date(s), venue, then a checklist of
   asset types with per-type due date and assignee. Submits in one go.
5. **Event page** — header (title, org, date, venue, owner), grid of asset cards (thumbnail,
   type, state badge, version, assignee), activity feed on the right (desktop) or below (mobile).
6. **Asset page** — left: version viewer with watermark, version switcher, zoom;
   right: tabs *Brief* (content) · *Comments* · *Activity*. Bottom/right actions vary by state:
   *Mark content ready*, *Upload version*, *Request changes*, *Approve*, *Download approved*.
7. **Inbox** — notifications, mark read, jump to asset.
8. **Archive** — read-only past events with reference thumbnails.
9. **Admin** — tabs: *Access requests* · *Users & roles* · *Asset types* · *Storage* (usage
   meter, next purge dates).

---

## 13. Non-functional requirements

- Responsive from 360 px to 1920 px; touch targets ≥ 44 px on mobile.
- Lighthouse performance ≥ 90 on the Events and Asset pages (mobile).
- Image previews served as WebP, max 1600 px, lazy-loaded.
- All storage buckets private; every file read goes through a signed URL with ≤ 10 min TTL
  (previews) or ≤ 60 s TTL (approved originals).
- Row-level security so a user with a valid session but no approved access reads nothing.
- Accessibility: WCAG 2.1 AA colour contrast (note: brand coral on white passes only for
  large text; use it for fills with dark foreground, not for small text on white).
- Time zone: all event dates stored as date + IANA zone; default **America/New_York** (Q8).

---

## 14. Open questions — please answer these (defaults shown are what v1 will do if unanswered)

**Roles and approval**
1. **Q1 · Who can approve?** You said all non-admin permissions are universal. Literally that
   means a designer could approve their own team's work. *Default:* anyone can approve except
   the uploader of that version; "Approver" is a function tag used only for notifications.
   Alternative: make Approver an enforced permission granted by admins.
2. **Q2 · How many approvals?** *Default:* one approval from any eligible person approves the
   asset. Alternative: all tagged approvers must approve, or a per-event named approver list.
3. **Q3 · Can design start before content is marked ready?** *Default:* yes, but approval is
   blocked until content is ready.
4. **Q4 · Is content itself approved?** i.e. does an executive sign off on the write-up
   before the designer sees it? *Default:* no separate content approval; comments on the
   Brief tab cover it.

**Asset types**
5. **Q5 · Sambandh dimensions** — exact width × height (px) and format for each Sambandh
   placement you want seeded.
6. **Q6 · LED backwall and banners** — do these vary per venue? *Default:* the requester types
   custom W × H when requesting; admins can save named presets ("Main hall LED 3840×1080").
7. **Q7 · Video assets** — do TV/LED assets include MP4s? *Default:* uploads allowed up to
   25 MB, watermarked poster frame only, no video watermarking in v1.

**Events**
8. **Q8 · Time zone and multi-day events.** *Default:* America/New_York; an event has a start
   date and optional end date; retention uses the end date.
9. **Q9 · When the 10-event / 6-month window is full and nothing is "completed"** —
   block creation, or allow with a warning? *Default:* allow with warning; admins see a
   Storage tab.
10. **Q10 · Post-event compressed reference** — one image *per approved asset*, or one image
    *per event* (the primary flyer)? *Default:* one per approved asset (~60 KB each).
11. **Q11 · Do you already use Firebase/Supabase/Google Cloud for Sambandh?** If yes, reusing
    that project may be cheaper than a new Supabase project. *Default:* new Supabase project.

**Access and notifications**
12. **Q12 · Google sign-in restriction** — any Google account may request access, or only a
    specific Workspace domain? *Default:* any account; admin approval is the gate.
13. **Q13 · Slack** — you currently live in Slack. Post "approved" and "changes requested"
    events to a Slack channel via webhook in v1? *Default:* email + in-app only; Slack in v1.1.
14. **Q14 · Who is the first Core Admin?** *Default:* the email set in the
    `INITIAL_CORE_ADMIN_EMAIL` environment variable.

**Design**
15. **Q15 · "Approved" colour** — Sampark's success token is the same blue as secondary. Keep
    blue for Approved, or add a green token? *Default:* keep blue + check icon.
16. **Q16 · Dark mode in v1?** The Sampark file defines it. *Default:* ship light only,
    tokens wired so dark is a flag flip.
17. **Q17 · Two organisations** — does the non-profit wing need its own logo/brand accent in
    the UI, or is an "org chip" on each event enough? *Default:* chip only.

**Files**
18. **Q18 · Download formats for approved assets** — final exports only (PNG/JPG/PDF/MP4), or
    also source files (AI/PSD/Figma links)? *Default:* exports only; a "source link" text
    field per version for Figma/Drive URLs.
19. **Q19 · Per-file size cap.** *Default:* 25 MB (Supabase free tier allows 50 MB).

---

## 15. Delivery plan

| Step | Deliverable | Notes |
|---|---|---|
| 1 | **This PRD**, answers to §14 | You are here. |
| 2 | **Figma** — Sampark-based component set + the 9 screens in §12 at desktop and mobile widths, pushed into a new page of the Sampark file (or a new file) via Figma MCP | Uses `use_figma` with the Foundations variables. |
| 3 | **Repo scaffold** — Next.js 15 + Tailwind v4 + shadcn/ui + Google Sans + Material Symbols; tokens from §11 as CSS variables; Supabase schema + RLS migrations; seed asset catalog | On `claude/gifted-carson-7ykp16`, then PR to `main`. |
| 4 | **Auth + access gate + admin** | Google login, awaiting-access, roles. |
| 5 | **Events + asset requests + content brief** | Steps 1–2 of the workflow. |
| 6 | **Upload + watermark + versions + comments + approve/download** | Steps 3–5. |
| 7 | **Notifications + retention cron + archive** | §8, §9. |
| 8 | **Vercel deploy**, env vars, custom domain (optional), first Core Admin onboarding | |

---

## Appendix A — Data model (draft)

```sql
organizations(id, name, slug)
users(id ← auth.users, email, name, avatar_url, role enum('member','sub_admin','core_admin'),
      function_tags text[], status enum('pending','active','removed'), created_at)
access_requests(id, user_id, requested_at, decided_by, decided_at, decision)
asset_types(id, key, name, width_px, height_px, allow_custom_size bool, formats text[], notes, active)
events(id, org_id, title, starts_on date, ends_on date, tz, venue, created_by,
       status enum('active','completed','archived'), deleted_at, created_at)
asset_requests(id, event_id, asset_type_id, custom_w, custom_h, assignee_id, due_on,
       state enum('requested','content_ready','in_design','in_review','changes_requested','approved'),
       brief_description text, brief_venue text, brief_notes text, content_ready_at, created_by)
brief_timings(id, asset_request_id, label, on_date, starts_at, ends_at, sort)
asset_versions(id, asset_request_id, number, uploaded_by, original_path, derivative_path,
       thumb_path, reference_path, mime, bytes, width, height, source_link, created_at,
       decision enum('pending','approved','changes_requested'), decided_by, decided_at, purged_at)
comments(id, version_id, author_id, parent_id, body, pin_x numeric, pin_y numeric,
       resolved_at, resolved_by, created_at)
activity(id, event_id, asset_request_id, version_id, actor_id, kind, payload jsonb, created_at)
notifications(id, user_id, kind, payload jsonb, read_at, emailed_at, created_at)
```
