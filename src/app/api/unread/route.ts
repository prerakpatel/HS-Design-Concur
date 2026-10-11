import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Unread notification count for the signed-in person, for the home-screen app badge. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const uid = claims?.claims.sub;
    if (!uid) return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } });
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).is("read_at", null);
    return NextResponse.json({ count: count ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ count: 0 }, { headers: { "Cache-Control": "no-store" } }); }
}
