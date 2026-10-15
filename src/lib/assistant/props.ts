import type { SupabaseClient } from "@supabase/supabase-js";
import { remember } from "@/lib/memo";
import { ASSISTANT_NAME, SPEECH_KEYTERMS } from "@/config/assistant";
import { ears } from "@/lib/assistant/access";

/** What the assistant's client needs from the server, for the layouts that mount it. The formats are memoised a minute. */
export async function loadAssistantProps(supabase: SupabaseClient) {
  const { data } = await remember("assistant:formats", 60_000, async () => supabase.from("formats").select("key,name").eq("active", true).order("sort"));
  const formats = (data ?? []) as { key: string; name: string }[];
  return { name: ASSISTANT_NAME, ears: ears(), formats, keyterms: [...SPEECH_KEYTERMS, ...formats.map((f) => f.name)] };
}
