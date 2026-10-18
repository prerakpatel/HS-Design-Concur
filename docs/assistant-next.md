# Vichar: next round, and what iOS 27's Siri teaches us

Written 18 Oct 2026, after the layer, the chair, the sample project and the comment cards shipped on `assistant`.
Research below is from press and reviews of the shipped iOS 27 (September 2026); Apple's own pages say little about
the interface, so the visual details come from hands-ons and are marked as such.

## What iOS 27's Siri actually does now

**Entry.** Siri lives in the Dynamic Island: a glassy bubble with bright colours pops there when it is called (voice,
side button, or a swipe down from the top centre, which also replaced Spotlight with a "Search or Ask" bar). The
answer appears in that same spot as a translucent card. Swipe the card and it becomes a conversation that looks like
iMessage, with a text bar for follow-ups and a "+" for photos and documents. (MacRumors hands-on, MacStories review.)

**Small first, big on demand.** The response card is the default; the chat is what you get when you ask for more.
The app stays visible behind the card. This is the single most useful pattern for us.

**On-screen awareness.** "If it is on the screen, it is already part of the conversation": Siri answers about and acts
on what is showing (a web page's dates become calendar events). Every context menu has "Ask Siri" that passes the
selected thing along. (Apple newsroom, MacStories.)

**Actions in apps.** Apps expose actions through App Intents; Siri chains them across apps (dictation into a note, a
mail confirmation into a calendar event). Apple's design guidance for intents is resolve → confirm → handle: when an
action has to happen before a result can show, Siri shows a *confirmation snippet* with one verb button ("Order"),
and the *result snippet* after. Actions with side effects (deleting, sending) get a confirmation from the system.
(WWDC25 design session, developer forums.)

**Write with Siri.** Replaced Writing Tools: describe the change you want; before/after shown as swipeable cards at
the bottom of the screen. (MacStories.)

**Memory.** A Siri app keeps every conversation (grid of cards, pin/rename/delete, retention 30 days / 1 year /
forever, iCloud sync). Reviewers find the app basic and the grid hard to search. (MacStories, Tom's Guide.)

**Where it falls down, per reviewers.** Multi-step requests are unreliable: a third request in one sentence was
silently dropped. Third-party routing misfires. The model stops after minimal tool use unless prompted in detail.
(MacStories.) These are exactly the failures a visible draft protects against.

**Look.** Dark-only palette matching the WWDC art (white on black with pink, blue, purple, orange). Big type in cards.

## What we take, and what we don't

| Siri pattern | Vichar today | Change |
|---|---|---|
| Card first, chat on swipe | Full layer with thread opens at once | **Open small**: lower third only (face, status, pill, two suggestion chips) over a light dim; grow to the full layer when the first card arrives or the person scrolls up. |
| Confirmation snippet: one verb button, then a result snippet | Card + one button, then DoneCard | Keep. For several drafts in one turn, one tray with tick rows and one button ("Do both"); never two stacked primaries. |
| "On screen = in the conversation" | `Where` context, snapshot in comment cards | A **context chip** in the top row on project and design pages ("On: Print card · v2 · in review") so the person sees what he is looking at. Tap it to change. |
| Silently dropped requests | Cards enumerate what was heard | When a turn drafts more than one thing, a one-line **"Heard three things"** summary above the cards, so a miss is visible. |
| Write with Siri before/after cards | Tap a bubble to fix the words | Keep. |
| Siri app keeps every conversation | Thread lives for the tab (sessionStorage) | Later: keep the last thread per device for a day, with "Start over". Not now. |
| Dark-only | Light app, dimmed page under the layer | Keep light. The dim is our dark moment. |
| Big type in cards | 15/13px | Bump inside his layer: 17 body, 15 secondary, 20 card titles, 24 onboarding headline. Rest of the app unchanged. |

Not taken: a conversation grid, attachments, system-wide "Ask Vichar" on selections. Not our job yet.

## The plan, in order

**1. Action tray for several drafts (half a day).** One turn that drafts a project and comments shows the cards, then
one tray at the bottom: rows with ticks ("Create draft project · Sharad Purnima", "Send 2 requests · Chirantan"),
each row tappable to leave it out, one button "Do both" (or "Do these 3"). Escape links ("Use the form instead") move
into each card's corner as quiet text. One draft keeps today's single button. Done when: two drafts in one turn show
one primary button; unticking a row changes the button's count; each action runs in order and reports in one DoneCard.

**2. Open small (a day).** Tapping the mic opens the lower-third state: his face and status in the frost, the pill,
two suggestion chips from the page's nudges, the page lightly dimmed and still readable. First card arriving, a drag
up on the frost, or a tap on the chevron-up grows it to the full layer (today's). The walk-through opens full. Done
when: a first tap shows no empty thread; the page behind reads at a glance; growing and shrinking is one spring.

**3. Context chip (half a day).** On project, design and wizard pages the top row carries "On: …" built from `Where`.
Comment cards still show the snapshot. Done when: the chip matches the page and the brain's context.

**4. "Heard N things" line (an hour).** Above the cards when an outcome holds more than one draft.

**5. Onboarding polish and type (a day).** Step marker ("1 of 2"), 24px headline, sample sentence as the hero quote
with brand-soft quote marks at 18px, "Say it" primary, "Type it instead" as the one quiet link, "Skip" top right by
Close, steps slide left between each other. Type bump inside the layer as above. Done when: it stands next to an
Apple or Airbnb step without embarrassment, and nothing in the rest of the app moved.

**6. Small fixes (an hour).** Chair peek overlapping New request (clip to the header band or shrink to 64px and lower
less), dim/frost numbers after the owner's second look, keyterms with the glossary's Gujarati spellings.

**Later, not planned.** Thread persistence per device; a changelog entry when he ships; the Anthropic key expiry on 13
November 2026; the sample project's borrowed images (upload one real image to make it permanent).

## Sources

- Apple newsroom, "Siri AI, a profoundly more capable and personal assistant, is here" (Sept 2026).
- MacRumors, "Hands-On With iOS 27's Siri AI" (June 2026 beta) and "iOS 27 Getting Major Siri Redesign With Chat Interface and Dedicated App" (May 2026).
- MacStories, "iOS and iPadOS 27: The MacStories Review", part 7 (Siri).
- Tom's Guide, "The new Siri app in iOS 27 is keeping receipts on everything you ask".
- Apple WWDC25 design session on App Intents snippets; Apple Developer Forums on confirmation for side-effect intents.
