import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { finalizeUploadFor } from "@/lib/uploads/finalize";

export const maxDuration = 60;

/** Called by the upload panel after the file has landed in storage. Runs image/PDF processing in its own function. */
export async function POST(req: Request) {
  const ctx = await getActiveUser();
  if (!ctx) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  const body = await req.json().catch(() => null) as { slotId?: string; tmpPath?: string; mime?: string; side?: "front" | "back"; mode?: "auto" | "new" } | null;
  if (!body?.slotId || !body.tmpPath || !body.mime) return NextResponse.json({ error: "Missing upload details" }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(body.slotId) || !new RegExp(`^tmp/${body.slotId}/[0-9a-f-]{36}\\.[a-z0-9]{1,5}$`, "i").test(body.tmpPath)) return NextResponse.json({ error: "Bad upload path" }, { status: 400 });
  const result = await finalizeUploadFor(ctx, body.slotId, body.tmpPath, body.mime, body.side === "back" ? "back" : "front", body.mode === "new" ? "new" : "auto");
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}
