"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { STICKY_KEY } from "@/components/assistant/tour";

const KEYS = ["dc.vichar.hello", "dc.vichar.tour", "dc.vichar.nudges"];

/** Settings → Vichar, while he is being tested: bring his first-time pieces back, or keep them coming back. Goes away when he ships. */
export function VicharTesting() {
  const [sticky, setSticky] = useState(false);
  useEffect(() => { try { setSticky(localStorage.getItem(STICKY_KEY) === "1"); } catch { /* private mode */ } }, []);
  const again = () => { try { for (const k of KEYS) localStorage.removeItem(k); sessionStorage.removeItem("dc.vichar.thread"); } catch { /* private mode */ } window.location.assign("/events"); };
  const keep = (on: boolean) => { setSticky(on); try { if (on) localStorage.setItem(STICKY_KEY, "1"); else localStorage.removeItem(STICKY_KEY); } catch { /* private mode */ } };
  return (
    <section className="max-w-xl space-y-5 rounded-2xl border border-border p-5">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em]">Testing Vichar</h2>
        <p className="mt-1 text-sm text-muted-foreground">His hello card on Projects and the walk-through show once per person. While he is being tested, bring them back here. This is per device and goes away when he ships.</p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl bg-subtle px-4 py-3">
        <div><p className="text-sm font-medium">Keep them coming back</p><p className="text-[13px] text-muted-foreground">The card and the walk-through on every load, however many times they were dismissed.</p></div>
        <Switch checked={sticky} onCheckedChange={keep} aria-label="Keep the hello card and walk-through coming back" />
      </div>
      <Button variant="secondary" className="rounded-full" onClick={again}>Show them again now</Button>
    </section>
  );
}
