import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth";
import { assistantAllowed, ears } from "@/lib/assistant/access";
import { PageHeader } from "@/components/page-header";
import { VoiceCheck } from "@/components/assistant/voice-check";

/** Speak once, read what each transcription service heard, side by side. For picking the assistant's ears. */
export default async function VoiceCheckPage() {
  const { user } = await requireActiveUser();
  if (!assistantAllowed(user)) notFound();
  const services = [process.env.SARVAM_API_KEY ? "Sarvam" : null, process.env.GEMINI_API_KEY ? "Gemini" : null].filter(Boolean) as string[];
  return (
    <>
      <PageHeader title="Voice check" subtitle={services.length ? `Set up: ${services.join(" and ")}. Speak a real request in Gujarati, English or both, then compare.` : "No transcription service is set up yet (SARVAM_API_KEY or GEMINI_API_KEY in Vercel). The assistant uses the browser's own listening until then."} />
      <VoiceCheck enabled={!!ears()} />
    </>
  );
}
