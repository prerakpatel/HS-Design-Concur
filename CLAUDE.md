# Design & Concur by Harisumiran

Asset request, review and approval platform for Harisumiran temple and its non-profit wing.
Product requirements live in `docs/PRD.md`. Design tokens come from the Sampark Design System
(Figma). Stack (proposed): Next.js · TypeScript · Tailwind v4 · shadcn/ui · Supabase · Vercel.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`prerakpatel/HS-Design-Concur`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.

## Framework notes (from create-next-app)

<!-- BEGIN:nextjs-agent-rules -->



This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
