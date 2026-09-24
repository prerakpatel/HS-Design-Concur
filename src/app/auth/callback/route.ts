import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { notify, coreAdminIds } from "@/lib/notify";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/events";
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) {
        // Google's photo URL rotates; keep the profile picture in step on every sign-in. The Google account ID
        // doubles as the Google Chat user ID, so @mentions in Chat work without anyone typing anything.
        const meta = (data.user.user_metadata ?? {}) as { avatar_url?: string; picture?: string; provider_id?: string; sub?: string };
        const googleId = meta.provider_id ?? meta.sub ?? data.user.identities?.find((i) => i.provider === "google")?.id ?? null;
        const { data: me } = await supabase.from("users").select("status,name,email,gchat_user_id").eq("id", data.user.id).maybeSingle();
        const patch: Record<string, string> = {};
        const avatar_url = meta.avatar_url ?? meta.picture; if (avatar_url) patch.avatar_url = avatar_url;
        if (googleId && /^\d{6,}$/.test(googleId) && !me?.gchat_user_id) patch.gchat_user_id = googleId;
        if (Object.keys(patch).length) await supabase.from("users").update(patch).eq("id", data.user.id);
        if (me?.status === "pending") await announceAccessRequest(data.user.id, me.name, me.email);
      }
      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/events"}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}

/**
 * First sign-in of someone new: tell the Core Admins (in-app, push, chat) exactly once. A pending user cannot
 * write notifications under RLS, so this one system step uses the service client. Never blocks the sign-in.
 */
async function announceAccessRequest(userId: string, name: string | null, email: string) {
  try {
    const db = createServiceClient();
    const { data: req } = await db.from("access_requests").select("id").eq("user_id", userId).is("decided_at", null).is("notified_at", null).limit(1).maybeSingle();
    if (!req) return;
    await db.from("access_requests").update({ notified_at: new Date().toISOString() }).eq("id", req.id);
    await notify(db, await coreAdminIds(db), "access.requested", { name, email, href: "/settings?tab=requests" }, undefined, { orgId: "all" });
  } catch (e) { console.error("[access.requested]", (e as Error).message); }
}
