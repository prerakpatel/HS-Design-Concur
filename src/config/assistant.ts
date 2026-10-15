/**
 * The in-app assistant: say or type what you want ("new project for Annakut with a print card, WhatsApp and
 * Instagram"; "tell Chirantan the text is cut off at the sides") and it drafts the project, formats or comments for
 * you to confirm. Nothing is created until you tap. See docs/assistant.md.
 */

/** Only this person can switch the assistant on for others (Settings → People). They always have it themselves. */
export const ASSISTANT_OWNER = "pushkar.patel@hariss.org";

/** What the character is called in the app. */
export const ASSISTANT_NAME = "Tej";

/**
 * Tej's artwork (public/assistant/tej): a head crop per mood for the bubble, and the full figure for the sheet.
 * A list means the poses alternate while that mood lasts.
 */
export const ASSISTANT_ART = {
  calm: "/assistant/tej/calm-head.webp",
  listening: "/assistant/tej/listening-head.webp",
  thinking: ["/assistant/tej/think-1-head.webp", "/assistant/tej/writing-head.webp", "/assistant/tej/think-2-head.webp"],
  "needs-you": "/assistant/tej/think-2-head.webp",
  done: "/assistant/tej/calm-head.webp",
} as const;
export const ASSISTANT_FIGURE = "/assistant/tej/calm.webp";

/** The model that turns words into drafts, and how hard it thinks (low | medium | high). */
export const ASSISTANT_MODEL = "claude-opus-5-5";
export const ASSISTANT_EFFORT = "medium" as const;

/** A recording longer than this is cut off (the transcription service wants short clips; Vercel allows 60 s per request). */
export const MAX_CLIP_SECONDS = 90;

/**
 * Words the transcription service is told to expect, so Gujarati and temple terms come back spelled the app's way.
 * Glossary terms and the people on the project are added at run time (50 words in total are allowed).
 */
export const SPEECH_KEYTERMS = ["Harisumiran", "Atmiya", "Annakut", "Sharad Purnima", "Mahaprasad", "Murti", "Swamishree", "Guruhari", "Sambandh", "Satsang", "Darshan", "Diwali", "Mandir", "Sabha"];
