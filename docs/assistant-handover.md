# Vichar (the assistant): handover

Parked on 16 November 2026 at the owner's request. Everything lives on the `assistant` branch, which was fully merged
with `main` (f6e7911) when it was parked: 66 commits ahead, 0 behind. Nothing from it is on `main`. Nothing of it is
visible to normal users even where it is deployed, because every piece is gated by `users.assistant_enabled`, which
only the owner (`ASSISTANT_OWNER` in `src/config/assistant.ts`) can switch on, from Settings → People.

Read this first, then `docs/assistant.md` (how it works and behaves), `docs/assistant-next.md` (the agreed next
round, with the iOS 27 Siri research), and the "The assistant" section of `docs/testing.md` (the manual checklist).

## What it is

A voice-first helper for the phone, with a desktop panel. Tap the mic, say what you need in Gujarati or English, and
he drafts it as a card: a new project with its formats, a format added to an existing project, an update to a draft
project, or comments / change requests on a design with @mentions. Nothing is created until a button on the card is
tapped. A canned two-step walk-through teaches it without calling the model. He has a character (Vichar, a boy in a
hoodie), a hello card on Projects, a raised mic in a notch in the bottom bar, and an easter egg behind a tiny chair.

## How to pick it up again

1. `git fetch origin && git checkout assistant && git merge origin/main`. Expect conflicts only in files both sides
   touch: `src/components/mobile-nav.tsx`, `mobile-top-bar.tsx`, `app-shell.tsx`, `app-sidebar.tsx`,
   `src/app/(app)/settings/page.tsx`, `src/components/settings/user-editor.tsx`, `src/app/actions/admin.ts`,
   `src/lib/types.ts`, `src/app/globals.css`, `docs/testing.md`, `package.json`. Keep both sides' additions; the
   assistant-aware versions of the nav and top bar are supersets of main's.
2. If `globals.css` changed on either side, run `npm run tokens` and commit `src/config/design-tokens.ts`, or
   `npm test` fails. The branch's font stack includes "Noto Serif Gujarati" on purpose.
3. If `src/config/icons.ts` conflicts, take either side and rerun `node scripts/icon-names.mjs`.
4. Run the four checks before pushing, chained so a failure stops the chain:
   `set -o pipefail; npm run lint && npx tsc --noEmit && npm test && npm run build`.
5. Keys. `ANTHROPIC_API_KEY` is required (the Anthropic key in use was due to expire on 13 November 2026, so check it
   in Vercel before the first test). `SARVAM_API_KEY` or `GEMINI_API_KEY` is optional for transcription; without
   one the browser listens on its own. Names are in `.env.example`; values live only in Vercel.
6. Test in the Test sandbox organisation (slug `sandbox`), never in Harisumiran. It holds a seeded sample project,
   "Sample · Diwali Sabha 2026", with four formats in four states. Its preview images were borrowed from an old
   deleted sandbox event and will have been purged by the time you read this; upload one image through the app to
   each format you want to see, and the rest works.
7. Settings → Vichar (visible only to people he is on for) brings the hello card and walk-through back on this
   device, once or on every load. Use it while testing.

## Where things are

