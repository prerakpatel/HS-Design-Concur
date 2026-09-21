# Design & Concur by Harisumiran

Asset request, review and approval platform for Harisumiran (temple) and Atmiya Care Charities
(ACC, the non-profit wing). Product requirements: `docs/PRD.md`. Glossary: `CONTEXT.md`.
Design: `docs/design.md`. Environments and one-time setup: `docs/setup.md`.

Stack: Next.js 16 App Router · TypeScript · Tailwind CSS v4 · shadcn/ui (radix) · Supabase (Auth,
Postgres with RLS, Storage) · Vercel. Fonts: Google Sans Flex; icons: Material Symbols Rounded via
the `Icon` component (`src/components/material-icon.tsx`).

## Conventions

- Tokens live in `src/app/globals.css` (PRD §12.1). Use the semantic Tailwind colours
  (`bg-brand-soft`, `text-info-text`, `bg-subtle`) — never raw hex in components.
- State badges go through `StateBadge` (`src/components/state-badge.tsx`).
- Server-only data access uses `createClient()` from `src/lib/supabase/server.ts`; pages that need a
  signed-in, active user call `requireActiveUser()` from `src/lib/auth.ts`.
- `"use server"` modules export async functions only; constants live in `src/config/*`.
- Schema changes are new files under `supabase/migrations/`; the applied history is in Supabase.
- Before pushing: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

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
