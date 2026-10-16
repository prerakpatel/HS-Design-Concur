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
 * Vichar's artwork (public/assistant/vichar). `still` is him at rest: the avatar at the top of his screen, cropped to
 * his head. The clips play in that avatar: writing while he listens, thinking while he works. Idle never moves.
 */
export const ASSISTANT_ART = {
  still: "/assistant/vichar/neutral.webp",
  /** Him peeking over the bottom bar on the right: eyes and hands over its edge, transparent background (about 3:2). */
  peek: "/assistant/vichar/peek.webp" as string | null,
  clips: { thinking: "/assistant/vichar/clips/thinking.mp4", writing: "/assistant/vichar/clips/writing.mp4" },
};

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
