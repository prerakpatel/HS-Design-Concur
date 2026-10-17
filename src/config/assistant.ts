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
  /**
   * Him leaning in from the right edge of the screen, waving (transparent), over his hello card: the still, and the
   * animated WebP that plays once per page load (after `delayMs`, for `durationMs`: 76 frames at 15 fps, 5.1 s) and dissolves into
   * the still, which is its last frame exported sharp (460×640; the animation is the same frame at 360×501). `durationMs` 0 would
   * show the still alone.
   */
  wave: { still: "/assistant/vichar/wave-anim-lastframe.webp", anim: "/assistant/vichar/wave-anim.webp", delayMs: 1500, durationMs: 5092 },
  clips: { thinking: "/assistant/vichar/clips/thinking.mp4", writing: "/assistant/vichar/clips/writing.mp4" },
};

/** Bump when he learns something worth a hello: the card at the top of Projects comes back once for everyone. */
export const ASSISTANT_HELLO_VERSION = "2026-10-16";

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
