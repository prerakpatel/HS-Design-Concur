import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { assistantAllowed, ears } from "@/lib/assistant/access";
import { SPEECH_KEYTERMS } from "@/config/assistant";

export const maxDuration = 60;

/**
 * Speech → text for the assistant. The browser posts a short recording; it goes to Sarvam (Indian languages,
 * Gujarati and English mixed in one sentence) when its key is set, else to Gemini, and the words come back.
 * `?all=1` runs every configured service and returns each transcript, for comparing them on /voice-check.
 * The recording is not stored anywhere.
 */
export async function POST(req: Request) {
  const ctx = await getActiveUser();
  if (!ctx || !assistantAllowed(ctx.user)) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const which = ears();
  if (!which) return NextResponse.json({ error: "No transcription service is set up (SARVAM_API_KEY or GEMINI_API_KEY)" }, { status: 501 });
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size < 1000) return NextResponse.json({ error: "Nothing came through" }, { status: 400 });
  const all = new URL(req.url).searchParams.get("all") === "1";
  const keyterms = [...new Set([...SPEECH_KEYTERMS, ...String(form.get("keyterms") ?? "").split("|").map((s) => s.trim()).filter(Boolean)])].slice(0, 50);

  const providers: ("sarvam" | "gemini")[] = all ? (["sarvam", "gemini"] as const).filter((p) => (p === "sarvam" ? !!process.env.SARVAM_API_KEY : !!process.env.GEMINI_API_KEY)) : [which];
  const results = await Promise.all(providers.map(async (p) => {
    const started = Date.now();
    try {
      const r = p === "sarvam" ? await sarvam(audio, keyterms) : await gemini(audio, keyterms);
      return { provider: p, ...r, ms: Date.now() - started, error: null as string | null };
    } catch (e) { return { provider: p, transcript: "", language: null as string | null, ms: Date.now() - started, error: e instanceof Error ? e.message : String(e) }; }
  }));
  const first = results[0];
  if (!all && first.error) return NextResponse.json({ error: first.error }, { status: 502 });
  return NextResponse.json(all ? { results } : { transcript: first.transcript, language: first.language, provider: first.provider });
}

async function sarvam(audio: Blob, keyterms: string[]) {
  const body = new FormData();
  body.set("file", audio, "clip." + (audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : audio.type.includes("wav") ? "wav" : "webm"));
  body.set("model", "saaras:v4");
  body.set("language_code", "unknown");
  body.set("keyterms", JSON.stringify(keyterms));
  const res = await fetch("https://api.sarvam.ai/speech-to-text", { method: "POST", headers: { "api-subscription-key": process.env.SARVAM_API_KEY! }, body, cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { transcript?: string; language_code?: string | null; error?: { message?: string } };
  if (!res.ok) throw new Error(`Sarvam ${res.status}: ${data.error?.message ?? "transcription failed"}`);
  return { transcript: (data.transcript ?? "").trim(), language: data.language_code ?? null };
}

async function gemini(audio: Blob, keyterms: string[]) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
  const mime = audio.type.includes("mp4") ? "audio/mp4" : audio.type.includes("ogg") ? "audio/ogg" : audio.type.includes("wav") ? "audio/wav" : "audio/webm";
  const prompt = `Transcribe this recording exactly as spoken. It may mix Gujarati and English in one sentence; write Gujarati words in Latin letters as commonly written by Gujarati speakers. Expect these words: ${keyterms.join(", ")}. Reply with the transcript only.`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY!, "Content-Type": "application/json" }, cache: "no-store",
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data } }] }] }),
  });
  const json = (await res.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? "transcription failed"}`);
  return { transcript: (json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim(), language: null };
}
