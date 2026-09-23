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
      // prompt=select_account: Google shows the account chooser every time instead of silently reusing the last account.
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next ?? "/events")}`, queryParams: { prompt: "select_account" } },
    });
  }
  return (
    <Button size="lg" className="w-full" onClick={signIn} disabled={busy}>
      {busy ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}
