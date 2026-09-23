import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/events";
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Google's photo URL rotates; keep the profile picture (and a missing name) in step on every sign-in.
      const meta = (data.user?.user_metadata ?? {}) as { avatar_url?: string; picture?: string; full_name?: string; name?: string };
      const avatar_url = meta.avatar_url ?? meta.picture ?? null;
      if (data.user && avatar_url) await supabase.from("users").update({ avatar_url }).eq("id", data.user.id);
      return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/events"}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
