import type { Outcome } from "@/lib/assistant/schema";

/** The "didn't catch that" card, with its line. Kept apart from the brain so the actions need not load the model's library to say it. */
export const unclear = (say: string): Outcome => ({ kind: "unclear", say, projects: [], addFormats: null, comments: [], question: null, link: null });
