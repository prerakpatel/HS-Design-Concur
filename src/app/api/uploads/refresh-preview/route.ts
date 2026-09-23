import { NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { refreshPreviews } from "@/lib/uploads/refresh-preview";

export const maxDuration = 60;

/** Re-stamps previews made with an older DRAFT mark. Called by the asset page when it notices one. */
export async function POST(req: Request) {
  const ctx = await getActiveUser();
  if (!ctx) return NextResponse.json({ error: "Sign in again" }, { status: 401 });
  const body = await req.json().catch(() => null) as { sideIds?: string[] } | null;
  if (!Array.isArray(body?.sideIds) || body.sideIds.length === 0) return NextResponse.json({ error: "Nothing to refresh" }, { status: 400 });
  return NextResponse.json(await refreshPreviews(ctx, body.sideIds.filter((x) => typeof x === "string")));
}
