"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { UserError } from "@/lib/user-error";
import { termKey, soundKey } from "@/lib/glossary/sound";
import { parseGlossaryMarkdown, type ParsedRow } from "@/lib/glossary/parse";

async function requireSteward() {
  const ctx = await requireActiveUser();
  if (!ctx.user.is_glossary_steward) throw new UserError("Only glossary stewards can change the glossary");
  return ctx;
}

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const variantRows = (entryId: string, spellings: string[], ownKey: string) => {
  const seen = new Set<string>([ownKey]);
  return spellings.map(tidy).filter(Boolean).flatMap((spelling) => {
    const spelling_key = termKey(spelling);
    if (!spelling_key || seen.has(spelling_key)) return [];
    seen.add(spelling_key);
    return [{ entry_id: entryId, spelling, spelling_key, sound_key: soundKey(spelling) }];
  });
};

/** Add (id null) or edit a word. A variant may not be the approved spelling of a different word. */
export async function saveEntry(input: { id: string | null; term: string; definition: string; variants: string[] }) {
  const { supabase, user } = await requireSteward();
  const term = tidy(input.term);
  const key = termKey(term);
  if (!term || !key) throw new UserError("Type the word first");
  if (term.length > 120) throw new UserError("That word is too long");
  const definition = input.definition.trim().slice(0, 2000) || null;

  const { data: clash } = await supabase.from("glossary_entries").select("id,term").eq("term_key", key).maybeSingle();
  if (clash && clash.id !== input.id) throw new UserError(`“${clash.term}” is already in the glossary`);
  const variantKeys = input.variants.map(termKey).filter(Boolean);
  if (variantKeys.length) {
    const { data: owned } = await supabase.from("glossary_entries").select("id,term,term_key").in("term_key", variantKeys);
    const other = (owned ?? []).find((e) => e.id !== input.id);
    if (other) throw new UserError(`“${other.term}” is already its own word, so it cannot be a spelling of “${term}”`);
  }

  let id = input.id;
  if (id) {
    const { error } = await supabase.from("glossary_entries").update({ term, term_key: key, sound_key: soundKey(term), definition, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new UserError(error.message);
    await supabase.from("glossary_variants").delete().eq("entry_id", id);
  } else {
    const { data, error } = await supabase.from("glossary_entries").insert({ term, term_key: key, sound_key: soundKey(term), definition, created_by: user.id, updated_by: user.id }).select("id").single();
    if (error || !data) throw new UserError(error?.message ?? "Could not save the word");
    id = data.id as string;
  }
  const vrows = variantRows(id, input.variants, key);
  if (vrows.length) { const { error } = await supabase.from("glossary_variants").insert(vrows); if (error) throw new UserError(error.message); }
  revalidatePath("/glossary");
  return { ok: true };
}

export async function deleteEntry(id: string) {
  const { supabase } = await requireSteward();
  const { error } = await supabase.from("glossary_entries").delete().eq("id", id);
  if (error) throw new UserError(error.message);
  revalidatePath("/glossary");
}

export interface ImportRow { term: string; definition: string | null; variants: string[]; status: "new" | "same" | "different" | "repeat"; existing?: string | null }
export interface ImportPreview { rows: ImportRow[]; skipped: { line: number; text: string }[] }

async function classify(supabase: Awaited<ReturnType<typeof requireSteward>>["supabase"], parsed: ParsedRow[]): Promise<ImportRow[]> {
  const { data: existing } = await supabase.from("glossary_entries").select("term_key,definition");
  const have = new Map((existing ?? []).map((e) => [e.term_key as string, (e.definition as string | null) ?? null]));
  const seen = new Set<string>();
  return parsed.map((r) => {
    const key = termKey(r.term);
    if (seen.has(key)) return { term: r.term, definition: r.definition, variants: r.variants, status: "repeat" as const };
    seen.add(key);
    if (!have.has(key)) return { term: r.term, definition: r.definition, variants: r.variants, status: "new" as const };
    const cur = have.get(key) ?? null;
    return { term: r.term, definition: r.definition, variants: r.variants, status: tidy(cur ?? "") === tidy(r.definition ?? "") ? "same" as const : "different" as const, existing: cur };
  });
}

/** Read a Markdown file and report what an import would do, without saving anything. */
export async function previewImport(markdown: string): Promise<ImportPreview> {
  const { supabase } = await requireSteward();
  if (markdown.length > 1_000_000) throw new UserError("That file is too large for a glossary");
  const { rows, skipped } = parseGlossaryMarkdown(markdown);
  if (rows.length === 0) throw new UserError("No words found. Use one line per word, like: - **aarti** – A ritual of light");
  return { rows: await classify(supabase, rows), skipped: skipped.slice(0, 50) };
}

/** Save an import. New words are added; words whose meaning differs are only updated when `updateDifferent` is on. */
export async function commitImport(markdown: string, source: string, updateDifferent: boolean) {
  const { supabase, user } = await requireSteward();
  const { rows } = parseGlossaryMarkdown(markdown);
  const classified = await classify(supabase, rows);
  const fresh = classified.filter((r) => r.status === "new");
  let added = 0; let updated = 0;
  for (let i = 0; i < fresh.length; i += 100) {
    const chunk = fresh.slice(i, i + 100);
    const { data, error } = await supabase.from("glossary_entries").insert(chunk.map((r) => ({ term: tidy(r.term), term_key: termKey(r.term), sound_key: soundKey(r.term), definition: r.definition, source: source.slice(0, 120) || null, created_by: user.id, updated_by: user.id }))).select("id,term_key");
    if (error) throw new UserError(error.message);
    const ids = new Map((data ?? []).map((d) => [d.term_key as string, d.id as string]));
    const vrows = chunk.flatMap((r) => { const id = ids.get(termKey(r.term)); return id ? variantRows(id, r.variants, termKey(r.term)) : []; });
    if (vrows.length) await supabase.from("glossary_variants").insert(vrows);
    added += data?.length ?? 0;
  }
  if (updateDifferent) {
    for (const r of classified.filter((x) => x.status === "different")) {
      const { error } = await supabase.from("glossary_entries").update({ definition: r.definition, updated_by: user.id, updated_at: new Date().toISOString() }).eq("term_key", termKey(r.term));
      if (!error) updated++;
    }
  }
  revalidatePath("/glossary");
  return { added, updated };
}
