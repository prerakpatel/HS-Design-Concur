"use server";
import { requireActiveUser } from "@/lib/auth";
import { BUCKET } from "@/lib/storage";
import { MAX_UPLOAD_BYTES } from "@/config/limits";

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALL_MIMES = [...IMAGE_MIMES, "application/pdf"];

/** Step 1 of an upload: the browser asks for a signed URL and sends the file straight to storage. */
export async function createUploadUrl(slotId: string, filename: string, mime: string, bytes: number) {
  const { supabase, org } = await requireActiveUser();
  if (bytes > MAX_UPLOAD_BYTES) return { error: `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` };
  if (!ALL_MIMES.includes(mime)) return { error: "PNG, JPG, WebP, GIF, or a PDF for print formats." };
  const { data: slot } = await supabase.from("slots").select("id,event_id,events(org_id,status),formats(allowed_mimes)").eq("id", slotId).maybeSingle();
  const ev = slot?.events as unknown as { org_id: string; status: string } | null;
  if (!slot || ev?.org_id !== org.id) return { error: "Slot not found" };
  if (ev.status === "archived") return { error: "This event is archived and read-only." };
  const fmt = slot.formats as unknown as { allowed_mimes: string[] } | null;
  if (fmt && !fmt.allowed_mimes.includes(mime)) return { error: `This format accepts ${fmt.allowed_mimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}.` };
  const ext = filename.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `tmp/${slotId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not start upload" };
  return { path, token: data.token };
}
