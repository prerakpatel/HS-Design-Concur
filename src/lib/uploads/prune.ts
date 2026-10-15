import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "@/lib/storage";
import { removeFiles, listR2 } from "@/lib/files";
import { VERSIONS_KEPT, TMP_UPLOAD_HOURS, CHAT_PREVIEW_DAYS } from "@/config/limits";
import { HOUR_MS, DAY_MS } from "@/lib/time";

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
    if (paths.length) { const error = await removeFiles(supabase, paths); if (error) { console.error("[prune]", error); continue; } }
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

/**
 * An upload lands in tmp/<slot>/ first and is removed once processed. One that failed or was abandoned stays; this
 * clears anything older than TMP_UPLOAD_HOURS so it does not sit in storage for good. Returns how many were removed.
 */
export async function sweepTmpUploads(db: SupabaseClient): Promise<number> {
  const cutoff = Date.now() - TMP_UPLOAD_HOURS * HOUR_MS;
  const bucket = db.storage.from(BUCKET);
  const { data: folders } = await bucket.list("tmp", { limit: 1000 });
  const old: string[] = [];
  for (const f of folders ?? []) {
    const { data: files } = await bucket.list(`tmp/${f.name}`, { limit: 1000 });
    for (const file of files ?? []) if (file.created_at && new Date(file.created_at).getTime() < cutoff) old.push(`tmp/${f.name}/${file.name}`);
  }
  for (let i = 0; i < old.length; i += 100) await bucket.remove(old.slice(i, i + 100));
  // The same for uploads in flight on Cloudflare R2.
  const oldR2 = (await listR2("tmp/")).filter((f) => f.modified < cutoff).map((f) => f.path);
  // And the pictures made for chat posts, once their links have run out.
  const chatCutoff = Date.now() - (CHAT_PREVIEW_DAYS + 1) * DAY_MS;
  const oldChat = (await listR2("chat/")).filter((f) => f.modified < chatCutoff).map((f) => f.path);
  await removeFiles(db, [...oldR2, ...oldChat]);
  return old.length + oldR2.length + oldChat.length;
}
