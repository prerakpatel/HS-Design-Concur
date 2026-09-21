# Working locally, pushing to GitHub, and deploying to Vercel

A plain-language guide for testing changes on your own machine before they go live. No engineering
background needed. Everything here is done from a terminal (Terminal on Mac, PowerShell or Git Bash
on Windows) inside the project folder.

## The big picture

```
your laptop  ──git push──▶  GitHub (prerakpatel/HS-Design-Concur)  ──automatic──▶  Vercel
  npm run dev                  main branch = production                     https://design-and-concur.vercel.app
  http://localhost:3000        other branches = preview deployments        https://<branch>-....vercel.app
```

- **Your laptop** runs the app at `http://localhost:3000` against the *real* Supabase database, so
  what you see locally is the same data as the live site. Sign in with the same Google account.
- **GitHub** stores the code. The `main` branch is what is live.
- **Vercel** watches GitHub. Every push to `main` becomes the live site within about two minutes.
  Every push to any other branch gets its own temporary preview URL, so you can try a change live
  without touching production.

## One-time setup on a new machine

1. Install [Node.js 22 LTS](https://nodejs.org) (includes `npm`) and [Git](https://git-scm.com).
   On a Mac, `git` comes with Xcode command line tools; run `xcode-select --install` if asked.
2. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/prerakpatel/HS-Design-Concur.git
   cd HS-Design-Concur
   npm install
   ```

3. Create your local environment file. This holds the keys the app needs and is never committed:

   ```bash
   cp .env.example .env.local
   ```

   Open `.env.local` in any text editor and fill in:

   | Variable | Where to get it |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard → project *design-and-concur* → Settings → API keys → *Publishable key* |
   | `SUPABASE_SECRET_KEY` | Same page → *Secret key*. Needed for uploads and admin actions. Keep it private. |
   | `RESEND_API_KEY`, `EMAIL_FROM` | Optional locally. Leave blank to skip real emails; notifications still appear in the Inbox. |
   | `CRON_SECRET` | Optional locally. Any random string; only used to call `/api/jobs/daily` by hand. |

   The URL, timezone and `NEXT_PUBLIC_APP_URL=http://localhost:3000` are already filled in.

4. Make sure Supabase allows sign-in from localhost: Supabase → Authentication → URL configuration
   → *Redirect URLs* must include `http://localhost:3000/**`. This was done during setup; check it
   if Google sign-in bounces you back to the login page.

## Every day: run the app locally

```bash
cd HS-Design-Concur
git pull origin main        # get the latest code
npm run dev                 # starts the app; leave this running
```

Open `http://localhost:3000`. Edits to any file reload the page automatically. Press `Ctrl+C` in the
terminal to stop.

If something looks broken after pulling, run `npm install` again (new packages may have been added).

## Before you push: the three checks

These are exactly what Vercel runs. If they pass here, the deploy will not fail.

```bash
npm run lint          # code style and common mistakes
npx tsc --noEmit      # type errors
npm run build         # full production build (takes about a minute)
```

## Pushing a change to GitHub

Work on a branch, not directly on `main`, so you get a preview deployment and a pull request to
review the change.

```bash
git checkout -b my-change          # 1. new branch (any short name, no spaces)
# ...edit files, test with npm run dev...
git add -A                         # 2. stage everything you changed
git commit -m "Short description"  # 3. save a snapshot
git push -u origin my-change       # 4. send it to GitHub
```

GitHub prints a link to open a **pull request** (PR). Open it, look at the diff, and check the
Vercel bot comment: it contains the preview URL for this branch. Click *Merge pull request* when
you are happy. Merging into `main` deploys to production automatically.

To pick up the merged code on your laptop afterwards:

```bash
git checkout main
git pull origin main
```

### If you would rather skip branches

Pushing straight to `main` also works and deploys immediately:

```bash
git add -A && git commit -m "Short description" && git push origin main
```

Use this for tiny, safe edits (copy changes, a colour). Anything larger deserves a preview first.

## Watching a deployment

- Vercel dashboard → project *design-and-concur* → **Deployments**. Each push appears within seconds
  with a status of Building → Ready (or Error).
- Click a deployment to see its build log. An *Error* almost always means one of the three checks
  above failed; run them locally to see the same message.
- **Environment variables** for production live in Vercel → Settings → Environment Variables.
  Changing one requires a redeploy (Deployments → ⋯ → Redeploy) to take effect.

## Working with Claude Code on the repo

Sessions like this one push to a branch named `claude/...` and open a PR. Nothing reaches your
laptop until you `git pull`. After a PR is merged:

```bash
git checkout main && git pull origin main && npm install
```

## Design preview (no database needed)

For checking the look of screens with sample data, the app has a preview mode that renders real
components with fixtures and no sign-in:

```bash
DESIGN_PREVIEW=1 npm run dev
# then open http://localhost:3000/preview/events (also: event, slot, settings, requests, inbox,
# wizard-basics, wizard-brief, wizard-formats, wizard-assign, wizard-review)
```

On Windows PowerShell use `$env:DESIGN_PREVIEW="1"; npm run dev`. The preview routes return 404
unless that variable is set, so they never exist in production.

`npm run screenshots` captures every preview screen at desktop (1440×900) and phone (393×852)
sizes into a `screenshots/` folder (ignored by git). It needs the dev server running in preview
mode and a Chromium install; set `CHROME_PATH` if it is not found automatically.

## Common problems

| Symptom | Fix |
|---|---|
| `command not found: npm` | Node.js is not installed or the terminal was opened before installing. Reinstall Node, open a new terminal. |
| Sign-in loops back to the login page | Add `http://localhost:3000/**` to Supabase redirect URLs. |
| "Missing Supabase environment variables" | `.env.local` is missing or a key is blank. Restart `npm run dev` after editing it. |
| Uploads fail locally | `SUPABASE_SECRET_KEY` is blank in `.env.local`. |
| `git push` rejected | Someone pushed first. Run `git pull origin main` (or your branch), resolve if asked, push again. |
| Port 3000 in use | Another dev server is running. Stop it, or run `npm run dev -- -p 3001`. |
