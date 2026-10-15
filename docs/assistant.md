# The assistant

Say or type what you need; the assistant drafts it as a card; you tap. Nothing is created from words alone.

## What it does today (first draft)

- **New projects**: "new project for Sharad Purnima and Annakut with a print card 8.5 by 5.5, WhatsApp, Instagram,
  LED and website hero… and one for Kids Annakut with the same" → one card per project, as drafts, exactly as the
  wizard makes them. Tapping Create opens the first project's review step to finish (date, invite text, publish).
- **Formats on an existing project**: "add a Telegram flyer to Sharad Purnima".
- **Comments and change requests**: "tell Chirantan the text is cut off at the sides and to check the spelling of
  mahaprasad" → one change request per point on the newest design, @mentioning the person. On a design page "this
  card" means the one on screen.
- **Follow-ups edit the draft**: "make it 5 by 7", "drop LED from the kids one".
- **Questions about the projects**: "what is pending on Annakut?"

It answers with one of five cards, each with buttons: a draft, one question (with answers to tap), "didn't catch
that" (Try again · Type it), "can't do that here" (a link to the right page), or a plain answer. Your own words show
as a bubble you can tap to fix what it heard. "Use the form" is always there as the way out.

## Who has it

Its owner (`ASSISTANT_OWNER` in `src/config/assistant.ts`) always, and whoever the owner switches it on for in
Settings → People → *Assistant*. Other Core Admins see no switch. The column `users.assistant_enabled` is pinned in
the self-update policy so nobody can switch it on for themselves (migration `20261014000000_assistant.sql`).

## How it works

1. **Ears.** Hold the character (or the mic in the sheet) and speak; release to send. With `SARVAM_API_KEY` set the
   clip goes to Sarvam (Saaras v4, language auto-detected, Gujarati and English mixed in one sentence, with the
   temple words from `SPEECH_KEYTERMS` and the format names as expected vocabulary). With only `GEMINI_API_KEY`
   set, Gemini transcribes instead. With neither, the browser's own speech recognition listens (Chrome, Safari;
   English-strong). Recordings are never stored. `/voice-check` runs every configured service on one clip, side by
   side, for choosing.
2. **Brain.** The words, the thread so far and a compact context go to Claude (`ASSISTANT_MODEL`), which must
   answer in the card schema (`src/lib/assistant/schema.ts`). The context is read with the person's own client so
   row-level security decides what is in it: the format catalogue, this organization's projects of the last 14
   months with their formats, sizes and designs, the people it may mention, and the glossary. Ids are shortened to
   8 characters in the prompt and resolved back on the server; anything made up is dropped.
3. **Hands.** The buttons call the same code the forms do: `insertDraftProject` and `requestFormats`
   (`src/lib/create-project.ts`, shared with the wizard) and `addComment` (`src/app/actions/reviews.ts`).

Keys live in Vercel's environment variables, never in the repo: `ANTHROPIC_API_KEY` (required), `SARVAM_API_KEY`
and `GEMINI_API_KEY` (one or both, optional). Without `ANTHROPIC_API_KEY` the sheet opens but every message gets
"not switched on yet".

## The character

`src/components/assistant/buddy.tsx`. It peeks in from the right edge on every page (drag it up or down; the spot
is remembered per device). Tap opens the thread; hold and it listens straight away. It only animates for a real
state: breathing when calm, swelling with your voice while listening, looking up and circling while thinking, an
amber ring when a card needs you, a tick when done. His artwork lives in `public/assistant/vichar/` (`ASSISTANT_ART`, `ASSISTANT_PEEK` in the config): on the screen's
edge he is a drawn figure leaning out (resting, leaning in to listen, beckoning when a card needs you, waving on
arrival and when done); in the sheet, a head crop per mood, with a puzzled one when he did not catch something.

## Costs

Transcription is a fraction of a cent per clip. Each brain turn is a few thousand input tokens (the context is
cached between turns) and a few hundred output; on Opus 5.5 about 2–3 cents. Hundreds of turns a month is a few
dollars.

## Not yet

Assign, send for review, approve, reopen, add a person, navigate by voice; spoken replies; guests; artwork.
