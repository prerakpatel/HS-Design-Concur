import { requireActiveUser } from "@/lib/auth";
import { GlossaryView } from "@/components/glossary/glossary-view";
import type { GlossaryEntry } from "@/lib/glossary/search";

export const metadata = { title: "Glossary" };

export default async function GlossaryPage() {
  const { supabase, user } = await requireActiveUser();
  const [{ data: entries }, { data: variants }] = await Promise.all([
    supabase.from("glossary_entries").select("id,term,definition").order("term").limit(5000),
    supabase.from("glossary_variants").select("entry_id,spelling").limit(20000),
  ]);
  const byEntry = new Map<string, string[]>();
  for (const v of variants ?? []) byEntry.set(v.entry_id as string, [...(byEntry.get(v.entry_id as string) ?? []), v.spelling as string]);
  const list: GlossaryEntry[] = (entries ?? []).map((e) => ({ id: e.id as string, term: e.term as string, definition: (e.definition as string | null) ?? null, variants: byEntry.get(e.id as string) ?? [] }));
  return <GlossaryView entries={list} canEdit={user.is_glossary_steward} />;
}
