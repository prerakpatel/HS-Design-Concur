/**
 * Release notes shown in the "What's new" dialog and posted to the org chats. Newest first. Add a release once
 * roughly four features have shipped: give it a date id, a short title and plain-language bullets that say what
 * a person can now do, not how it was built. Keep bullets to one sentence.
 */
export interface Release { id: string; title: string; items: string[] }

export const RELEASES: Release[] = [
  {
    id: "2026-10-12",
    title: "Projects, asset requests and comments you can find on the design",
    items: [
      "Events are now Projects. New request → For event, or Assets only for thumbnails, covers and other designs not tied to an event (Harisumiran for now).",
      "An assets-only request lists exactly what is needed (twelve calendar covers, four YouTube thumbnails), ends within 30 days and clears its files the day after; you hear 3 days before.",
      "Comment markers are smaller and numbered to match their comment: tap either one to find the other, even on an older version.",
      "When the primary design is approved, the chat and every designer on the event hear it's time to start the other formats; the primary also has a badge on its page.",
      "Every format has an In place view (phone, Instagram, Sambandh, TV, LED wall, browser, print, YouTube) on the event and on its own page, and designs are never stretched.",
      "The projects list shows uploads as well as approvals, and each organization has its own project slots in Settings.",
    ],
  },
  {
    id: "2026-10-11",
    title: "Glossary, design previews in place and drag-and-drop uploads",
    items: [
      "Glossary: one shared list of approved spellings (Gujarati and Sanskrit words, names, places) with sound-alike search, kept by the Publications team.",
      "Event pages show each design whole at its own shape; tap the arrow to see it on a phone, an Instagram story, the Sambandh app, a TV or the LED wall.",
      "Drag a file anywhere onto a format page to upload it; a thin bar shows progress, lets you cancel and says Done.",
      "Past events stay in Events → Past with one small reference image of the main design.",
      "Each organization now has its own 10 event slots.",
      "Version history tucks older versions behind the newest two, and phones get a History button.",
    ],
  },
  {
    id: "2026-10-06",
    title: "Review mode, per-org approvers and a maintenance hold",
    items: [
      "Review mode: tap Comment, leave as many comments as you need (pinned or general, to different people), then press Send. They go to Google Chat and Slack as one message instead of one each.",
      "Comments you have not sent yet are private to you, marked “Not sent”, and wait for you if you leave the page.",
      "Approving is now per organization: someone can approve for Harisumiran and not Atmiya Care, and only that org's approvers are notified.",
      "Core Admins are no longer approvers automatically; turn Approver on per organization in Settings → Users.",
      "Core Admins can put a “please hold” screen over the app during updates (Settings → Maintenance). Nobody loses what they were typing.",
    ],
  },
  {
    id: "2026-10-03",
    title: "Groups, smarter Slack and clearer messages",
    items: [
      "Groups: Core Admins can create teams with their own Google Chat space or Slack channel and choose what each hears about: everything, its own designs, or milestones only.",
      "Mention a group in a comment (@Core members) to notify everyone in it and send the comment to their chat.",
      "Slack member IDs are found automatically from your email once the workspace is connected; no more pasting.",
      "Error messages now say what went wrong in plain words, and toasts sit bottom-left, clear of the buttons.",
      "Comment editor: a dash and a space starts a bullet, Shift+Enter inside a bullet makes the next one, and the colour palette matches the brand file.",
    ],
  },
  {
    id: "2026-09-26",
    title: "Richer comments, one-tap downloads and lighter storage",
    items: [
      "Comments can be bold, italic, underlined or coloured, with bullets, links and @-mention chips. Select text to see the tools; on phones they sit above the keyboard.",
      "Download every approved design of an event as one ZIP from the Formats header.",
      "Change the designer on a format straight from its page.",
      "Only the two newest versions of a format keep their files; older versions keep their comments so the thread still reads.",
      "Changing a print item's size moves its designs and comments to the new size instead of hiding them.",
    ],
  },
  {
    id: "2026-09-25",
    title: "Send for review, chat pings and a tidier setup",
    items: [
      "Uploading is private now: check the file, replace it or add the back, then press Send for review when it's ready.",
      "Google Chat and Slack posts @mention the people they're for, with a preview of the design attached.",
      "Approvers get a daily nudge about any design still waiting for a decision.",
      "Creating an event is one screen: title, date, timings, venue (prefilled with the temple) and the invite text.",
      "The Formats step starts with everything off; choose what you need, flip on Primary, and pick a print size from one dropdown.",
      "Resolved comments stay in the thread: tap Show resolved to read the whole discussion, across versions.",
      "Delete an event from its page (creator or Core Admin); it can be restored for 7 days.",
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];
