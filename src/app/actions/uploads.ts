"use server";
import { revalidatePath } from "next/cache";
import { requireActiveUser } from "@/lib/auth";
import { processUpload } from "@/lib/images";
import { BUCKET } from "@/lib/storage";
import { notify } from "@/lib/notify";
import { MAX_UPLOAD_BYTES } from "@/config/limits";

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Step 1 of an upload: the browser asks for a signed URL and sends the file straight to storage. */
export async function createUploadUrl(slotId: string, filename: string, mime: string, bytes: number) {
  const { supabase, org } = await requireActiveUser();
  if (bytes > MAX_UPLOAD_BYTES) return { error: `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` };
  if (!IMAGE_MIMES.includes(mime)) return { error: "PNG, JPG, WebP or GIF only for now. PDF support for print formats is coming." };
  const { data: slot } = await supabase.from("slots").select("id,event_id,events(org_id,brief_locked_at),formats(allowed_mimes)").eq("id", slotId).maybeSingle();
  const ev = slot?.events as unknown as { org_id: string } | null;
  if (!slot || ev?.org_id !== org.id) return { error: "Slot not found" };
  const fmt = slot.formats as unknown as { allowed_mimes: string[] } | null;
  if (fmt && !fmt.allowed_mimes.includes(mime)) return { error: `This format accepts ${fmt.allowed_mimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}.` };
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `tmp/${slotId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not start upload" };
  return { path, token: data.token };
}

/** Step 2: process the temporary upload into optimised / preview / thumb and record the version. */
export async function finalizeUpload(slotId: string, tmpPath: string, mime: string, side: "front" | "back" = "front") {
  const { supabase, user, org } = await requireActiveUser();
  const { data: slot } = await supabase.from("slots").select("*,events(id,org_id,title,created_by,brief_locked_at),formats(name,class)").eq("id", slotId).maybeSingle();
  const event = slot?.events as unknown as { id: string; org_id: string; title: string; created_by: string; brief_locked_at: string | null } | null;
  if (!slot || !event || event.org_id !== org.id) return { error: "Slot not found" };
  const fmt = slot.formats as unknown as { name: string; class: string };

  const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(tmpPath);
  if (dlErr || !file) return { error: "Upload not found in storage" };
  const input = Buffer.from(await file.arrayBuffer());
  let processed;
  try { processed = await processUpload(input, mime); } catch (e) { return { error: `Could not read that image: ${(e as Error).message}` }; }

  // Attach a Back side to the latest version if it is a print format, same uploader, no back yet, within the hour.
  let versionId: string | null = null; let number = 1;
  const { data: latest } = await supabase.from("versions").select("id,number,uploaded_by,created_at,version_sides(side)").eq("slot_id", slotId).order("number", { ascending: false }).limit(1).maybeSingle();
  if (latest) {
    const sides = (latest.version_sides as { side: string }[]).map((s) => s.side);
    const recent = Date.now() - new Date(latest.created_at).getTime() < 60 * 60 * 1000;
    if (side === "back" && fmt.class === "print" && latest.uploaded_by === user.id && !sides.includes("back") && recent) { versionId = latest.id; number = latest.number; }
    else number = latest.number + 1;
  }
  if (!versionId) {
    const { data: v, error } = await supabase.from("versions").insert({ slot_id: slotId, number, uploaded_by: user.id }).select("id").single();
    if (error || !v) return { error: error?.message ?? "Could not create version" };
    versionId = v.id;
  }
  const base = `${org.id}/${event.id}/${slotId}/v${number}/${side}`;
  const put = async (name: string, r: { buf: Buffer; mime: string; ext: string }) => {
    const p = `${base}/${name}.${r.ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(p, r.buf, { contentType: r.mime, upsert: true });
    if (error) throw new Error(error.message);
    return p;
  };
  try {
    const optimised_path = await put("optimised", processed.optimised);
    const preview_path = processed.preview ? await put("preview", processed.preview) : null;
    const thumb_path = await put("thumb", processed.thumb);
    await supabase.from("version_sides").upsert({ version_id: versionId, side, mime: processed.optimised.mime, width: processed.width, height: processed.height, bytes: processed.optimised.buf.length, optimised_path, preview_path, thumb_path }, { onConflict: "version_id,side" });
  } catch (e) { return { error: (e as Error).message }; }
  await supabase.storage.from(BUCKET).remove([tmpPath]);

  if (side === "front") {
    await supabase.from("versions").update({ decision: "superseded" }).eq("slot_id", slotId).neq("id", versionId).in("decision", ["pending", "changes_requested"]);
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
