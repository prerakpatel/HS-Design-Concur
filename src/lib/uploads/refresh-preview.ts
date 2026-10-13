import { makePreview } from "@/lib/images";
import { readFile, writeFile, removeFiles } from "@/lib/files";
import { createServiceClient } from "@/lib/supabase/service";
import { MARK_VERSION } from "@/config/marks";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Re-stamp previews that carry an older DRAFT mark. The caller's own client (RLS) decides which sides they may see;
 * the service client then writes the new file and bumps mark_version. New path per generation so no CDN cache serves
 * the old image.
 */
export async function refreshPreviews(ctx: { supabase: SupabaseClient }, sideIds: string[]) {
  const { data: sides } = await ctx.supabase.from("version_sides").select("id,optimised_path,preview_path,mime,mark_version").in("id", sideIds.slice(0, 8));
  return restamp(createServiceClient(), sides ?? []);
}

type SideRow = { id: string; optimised_path: string | null; preview_path: string | null; mime: string | null; mark_version: number | null };
async function restamp(svc: SupabaseClient, sides: SideRow[]) {
  let done = 0;
  for (const s of sides) {
    if (!s.optimised_path || !s.preview_path || s.mime === "image/gif" || (s.mark_version ?? 0) >= MARK_VERSION) continue;
    const file = await readFile(svc, s.optimised_path);
    if (!file) continue;
    const preview = await makePreview(file);
    const next = s.preview_path.replace(/(-m\d+)?\.\w+$/, `-m${MARK_VERSION}.${preview.ext}`);
    try { await writeFile(svc, next, preview.buf, preview.mime); } catch { continue; }
    await svc.from("version_sides").update({ preview_path: next, mark_version: MARK_VERSION }).eq("id", s.id);
    if (next !== s.preview_path) await removeFiles(svc, [s.preview_path]);
    done++;
  }
  return { done };
}
