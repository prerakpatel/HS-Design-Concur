# Notifications: email and Google Chat (no coding)

In-app notifications and push always work. Email and Google Chat need two one-time setups; Slack is the same as Google Chat with a Slack webhook (Settings → Organizations).

## A · Google Chat (10 minutes, per space)

1. In Google Chat, open the space where the design team talks (or create one, e.g. *Design & Concur*).
2. Click the space name at the top → **Apps & integrations** → **Webhooks** → **Add webhook**.
3. Name: `Design & Concur`. Avatar URL (optional): `https://hsdesign.vercel.app/watermark-tile.png`. **Save**.
4. Copy the webhook URL (starts with `https://chat.googleapis.com/v1/spaces/…`).
5. In the app: **Settings → Notifications** → paste it under the organization → tick **Google Chat notifications** → **Save** → **Send test message**. A message should appear in the space.

Repeat for the ACC space if it has its own. What gets posted: new events, assignments, uploads, decisions, comments, due reminders and access requests, with the people concerned @mentioned (full table in [setup.md](setup.md#what-goes-to-chat-and-who-gets-pinged)). Google Chat mentions work automatically from the Google sign-in; for Slack each person pastes their member ID on their Profile.

## A2 · Slack (10 minutes, per channel)

1. Go to https://api.slack.com/apps → **Create New App** → **From scratch**. Name it `Design & Concur`, pick the Harisumiran workspace, **Create App**.
2. In the app's left menu open **Incoming Webhooks** → switch **Activate Incoming Webhooks** on.
3. Scroll down → **Add New Webhook to Workspace** → choose the channel the design team uses (e.g. `#design`) → **Allow**.
4. Copy the webhook URL (starts with `https://hooks.slack.com/services/…`). Treat it like a password: anyone holding it can post to that channel.
5. In the app: **Settings → Organizations** → paste it under the organization → tick **Slack notifications** → **Save** → **Test Slack**. A hello should land in the channel.
6. Optional but worth it: under **Basic Information → Display Information** give the app the Design & Concur icon so posts are easy to spot.

Repeat for a second channel if ACC has its own (one webhook URL per channel).

**Let the app find everyone's Slack ID (5 more minutes, once).** Without this each person pastes their member ID on their Profile; with it the app looks people up by email at sign-in and nightly.

7. Still in the Slack app: **OAuth & Permissions** → under **Scopes → Bot Token Scopes** add `users:read` and `users:read.email`.
8. At the top of the same page **Install to Workspace** (or **Reinstall**) → **Allow**. Copy the **Bot User OAuth Token** (starts with `xoxb-`).
9. Vercel → the project → **Settings → Environment Variables** → add `SLACK_BOT_TOKEN` = that token, all environments, mark it sensitive → **Save** → **Deployments → ⋯ → Redeploy**.
10. In the app: **Settings → Organizations → Match Slack members now**. It reports anyone whose Slack email differs from their sign-in email; those few paste their ID on their Profile (Slack: profile → ⋮ → **Copy member ID**). Comments keep their formatting in Slack: bold, italics, bullets, links and mentions; underline and colours have no Slack equivalent and are dropped.

## B · Email (20 minutes, once)

Email is sent through Resend (free tier: 3,000 emails a month, plenty for a team this size).

1. Create an account at https://resend.com with a shared organization login, not a personal one.
2. **Domains → Add domain** → enter the domain the emails should come from. Pick one you are happy to see in people's inboxes; a sub-domain such as `notify.<domain>` keeps the main domain's mail untouched. Resend shows 3 DNS records (SPF, DKIM, MX). Whoever manages that domain's DNS adds them; Resend shows **Verified** when they propagate, usually within an hour.
   - Skipping this step means Resend will only deliver to the account owner's own address, which is fine for a first test.
3. **API keys → Create API key** → name `vercel`, permission **Sending access** → copy the key (starts with `re_`).
4. Open https://vercel.com/hello-6042s-projects-0888460f/design-and-concur/settings/environment-variables and add two variables, all environments ticked:
   - `RESEND_API_KEY` = the key
   - `EMAIL_FROM` = `Design & Concur <notify@<your verified domain>>` (before verification you can test with `onboarding@resend.dev`)
5. Vercel → **Deployments** → latest → **⋯ → Redeploy**.
6. In the app: **Settings → Notifications → Send me a test email**.

## How people control email

Everyone chooses on their **Inbox** page: *as things happen* (default), *once a day* (a digest sent around 9 am New York time), or *never*. Core Admins can switch email off for a whole organization in Settings → Notifications.

## What runs on a schedule

The daily job also creates these notifications (emailed to people on *as things happen*, included in the daily digest for others): due-date reminders, "your draft is deleted in 7 days", "your draft was deleted", and the 1 November phone-preset reminder for Designers and Core Admins.

### Details

A Vercel Cron job calls `/api/jobs/daily` at 13:00 UTC every day (`vercel.json`). It creates due-date reminders (3 days before and on the day), sends daily digests, and will run retention (archive / purge / draft sweep) once step 6 lands. It authenticates with `CRON_SECRET`, already set on Vercel. It needs `SUPABASE_SECRET_KEY` on Vercel to read across users.
