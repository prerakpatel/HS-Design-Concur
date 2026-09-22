# Notifications: email and Google Chat (no coding)

In-app notifications always work. Email and Google Chat need two one-time setups.

## A · Google Chat (10 minutes, per space)

1. In Google Chat, open the space where the design team talks (or create one, e.g. *Design & Concur*).
2. Click the space name at the top → **Apps & integrations** → **Webhooks** → **Add webhook**.
3. Name: `Design & Concur`. Avatar URL (optional): `https://design-and-concur.vercel.app/watermark-tile.png`. **Save**.
4. Copy the webhook URL (starts with `https://chat.googleapis.com/v1/spaces/…`).
5. In the app: **Settings → Notifications** → paste it under the organisation → tick **Google Chat notifications** → **Save** → **Send test message**. A message should appear in the space.

Repeat for the ACC space if it has its own. What gets posted: sent for review, changes requested, approved, reopened (PRD §10). Mentions and assignments stay personal (in-app / email).

## B · Email (20 minutes, once)

Email is sent through Resend (free tier: 3,000 emails a month, plenty for a team this size).

1. Create an account at https://resend.com with a shared organisation login, not a personal one.
2. **Domains → Add domain** → enter the domain the emails should come from. Pick one you are happy to see in people's inboxes; a sub-domain such as `notify.<domain>` keeps the main domain's mail untouched. Resend shows 3 DNS records (SPF, DKIM, MX). Whoever manages that domain's DNS adds them; Resend shows **Verified** when they propagate, usually within an hour.
   - Skipping this step means Resend will only deliver to the account owner's own address, which is fine for a first test.
3. **API keys → Create API key** → name `vercel`, permission **Sending access** → copy the key (starts with `re_`).
4. Open https://vercel.com/hello-6042s-projects-0888460f/design-and-concur/settings/environment-variables and add two variables, all environments ticked:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `Design & Concur <notify@<your verified domain>>` (before verification you can test with `onboarding@resend.dev`)
5. Vercel → **Deployments** → latest → **⋯ → Redeploy**.
6. In the app: **Settings → Notifications → Send me a test email**.

## How people control email

Everyone chooses on their **Inbox** page: *as things happen* (default), *once a day* (a digest sent around 9 am New York time), or *never*. Core Admins can switch email off for a whole organisation in Settings → Notifications.

## What runs on a schedule

The daily job also creates these notifications (emailed to people on *as things happen*, included in the daily digest for others): due-date reminders, "your draft is deleted in 7 days", "your draft was deleted", and the 1 November phone-preset reminder for Designers and Core Admins.

### Details

A Vercel Cron job calls `/api/jobs/daily` at 13:00 UTC every day (`vercel.json`). It creates due-date reminders (3 days before and on the day), sends daily digests, and will run retention (archive / purge / draft sweep) once step 6 lands. It authenticates with `CRON_SECRET`, already set on Vercel. It needs `SUPABASE_SECRET_KEY` on Vercel to read across users.
