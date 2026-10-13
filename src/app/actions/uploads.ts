"use server";
import { requireViewer, projectContext } from "@/lib/auth";
import { newPath, uploadTarget } from "@/lib/files";
import { MAX_UPLOAD_BYTES } from "@/config/limits";

const IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const ALL_MIMES = [...IMAGE_MIMES, "application/pdf"];

/** Step 1 of an upload: the browser asks for a signed URL and sends the file straight to storage. */
export async function createUploadUrl(slotId: string, filename: string, mime: string, bytes: number) {
  const viewer = await requireViewer(); const { supabase } = viewer;
  if (bytes > MAX_UPLOAD_BYTES) return { error: `Files must be under ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.` };
  if (!ALL_MIMES.includes(mime)) return { error: "PNG, JPG, WebP, GIF, or a PDF for print formats." };
  const { data: slot } = await supabase.from("slots").select("id,event_id,events(org_id,status),formats(allowed_mimes)").eq("id", slotId).maybeSingle();
  const ev = slot?.events as unknown as { org_id: string; status: string } | null;
  // A member of the project's organization, or a guest on its People list.
  if (!slot || !ev || !projectContext(viewer, ev.org_id)) return { error: "Slot not found" };
  if (ev.status === "archived") return { error: "This event is archived and read-only." };
  const fmt = slot.formats as unknown as { allowed_mimes: string[] } | null;
  if (fmt && !fmt.allowed_mimes.includes(mime)) return { error: `This format accepts ${fmt.allowed_mimes.map((m) => m.split("/")[1].toUpperCase()).join(", ")}.` };
  const ext = filename.match(/\.([a-z0-9]{1,5})$/i)?.[1].toLowerCase() ?? "bin";
  // Straight from the browser to storage (Cloudflare R2 when configured), then processed by /api/uploads/finalize.
  try { return await uploadTarget(supabase, newPath(`tmp/${slotId}/${crypto.randomUUID()}.${ext}`)); }
  catch (e) { return { error: (e as Error).message }; }
}
