"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton({ next }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  async function signIn() {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/events")}` },
    });
  }
  return (
    <Button size="lg" className="h-11 w-full rounded-[10px]" onClick={signIn} disabled={busy}>
      {busy ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
