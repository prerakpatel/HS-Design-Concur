import { ASSISTANT_OWNER } from "@/config/assistant";

/** Who may use the assistant: its owner always, and whoever the owner switched it on for. */
export const assistantAllowed = (user: { email: string; assistant_enabled?: boolean | null }) => isAssistantOwner(user) || !!user.assistant_enabled;

export const isAssistantOwner = (user: { email: string }) => user.email.toLowerCase() === ASSISTANT_OWNER.toLowerCase();

/** Which transcription service is set up, if any; without one the browser's own speech recognition is used. */
export const ears = (): "sarvam" | "gemini" | null => (process.env.SARVAM_API_KEY ? "sarvam" : process.env.GEMINI_API_KEY ? "gemini" : null);
