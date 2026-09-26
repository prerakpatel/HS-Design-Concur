import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/storage";
import { VERSIONS_KEPT } from "@/config/limits";

interface Row { id: string; number: number; decision: string; purged_at: string | null; version_sides: { id: string; optimised_path: string | null; preview_path: string | null; thumb_path: string | null }[] }

/**
 * Keep the files of the newest VERSIONS_KEPT versions of a slot (and of any approved version); older versions
 * lose their files but keep their row, decision and comments, so the conversation stays readable (PRD §8).
 * Returns how many versions were pruned. Safe to run repeatedly.
 */
export async function pruneOldVersions(supabase: SupabaseClient, slotId: string): Promise<number> {
  const { data } = await supabase.from("versions").select("id,number,decision,purged_at,version_sides(id,optimised_path,preview_path,thumb_path)").eq("slot_id", slotId).order("number", { ascending: false }).returns<Row[]>();
  const versions = data ?? [];
  const stale = versions.slice(VERSIONS_KEPT).filter((v) => v.decision !== "approved" && !v.purged_at);
  let pruned = 0;
  for (const v of stale) {
    const paths = v.version_sides.flatMap((s) => [s.optimised_path, s.preview_path, s.thumb_path]).filter((p): p is string => !!p);
    if (paths.length) { const { error } = await supabase.storage.from(BUCKET).remove(paths); if (error) { console.error("[prune]", error.message); continue; } }
    for (const s of v.version_sides) await supabase.from("version_sides").update({ optimised_path: null, preview_path: null, thumb_path: null }).eq("id", s.id);
    await supabase.from("versions").update({ purged_at: new Date().toISOString() }).eq("id", v.id);
    pruned++;
  }
  return pruned;
}

/** Every slot of every live event, for the daily job: catches anything an upload-time prune missed. */
export async function pruneAllSlots(db: SupabaseClient): Promise<number> {
  const { data: slots } = await db.from("slots").select("id,events!inner(status,deleted_at)").is("events.deleted_at", null).neq("events.status", "archived");
  let n = 0;
  for (const s of slots ?? []) n += await pruneOldVersions(db, s.id);
  return n;
}
