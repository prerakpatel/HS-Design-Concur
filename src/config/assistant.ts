/**
 * The in-app assistant: say or type what you want ("new project for Annakut with a print card, WhatsApp and
 * Instagram"; "tell Chirantan the text is cut off at the sides") and it drafts the project, formats or comments for
 * you to confirm. Nothing is created until you tap. See docs/assistant.md.
 */

/** Only this person can switch the assistant on for others (Settings → People). They always have it themselves. */
export const ASSISTANT_OWNER = "pushkar.patel@hariss.org";

/** What the character is called in the app. */
export const ASSISTANT_NAME = "Vichar";

/**
 * Vichar's artwork (public/assistant/vichar): a head crop per mood for the bubble in the sheet, the full figure
 * for the sheet's welcome, and the orb's pieces below. A list means the poses alternate while
 * that mood lasts.
 */
export const ASSISTANT_ART = {
  calm: "/assistant/vichar/calm-head.webp",
  listening: "/assistant/vichar/listening-head.webp",
  thinking: ["/assistant/vichar/think-1-head.webp", "/assistant/vichar/writing-head.webp", "/assistant/vichar/think-2-head.webp"],
  "needs-you": "/assistant/vichar/think-2-head.webp",
  puzzled: "/assistant/vichar/puzzled-head.webp",
  done: "/assistant/vichar/calm-head.webp",
} as const;
export const ASSISTANT_FIGURE = "/assistant/vichar/calm.webp";
/**
 * The orb (his button and the disc that grows out of it): a still per state, and a short looping clip for the states after a tap when
 * one exists in public/assistant/vichar/clips (720 × 720, a few seconds, white background, mp4). Clips are off until
 * they are there, so nothing is fetched for nothing.
 */
export const ASSISTANT_CLIPS_READY = false;
export const ASSISTANT_ORB = {
  // Idle is always a still: he only moves once you tap him.
  idle: { image: "/assistant/vichar/calm-head.webp", video: null },
  listening: { image: "/assistant/vichar/listening-head.webp", video: "/assistant/vichar/clips/listening.mp4" },
  thinking: { image: "/assistant/vichar/writing-head.webp", video: "/assistant/vichar/clips/thinking.mp4" },
  done: { image: "/assistant/vichar/calm-head.webp", video: "/assistant/vichar/clips/done.mp4" },
} as const;

/** The model that turns words into drafts, and how hard it thinks (low | medium | high). */
export const ASSISTANT_MODEL = "claude-opus-5-5";
export const ASSISTANT_EFFORT = "medium" as const;

/** A recording longer than this is cut off. It is sent in 25-second pieces, so the service's 30-second limit does not apply. */
export const MAX_CLIP_SECONDS = 120;

/**
 * Words the transcription service is told to expect, so Gujarati and temple terms come back spelled the app's way.
 * Glossary terms and the people on the project are added at run time (50 words in total are allowed).
 */
export const SPEECH_KEYTERMS = ["Harisumiran", "Atmiya", "Annakut", "Sharad Purnima", "Mahaprasad", "Murti", "Swamishree", "Guruhari", "Sambandh", "Satsang", "Darshan", "Diwali", "Mandir", "Sabha"];
