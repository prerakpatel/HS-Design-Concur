import { revalidatePath } from "next/cache";
import { processUpload } from "@/lib/images";
import { rasterisePdf } from "@/lib/pdf";
import { BUCKET } from "@/lib/storage";
import { notify } from "@/lib/notify";
import type { ActiveContext } from "@/lib/auth";
import { MARK_VERSION } from "@/config/marks";

/**
 * Step 2 of an upload: process the temporary file into optimised / preview / thumb renditions and record the
 * version. Lives behind /api/uploads/finalize so the image and PDF libraries are traced into that one function
 * only, keeping page functions small and quick to start.
 */
export async function finalizeUploadFor(ctx: ActiveContext, slotId: string, tmpPath: string, mime: string, side: "front" | "back" = "front", replaceVersionId?: string | null) {
  const { supabase, user, org } = ctx;
  const { data: slot } = await supabase.from("slots").select("*,events(id,org_id,title,created_by,brief_locked_at),formats(name,class)").eq("id", slotId).maybeSingle();
  const event = slot?.events as unknown as { id: string; org_id: string; title: string; created_by: string; brief_locked_at: string | null } | null;
  if (!slot || !event || event.org_id !== org.id) return { error: "Slot not found" };
  const fmt = slot.formats as unknown as { name: string; class: string };

  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(tmpPath);
  if (dlErr || !file) return { error: "Upload not found in storage" };
  const input = Buffer.from(await file.arrayBuffer());
  const isPdf = mime === "application/pdf";
  if (isPdf && fmt.class !== "print") return { error: "PDF uploads are for print formats. Export a PNG or JPG for digital formats." };

  // A print PDF becomes one side per page (page 1 front, page 2 back); an image is one side.
  let inputs: { side: "front" | "back"; buf: Buffer; mime: string }[];
  try {
    inputs = isPdf ? (await rasterisePdf(input)).map((buf, i) => ({ side: i === 0 ? "front" as const : "back" as const, buf, mime: "image/jpeg" })) : [{ side, buf: input, mime }];
  } catch (e) { await supabase.storage.from(BUCKET).remove([tmpPath]); return { error: (e as Error).message }; }
  const processedSides: { side: "front" | "back"; processed: Awaited<ReturnType<typeof processUpload>> }[] = [];
  try { for (const inp of inputs) processedSides.push({ side: inp.side, processed: await processUpload(inp.buf, inp.mime) }); }
  catch (e) { return { error: `Could not read that file: ${(e as Error).message}` }; }
  const firstSide = inputs[0].side;

  // Attach a Back side to the latest version if it is a print format, same uploader, no back yet, within the hour.
  let versionId: string | null = null; let number = 1;
  const { data: latest } = await supabase.from("versions").select("id,number,uploaded_by,created_at,version_sides(side)").eq("slot_id", slotId).order("number", { ascending: false }).limit(1).maybeSingle();
  if (replaceVersionId) {
    // Replace: same version number, files overwritten, decision back to pending.
    const { data: rv } = await supabase.from("versions").select("id,number,uploaded_by").eq("id", replaceVersionId).eq("slot_id", slotId).maybeSingle();
    if (!rv) return { error: "That version no longer exists" };
    if (rv.uploaded_by !== user.id && user.role !== "core_admin") return { error: "Only the uploader or a Core Admin can replace a version" };
    versionId = rv.id; number = rv.number;
    const { data: old } = await supabase.from("version_sides").select("optimised_path,preview_path,thumb_path").eq("version_id", rv.id);
    const gone = (old ?? []).flatMap((s) => [s.optimised_path, s.preview_path, s.thumb_path]).filter((p): p is string => !!p);
    if (gone.length) await supabase.storage.from(BUCKET).remove(gone);
    if (isPdf || side === "front") await supabase.from("version_sides").delete().eq("version_id", rv.id);
    await supabase.from("versions").update({ decision: "pending", decided_by: null, decided_at: null, uploaded_by: user.id, created_at: new Date().toISOString() }).eq("id", rv.id);
  } else if (latest) {
    const sides = (latest.version_sides as { side: string }[]).map((s) => s.side);
    const recent = Date.now() - new Date(latest.created_at).getTime() < 60 * 60 * 1000;
    if (!isPdf && side === "back" && fmt.class === "print" && latest.uploaded_by === user.id && !sides.includes("back") && recent) { versionId = latest.id; number = latest.number; }
    else number = latest.number + 1;
  }
  if (!versionId) {
    const { data: v, error } = await supabase.from("versions").insert({ slot_id: slotId, number, uploaded_by: user.id }).select("id").single();
    if (error || !v) return { error: error?.message ?? "Could not create version" };
    versionId = v.id;
  }
  try {
    for (const { side: s, processed } of processedSides) {
      const base = `${org.id}/${event.id}/${slotId}/v${number}/${s}${replaceVersionId ? `-${Date.now().toString(36)}` : ""}`;
      const put = async (name: string, r: { buf: Buffer; mime: string; ext: string }) => {
        const p = `${base}/${name}.${r.ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(p, r.buf, { contentType: r.mime, upsert: true });
        if (error) throw new Error(error.message);
        return p;
      };
      const optimised_path = await put("optimised", processed.optimised);
      const preview_path = processed.preview ? await put("preview", processed.preview) : null;
      const thumb_path = await put("thumb", processed.thumb);
      await supabase.from("version_sides").upsert({ version_id: versionId, side: s, mime: processed.optimised.mime, width: processed.width, height: processed.height, bytes: processed.optimised.buf.length, optimised_path, preview_path, thumb_path, mark_version: MARK_VERSION }, { onConflict: "version_id,side" });
    }
  } catch (e) { return { error: (e as Error).message }; }
  await supabase.storage.from(BUCKET).remove([tmpPath]);

  if (firstSide === "front") {
    if (!replaceVersionId) await supabase.from("versions").update({ decision: "superseded" }).eq("slot_id", slotId).neq("id", versionId).in("decision", ["pending", "changes_requested"]);
    await supabase.from("slots").update({ state: "in_review", updated_at: new Date().toISOString() }).eq("id", slotId);
    if (!event.brief_locked_at) await supabase.from("events").update({ brief_locked_at: new Date().toISOString() }).eq("id", event.id);
    await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slotId, version_id: versionId, actor_id: user.id, kind: "version.uploaded", payload: { format: fmt.name, number } });
    const { data: approvers } = await supabase.from("users").select("id,org_memberships!inner(org_id)").eq("status", "active").eq("org_memberships.org_id", org.id).or("is_approver.eq.true,role.eq.core_admin");
    await notify(supabase, [...(approvers ?? []).map((a) => a.id), event.created_by], "version.uploaded", { eventId: event.id, slotId, title: event.title, format: fmt.name, number, by: user.name ?? user.email }, user.id, { orgId: org.id });
  }
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/slots/${slotId}`);
  return { ok: true, versionId, number };
}
