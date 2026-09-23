# Setup

## What already exists

| Piece | Where |
|---|---|
| Supabase project `design-and-concur` | org **pshkr**, region us-east-1, ref `gegiwouyrhcexjozkbhh`, https://gegiwouyrhcexjozkbhh.supabase.co |
| Schema, RLS, storage bucket `assets`, seed (orgs, 12 formats, 3 bootstrap Core Admins) | `supabase/migrations/20260921000000_initial_schema.sql` (already applied) |
| Vercel project | linked to `prerakpatel/HS-Design-Concur`, deploys `main` |

## One-time steps only you can do

Plain-language walkthroughs: [google-signin.md](google-signin.md) · [notifications.md](notifications.md) (email and Google Chat).

1. **Google sign-in provider.** Supabase dashboard → Authentication → Providers → Google. Paste a
   Google OAuth client ID and secret (Google Cloud Console → APIs & Services → Credentials →
   OAuth client, type Web). Authorised redirect URI:
   `https://gegiwouyrhcexjozkbhh.supabase.co/auth/v1/callback`.
2. **Site URL and redirect list.** Supabase → Authentication → URL configuration. Site URL is your
   Vercel production URL. Add `http://localhost:3000/**` and `https://<vercel-domain>/**` to the
   redirect allow-list.
3. **Secret key on Vercel.** Vercel project → Settings → Environment variables →
   `SUPABASE_SECRET_KEY` (Supabase → Settings → API keys → secret). Only server code reads it.

## Local development

```bash
git clone https://github.com/prerakpatel/HS-Design-Concur.git
cd HS-Design-Concur
cp .env.example .env.local     # fill in the publishable key from Supabase → Settings → API keys
npm install
npm run dev                    # http://localhost:3000
```

`npm run lint`, `npx tsc --noEmit` and `npm run build` are what CI and Vercel run. Step-by-step
guide for non-engineers, including pushing and deploying: [local-dev.md](local-dev.md).

## How access works

- First sign-in creates a `users` row via the `on_auth_user_created` trigger.
- Emails in `bootstrap_admins` become active Core Admins in both orgs immediately.
- Everyone else is `pending` and sees `/awaiting` until a Core Admin approves them and picks their org(s).
- The `dc.org` cookie remembers which org view you are in.

## Schema changes

Add a new file under `supabase/migrations/` and apply it with the Supabase MCP `apply_migration`
tool or the Supabase CLI. Never edit an applied migration.

## Branding

Settings → Organisations lets a Core Admin upload each organisation's logo (PNG or SVG, square works best,
under 1 MB). It replaces the coloured initial in the sidebar, the phone top bar, the org switcher and the
sign-in page. Logos live in the public `branding` bucket; the sign-in page reads names and logos through the
`org_branding` view, which exposes only those columns. The sign-in illustration is `public/brand/design-concur-hero.webp`.

## Retention (step 6)

The daily job at `/api/jobs/daily` (Vercel Cron, 13:00 UTC) runs `src/lib/retention.ts` after the
due-date reminders:

| When | What happens |
|---|---|
| 7 days after an event date | The primary format keeps one small reference image (front, and back for print). Every other file is deleted. The event moves to **Archive**, read-only, and its event slot is freed. |
| 7 days after a delete | The event and its files are gone for good. Until then Core Admins see it under Archive → *Recently deleted* with a Restore button. |
| Draft untouched 23 days | Creator gets an in-app notification and email. Any edit resets the clock. |
| Draft untouched 30 days | Draft is deleted; creator is told. |
| 1 November | Designers and Core Admins are reminded to refresh `src/config/devices.ts`. |

Run it by hand (needs `CRON_SECRET` from Vercel → Settings → Environment variables):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://hsdesign.vercel.app/api/jobs/daily
```

The JSON reply lists what it did (`retention.archived`, `filesRemoved`, `errors`, …).

## Push notifications

Web Push to phones and desktops that turned it on from Inbox → "Notify this device". The browser keeps a
subscription in `push_subscriptions`; `notify()` sends to every device of each recipient, alongside the in-app
row. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` on Vercel
(generate a pair once with `npx web-push generate-vapid-keys`; rotating them silently drops every subscription).
iPhones only receive push from the installed app: Share → Add to Home Screen, then turn it on from there.
The service worker is `public/sw.js`.

## Slack

Per org, Settings → Organisations: turn on Slack notifications and paste an incoming-webhook URL
(Slack app → Incoming Webhooks → Add New Webhook to Workspace → pick the channel). Same four moments as Google
Chat: ready for review, changes requested, approved, reopened. "Test Slack" posts a hello.

## What works after step 4

- Event wizard (full-screen, outside the app shell, route group `(wizard)`): Basics → Brief (date with weekday, timings as one free-text block, invite text, venue name + address) → Formats (Requested / N/A, notes, custom size) → Assign (assignee, due) → Review → Publish (cap and horizon enforced).
- Uploads: PNG/JPG/WebP/GIF up to 8 MB go straight to Supabase Storage, then a server action produces the optimised file, a DRAFT-watermarked preview and a thumbnail (`src/lib/images.ts`). Print formats also take a PDF of up to two pages, rasterised at 150 dpi to Front and Back (`src/lib/pdf.ts`); the PDF itself is not kept.
- Bulk approve: on an event page, approvers use Select to approve several in-review formats together (own uploads excluded).
- Review: comments with @mentions and pins, addressed/confirm flags, Request changes, Approve and notify / download, Reopen. All approve/reopen actions pass an "Are you sure?" dialog.
- Settings: approve or deny access requests with org membership, edit role / Approver / tags / orgs, remove users, per-org notification switches and Google Chat / Slack webhook URLs. Formats tab: Designers and Core Admins add, edit, reorder and deactivate catalog formats; a new format joins every open event as N/A.
- Inbox: in-app notifications with mark-all-read. Email and Google Chat fan-out are next.
