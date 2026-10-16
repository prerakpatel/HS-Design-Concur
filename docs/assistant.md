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
- **Finishing a project by voice**: after creating one (or on its setup pages) he says what it still needs before it
  can be published and you just say it: "the invite text is…", "it's at 6:30 pm", "give the print card to
  Chirantan", "publish it". Details, designers and publishing follow the wizard's own rules (the brief locks after the
  first upload; assigning is for Core Admins and approvers; publishing needs the date and the invite text).
- **Follow-ups edit the draft**: "make it 5 by 7", "drop LED from the kids one".
- **Questions about the projects**: "what is pending on Annakut?"

It answers with one of five cards, each with buttons: a draft, one question (with answers to tap), "didn't catch
that" (Try again · Type it), "can't do that here" (a link to the right page), or a plain answer. Your own words show
as a bubble you can tap to fix what it heard. The thread survives a page change (for twenty minutes, in this tab). "Use the form" is always there as the way out.

## Who has it

Its owner (`ASSISTANT_OWNER` in `src/config/assistant.ts`) always, and whoever the owner switches it on for in
Settings → People → *Assistant*. Other Core Admins see no switch. The column `users.assistant_enabled` is pinned in
the self-update policy so nobody can switch it on for themselves (migration `20261014000000_assistant.sql`).

## How it works

1. **Ears.** Tap him and speak (or hold the mic in his screen; release to send). With `SARVAM_API_KEY` set the
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

`src/components/assistant/dock.tsx` and `assistant.tsx`. On phones a raised mic sits in the middle of the bottom bar
in a notch cut out of its top edge (a CSS mask on the bar's surface, the rim drawn as an arc), labelled "Vichar" like
the tabs; Inbox takes Archive's place in that bar and archived projects stay under Projects → Past. He peeks over the
bar on the right, eyes and hands on its edge; tap him and the mic dribbles like a dropped ball, so the curious find
the way in. **Tap** and his screen takes over the phone and he listens straight
away: his face at the top with a pill under it that says what he is doing (Listening… / Working out the words… /
Thinking… / Doing it…), the thread below, and one pill at the bottom to type in or hold the mic. While he listens
the pill shows the sound; the arrow sends, the stop drops it. **Hold** the mic to open the screen without listening.
On pages without the bar (a design, project setup) a small disc floats at the bottom, on desktop in the corner,
where his screen is a tall sheet in the middle; left alone it settles into the edge. An amber dot means a card is
waiting.

The thread is kept plain: your words in one soft bubble (tap it to fix what he heard), his line, one bordered card,
and under it one full-width button that does it, with the form as a quiet link. Start over sits top left and asks
first, since it drops the draft; closing his screen after something was done clears it too. Colour is kept for the
two marks that matter: a warning mark on anything that still needs you, a tick on what got done.

His artwork lives in `public/assistant/vichar/` (`ASSISTANT_ART` in the config): one still, cropped to his head
wherever he appears, and short looping clips zoomed to his bust that play in his avatar (`clips/writing.mp4` while he
listens, `clips/thinking.mp4` while he works). Idle never moves. `peek` is the picture of him peeking over the bar.

Text is the rounded cut of Google Sans Flex (headings keep the straight one); Gujarati letters fall through to
Noto Serif Gujarati. Both are loaded in the root layout for the whole app.

## Costs

Transcription is a fraction of a cent per clip. Each brain turn is a few thousand input tokens (the context is
cached between turns) and a few hundred output; on Opus 5.5 about 2–3 cents. Hundreds of turns a month is a few
dollars.

## Not yet

Assign, send for review, approve, reopen, add a person, navigate by voice; spoken replies; guests; artwork.
