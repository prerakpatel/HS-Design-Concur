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
under 1 MB). It replaces the coloured initial in the sidebar, the phone Profile tab, the org switcher and the
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

Run it by hand: a signed-in Core Admin can simply open https://hsdesign.vercel.app/api/jobs/daily in the browser. Or with the cron secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://hsdesign.vercel.app/api/jobs/daily
```

The JSON reply lists what it did (`retention.archived`, `filesRemoved`, `errors`, …).

## Email (on hold)

Resend needs a verified sender domain, and nobody on the team controls hariss.org DNS yet, so email is parked.
The Inbox "Email me" row, the per-org email switch and the Settings → Email section are hidden until
`RESEND_API_KEY` and `EMAIL_FROM` are set on Vercel; nothing else changes when they are. Push, in-app, Google
Chat and Slack cover everyone meanwhile.

## Push notifications

Web Push to phones and desktops that turned it on from Inbox → "Notify this device". The browser keeps a
subscription in `push_subscriptions`; `notify()` sends to every device of each recipient, alongside the in-app
row. Needs `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` on Vercel
(generate a pair once with `npx web-push generate-vapid-keys`; rotating them silently drops every subscription).
iPhones only receive push from the installed app: Share → Add to Home Screen, then turn it on from there.
The service worker is `public/sw.js`.

## Slack

Per org, Settings → Organisations: turn on Slack notifications and paste an incoming-webhook URL
(Slack app → Incoming Webhooks → Add New Webhook to Workspace → pick the channel). "Test Slack" posts a hello.

## What goes to chat, and who gets pinged

Every post goes to the org's Google Chat space and/or Slack channel; the people it concerns are @mentioned
(everyone else just reads along). One message per moment; a bulk approval is one message.

| Moment | Who is @mentioned |
|---|---|
| Event published (lists format → designer, due dates) | the assigned designers |
| Format assigned after publishing | the designer |
| Design uploaded / ready for review | approvers and the event creator |
| Approved | the designer (uploader / assignee) |
| All formats approved 🎉 | event creator and Publication |
| Changes requested, reopened (with the note) | the designer |
| Comment with @name | the people named |
| Comment without @name | the designer and anyone already in that thread |
| Due in 3 days / due today | the designer |
| New access request | Core Admins |
| Access approved | the new member (a welcome) |
| Event archived | nobody, channel only |

**How a mention finds someone.** Google Chat: automatic. The Google account a person signs in with is also
their Chat identity, so `users.gchat_user_id` fills itself in at sign-in (`src/app/auth/callback/route.ts`).
Slack: each person pastes their Slack member ID on their Profile (Slack profile → ⋮ → Copy member ID), or a
Core Admin enters it in Settings → Users. Without an ID the post shows the name in bold instead of pinging.
"Send me a test mention" on the Profile page checks it end to end. Posts about one version (upload, approval,
changes, reopen, comments) carry the watermarked front preview as an image: Slack gets a Block Kit image,
Google Chat a card. The bucket is private, so the image is a signed link that works for 7 days. Someone who is on Slack only is simply
named in bold in Google Chat, and vice versa. Routing lives in `src/lib/notify.ts`; message wording in
`chatLines()` in `src/lib/labels.ts`.

## What works after step 4

- Event wizard (full-screen, outside the app shell, route group `(wizard)`): Basics → Brief (date with weekday, timings as one free-text block, invite text, venue name + address) → Formats (Requested / N/A, notes, custom size) → Assign (assignee, due) → Review → Publish (cap and horizon enforced).
- Uploads: PNG/JPG/WebP/GIF up to 8 MB go straight to Supabase Storage, then a server action produces the optimised file, a DRAFT-watermarked preview and a thumbnail (`src/lib/images.ts`). Print formats also take a PDF of up to two pages, rasterised at 150 dpi to Front and Back (`src/lib/pdf.ts`); the PDF itself is not kept.
- Bulk approve: on an event page, approvers use Select to approve several in-review formats together (own uploads excluded).
- Review: comments with @mentions and pins, addressed/confirm flags, Request changes, Approve and notify / download, Reopen. All approve/reopen actions pass an "Are you sure?" dialog.
- Settings: approve or deny access requests with org membership, edit role / Approver / tags / orgs, remove users, per-org notification switches and Google Chat / Slack webhook URLs. Formats tab: Designers and Core Admins add, edit, reorder and deactivate catalog formats; a new format joins every open event as N/A.
- Inbox: in-app notifications with mark-all-read; push, Google Chat and Slack fan-out with @mentions.
