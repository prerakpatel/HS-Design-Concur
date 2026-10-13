import { NextResponse } from "next/server";
import { getViewer, projectContext } from "@/lib/auth";
import { finalizeUploadFor } from "@/lib/uploads/finalize";
import { refreshPreviews } from "@/lib/uploads/refresh-preview";

export const maxDuration = 60;

/**
 * The two endpoints that need the image/PDF tools share one route, so each deployment carries one copy of
 * sharp, canvas and pdf.js instead of two (Vercel Functions Storage).
 * - POST /api/uploads/finalize: called by the upload panel after the file has landed in storage.
 * - POST /api/uploads/refresh-preview: re-stamps previews made with an older DRAFT mark; called by the asset page.
 */
export async function POST(req: Request, { params }: { params: Promise<{ op: string }> }) {
  const { op } = await params;
  if (op !== "finalize" && op !== "refresh-preview") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in again" }, { status: 401 });

  if (op === "refresh-preview") {
    const body = await req.json().catch(() => null) as { sideIds?: string[] } | null;
    if (!Array.isArray(body?.sideIds) || body.sideIds.length === 0) return NextResponse.json({ error: "Nothing to refresh" }, { status: 400 });
    return NextResponse.json(await refreshPreviews(viewer, body.sideIds.filter((x) => typeof x === "string")));
  }

  const body = await req.json().catch(() => null) as { slotId?: string; tmpPath?: string; mime?: string; side?: "front" | "back"; mode?: "auto" | "new" } | null;
  if (!body?.slotId || !body.tmpPath || !body.mime) return NextResponse.json({ error: "Missing upload details" }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(body.slotId) || !new RegExp(`^(r2:)?tmp/${body.slotId}/[0-9a-f-]{36}\\.[a-z0-9]{1,5}$`, "i").test(body.tmpPath)) return NextResponse.json({ error: "Bad upload path" }, { status: 400 });
  // Members of the project's organization and guests on its People list may upload.
  const { data: slot } = await viewer.supabase.from("slots").select("events(org_id)").eq("id", body.slotId).maybeSingle();
  const orgId = (slot?.events as unknown as { org_id: string } | null)?.org_id;
  const ctx = orgId ? projectContext(viewer, orgId) : null;
  if (!ctx) return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  const result = await finalizeUploadFor(ctx, body.slotId, body.tmpPath, body.mime, body.side === "back" ? "back" : "front", body.mode === "new" ? "new" : "auto");
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
