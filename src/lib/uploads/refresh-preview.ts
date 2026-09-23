import { makePreview } from "@/lib/images";
import { BUCKET } from "@/lib/storage";
import { createServiceClient } from "@/lib/supabase/service";
import { MARK_VERSION } from "@/config/marks";
import type { ActiveContext } from "@/lib/auth";

/**
 * Re-stamp previews that carry an older DRAFT mark. The caller's own client (RLS) decides which sides they may see;
 * the service client then writes the new file and bumps mark_version. New path per generation so no CDN cache serves
 * the old image.
 */
export async function refreshPreviews(ctx: ActiveContext, sideIds: string[]) {
  const { data: sides } = await ctx.supabase.from("version_sides").select("id,optimised_path,preview_path,mime,mark_version").in("id", sideIds.slice(0, 8));
  const svc = createServiceClient();
  let done = 0;
  for (const s of sides ?? []) {
    if (!s.optimised_path || !s.preview_path || s.mime === "image/gif" || (s.mark_version ?? 0) >= MARK_VERSION) continue;
    const { data: file } = await svc.storage.from(BUCKET).download(s.optimised_path);
    if (!file) continue;
    const preview = await makePreview(Buffer.from(await file.arrayBuffer()));
    const next = s.preview_path.replace(/(-m\d+)?\.\w+$/, `-m${MARK_VERSION}.${preview.ext}`);
    const { error } = await svc.storage.from(BUCKET).upload(next, preview.buf, { contentType: preview.mime, upsert: true });
    if (error) continue;
    await svc.from("version_sides").update({ preview_path: next, mark_version: MARK_VERSION }).eq("id", s.id);
    if (next !== s.preview_path) await svc.storage.from(BUCKET).remove([s.preview_path]);
    done++;
  }
  return { done };
}
