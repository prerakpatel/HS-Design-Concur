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

## What works after step 4

- Event wizard: Basics → Brief (timings) → Formats (Requested / N/A, notes, custom size) → Assign (assignee, due) → Review → Publish (cap and horizon enforced).
- Uploads: PNG/JPG/WebP/GIF up to 8 MB go straight to Supabase Storage, then a server action produces the optimised file, a DRAFT-watermarked preview and a thumbnail (`src/lib/images.ts`). PDF for print formats is not in yet.
- Review: comments with @mentions and pins, addressed/confirm flags, Request changes, Approve and notify / download, Reopen. All approve/reopen actions pass an "Are you sure?" dialog.
- Settings: approve or deny access requests with org membership, edit role / Approver / tags / orgs, remove users, per-org notification switches and Google Chat webhook URL (the webhook is stored; posting arrives with the notifications release).
- Inbox: in-app notifications with mark-all-read. Email and Google Chat fan-out are next.
