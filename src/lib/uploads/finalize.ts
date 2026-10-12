import { revalidatePath } from "next/cache";
import { slotName } from "@/lib/project";
import { processUpload } from "@/lib/images";
import { rasterisePdf } from "@/lib/pdf";
import { BUCKET } from "@/lib/storage";
import { recomputeSlotState } from "@/lib/slot-state";
import { pruneOldVersions } from "@/lib/uploads/prune";
import type { ActiveContext } from "@/lib/auth";
import { MARK_VERSION } from "@/config/marks";

/**
 * Step 2 of an upload: process the temporary file into optimised / preview / thumb renditions and record the
 * version. Lives behind /api/uploads/finalize so the image and PDF libraries are traced into that one function
 * only, keeping page functions small and quick to start.
 */
export async function finalizeUploadFor(ctx: ActiveContext, slotId: string, tmpPath: string, mime: string, side: "front" | "back" = "front", mode: "auto" | "new" = "auto") {
  const { supabase, user, org } = ctx;
  const { data: slot } = await supabase.from("slots").select("*,events(id,org_id,title,created_by,brief_locked_at),label,formats(name,class)").eq("id", slotId).maybeSingle();
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

  let versionId: string | null = null; let number = 1;
  let keptInReview = false;
  const { data: latest } = await supabase.from("versions").select("id,number,uploaded_by,created_at,sent_at,decision,version_sides(side)").eq("slot_id", slotId).order("number", { ascending: false }).limit(1).maybeSingle();
  // One Upload button; the state of the newest version decides what it does, for either side:
  //   not sent yet                       → change it quietly (nobody has seen it)
  //   sent, nobody has reacted           → change it and keep it in review (approvers always see the newest file)
  //   commented on, approved or changes requested → a new version, so feedback stays attached to what it was about
  //     (a back-only change carries the front over untouched)
  // `mode: "new"` forces a new version (the uploader chose "Save as new version" when asked).
  let inPlace = false;
  if (mode === "auto" && latest && latest.decision === "pending" && (latest.uploaded_by === user.id || user.role === "core_admin")) {
    const { data: talked } = await supabase.from("comments").select("id").eq("version_id", latest.id).eq("is_draft", false).limit(1);
    inPlace = !talked?.length;
  }
  const hadBack = !!latest && (latest.version_sides as { side: string }[]).some((x) => x.side === "back");
  const changing: ("front" | "back")[] = isPdf ? ["front", "back"] : inputs.map((i) => i.side);
  // Replaced files are removed only after the new ones are safely stored, so a failed upload leaves the version as it was.
  let oldPaths: string[] = [];
  if (inPlace && latest) {
    versionId = latest.id; number = latest.number;
    const { data: old } = await supabase.from("version_sides").select("optimised_path,preview_path,thumb_path").eq("version_id", latest.id).in("side", changing);
    oldPaths = (old ?? []).flatMap((x) => [x.optimised_path, x.preview_path, x.thumb_path]).filter((p): p is string => !!p);
    keptInReview = !!latest.sent_at;
  } else if (latest) number = latest.number + 1;
  let inserted = false;
  const written: string[] = [];
  /** A failed upload leaves nothing behind: files already written go, and a version made for it goes too. */
  const undo = async () => {
    if (written.length) await supabase.storage.from(BUCKET).remove(written);
    if (inserted && versionId) await supabase.from("versions").delete().eq("id", versionId);
  };
  if (!versionId) {
    inserted = true;
    const { data: v, error } = await supabase.from("versions").insert({ slot_id: slotId, number, uploaded_by: user.id }).select("id").single();
    if (error || !v) return { error: error?.message ?? "Could not create version" };
    versionId = v.id;
    // A new version made for a back-only change keeps the front exactly as it was.
    if (latest && !isPdf && side === "back") {
      const { data: fs } = await supabase.from("version_sides").select("mime,width,height,bytes,optimised_path,preview_path,thumb_path,mark_version").eq("version_id", latest.id).eq("side", "front").maybeSingle();
      if (fs?.optimised_path) {
        const copy = async (from: string | null, name: string) => {
          if (!from) return null;
          const to = `${org.id}/${event.id}/${slotId}/v${number}/front/${name}.${from.split(".").pop()}`;
          const { error } = await supabase.storage.from(BUCKET).copy(from, to);
          if (error) throw new Error(error.message);
          written.push(to);
          return to;
        };
        try {
          const [optimised_path, preview_path, thumb_path] = await Promise.all([copy(fs.optimised_path, "optimised"), copy(fs.preview_path, "preview"), copy(fs.thumb_path, "thumb")]);
          await supabase.from("version_sides").insert({ version_id: versionId, side: "front", ...fs, optimised_path, preview_path, thumb_path });
        } catch (e) { await undo(); return { error: (e as Error).message }; }
      }
    }
  }
  try {
    for (const { side: s, processed } of processedSides) {
      const base = `${org.id}/${event.id}/${slotId}/v${number}/${s}${inPlace ? `-${Date.now().toString(36)}` : ""}`;
      const put = async (name: string, r: { buf: Buffer; mime: string; ext: string }) => {
        const p = `${base}/${name}.${r.ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(p, r.buf, { contentType: r.mime, upsert: true });
        if (error) throw new Error(error.message);
        written.push(p);
        return p;
      };
      const [optimised_path, preview_path, thumb_path] = await Promise.all([put("optimised", processed.optimised), processed.preview ? put("preview", processed.preview) : null, put("thumb", processed.thumb)]);
      const { error } = await supabase.from("version_sides").upsert({ version_id: versionId, side: s, mime: processed.optimised.mime, width: processed.width, height: processed.height, bytes: processed.optimised.buf.length, optimised_path, preview_path, thumb_path, mark_version: MARK_VERSION }, { onConflict: "version_id,side" });
      if (error) throw new Error(error.message);
    }
  } catch (e) { await undo(); return { error: (e as Error).message }; }
  if (inPlace && latest) {
    // Everything new is stored: now the replaced files and any side the new file no longer has can go.
    const stale = changing.filter((c) => !processedSides.some((p) => p.side === c));
    if (stale.length) await supabase.from("version_sides").delete().eq("version_id", latest.id).in("side", stale);
    if (oldPaths.length) await supabase.storage.from(BUCKET).remove(oldPaths);
    await supabase.from("versions").update({ uploaded_by: user.id, created_at: new Date().toISOString() }).eq("id", latest.id);
  }
  await supabase.storage.from(BUCKET).remove([tmpPath]);

  // Uploading is private: the slot only moves to In review when the designer sends the version (sendForReview).
  if (firstSide === "front" || inserted) {
    if (!event.brief_locked_at) await supabase.from("events").update({ brief_locked_at: new Date().toISOString() }).eq("id", event.id);
    await supabase.from("activity").insert({ org_id: org.id, event_id: event.id, slot_id: slotId, version_id: versionId, actor_id: user.id, kind: inPlace && keptInReview ? "version.updated" : "version.uploaded", payload: { format: slotName(fmt.name, slot.label), number } });
    if (inPlace) await recomputeSlotState(supabase, slotId);
    // A new version pushes the oldest out: only the newest VERSIONS_KEPT keep files (approved ones always do).
    else await pruneOldVersions(supabase, slotId);
  }
  revalidatePath(`/events/${event.id}`);
  revalidatePath(`/events/${event.id}/slots/${slotId}`);
  const outcome = inPlace ? (side === "back" && !isPdf && !hadBack ? "back" : keptInReview ? "updated" : "replaced") : side === "back" && !isPdf && latest ? "new-back" : "new";
  return { ok: true, versionId, number, keptInReview, outcome };
}