| Area | Files |
|---|---|
| Config | `src/config/assistant.ts` (owner, name, artwork paths and timings, model and effort, clip limit, speech keyterms, hello-card version) |
| Gate | `src/lib/assistant/access.ts` (`assistantAllowed`, `isAssistantOwner`), `users.assistant_enabled` (migration `supabase/migrations/20261014000000_assistant.sql`, additive, already applied in Supabase) |
| Brain | `src/lib/assistant/brain.ts` (the model call), `schema.ts` (zod schemas the model fills: ProjectDraft, FormatPick, CommentDraft, ProjectUpdate, Outcome, Where), `context.ts` (what the model is told: org, formats, projects, people, glossary; `resolveId` maps names back to ids), `outcome.ts`, `props.ts` |
| Server actions | `src/app/actions/assistant.ts`: `assistantTurn`, `assistantCreateProjects`, `assistantAddFormats`, `assistantUpdateProject`, `assistantComment` (posts through `addComment`, first @mention becomes the assignee of a change request), `assistantSnapshot` (signed preview of a format's newest design) |
| Transcription | `src/app/api/assistant/transcribe/route.ts` (Sarvam or Gemini; 25-second pieces), `src/components/assistant/use-recorder.ts` (browser recording, with Web Speech fallback), `/voice-check` page to compare services |
| UI | `src/components/assistant/assistant.tsx` (state, thread, layer, desktop panel, keyboard fit, hello/snooze/nudges), `dock.tsx` (NavDock mic in the notch, FloatingMic, Wave, HelloCard, Chair, Peek, slots), `cards.tsx` (cards, Say bubble, @mention chips, CardActions), `tour.tsx` (walk-through, sticky testing flag), `testing.tsx` (Settings tab), `assistant-mount.tsx` (next/dynamic, client only) |
| Shell hooks | `src/components/app-shell.tsx` (mounts him for enabled users), `mobile-nav.tsx` (notch, slot `dc-nav-assistant`), `mobile-top-bar.tsx` (slots `dc-top-chair`, `dc-top-peek`), `app-sidebar.tsx` (Vichar row, ⌘J), `src/app/(app)/events/page.tsx` (slot `dc-assistant-hello`), `src/app/(app)/layout.tsx`, `src/app/(wizard)/layout.tsx` |
| Styles | `src/app/globals.css`: `.dc-nav-notch` mask (R=40, 3px corners), `.dc-nav-shadow`, `buddy-*` keyframes, 16px field rule against iOS zoom, `html.dc-vichar-open` desktop padding, reduced-motion rule |
| Artwork | `public/assistant/vichar/`: `neutral.webp` (face), `wave-anim.webp` (460×640, 150 frames, 30 fps, 5 s, loop count 1, 1.95 MB), `wave-anim-lastframe.webp`, `chair.webp`, `clips/writing.mp4`, `clips/thinking.mp4` |
| Settings | `src/app/(app)/settings/page.tsx` (Vichar tab), `src/components/settings/user-editor.tsx` + `src/app/actions/admin.ts` (the per-person switch) |
| Docs | `docs/assistant.md`, `docs/assistant-next.md`, `docs/testing.md` |

Dependencies the branch adds: `@anthropic-ai/sdk`, `zod`. localStorage keys: `dc.vichar.hello`, `dc.vichar.tour`,
`dc.vichar.nudges`, `dc.vichar.sticky`; sessionStorage `dc.vichar.thread`.

## Design decisions worth keeping

- On phones he is a layer over the page, not a takeover: page dimmed 40%, lower third frosted, bubbles and cards
  opaque, one compact top row. Chevron puts him aside (page usable, pill brings him back with the thread intact);
  cross ends it. The desktop is a docked 380px panel.
- Nothing posts without a tap. Each card has one primary button and a quiet escape link. Two drafts in one turn
  still show two buttons: fixing that (one action tray) is item 1 of `docs/assistant-next.md`.
- The walk-through is canned and free. The first sample carries a date so people see one captured.
- The hello card plays the wave once per page load after 1.5 s and holds its last frame; a tap replays it (forced
  plays get a `?p=` nonce because browsers will not replay a finished once-only animation for the same URL).
- Owner's taste, learned the hard way: no cheesy mascot moments, Apple/Airbnb-level polish, big type, one primary
  action, ask before any expensive or speculative work, keep code light.

## Open items when it resumes

In order, as agreed: action tray for several drafts; "open small" (lower third first, grow on the first card);
context chip ("On: Print card · v2") in the top row on project and design pages; "Heard three things" line above
multiple cards; onboarding polish and the type bump inside his layer (17/15 body, 20 card titles, 24 headline);
small fixes (chair peek overlapping New request, dim/frost numbers, Gujarati glossary spellings as keyterms).
Known gaps: wizard pages without a sidebar overlap the desktop panel; thread lives only for the tab; the wave file
is heavy; Gujarati words sometimes come back in English.

## External things

- Figma file `Pe4gxY6Ec9rlMtZ1Oo9gMs` (Harisumiran team) has the early sketches; it predates the layer design.
- Vercel project `design-and-concur`: every push to `assistant` builds a preview.
- Supabase project `gegiwouyrhcexjozkbhh`; Test sandbox org id `1dbd8316-4994-45f6-a1dc-e46881c00e1b`; sample
  project id `1178b979-a58e-4705-bcc2-3ef3d6379bf8`.
- No changelog entry has been written for him; add one in `src/config/changelog.ts` when he ships.
