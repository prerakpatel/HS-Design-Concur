"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/material-icon";
import { ConfirmButton } from "@/components/confirm-button";
import { Textarea } from "@/components/ui/textarea";
import { setMaintenance } from "@/app/actions/admin";
import { DEFAULT_HOLD_MESSAGE } from "@/components/maintenance-veil";
import { errorMessage } from "@/lib/user-error";

/** The one-button maintenance hold (Settings › Maintenance). Core Admins are never blocked, so they can turn it off. */
export function MaintenanceCard({ on, message, since, by }: { on: boolean; message: string | null; since: string | null; by: string | null }) {
  const [text, setText] = useState(message ?? "");
  const router = useRouter();
  const run = (next: boolean) => async () => { try { await setMaintenance(next, text); toast.success(next ? "Hold is on. Everyone else now sees the hold screen." : "Hold is off. Everyone is back in."); router.refresh(); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <section className="max-w-2xl space-y-6 rounded-2xl border border-border p-5 md:p-6">
      <div className="flex items-start gap-4">
        <span className={"flex size-12 shrink-0 items-center justify-center rounded-full " + (on ? "bg-warning-soft text-warning-text" : "bg-subtle text-muted-foreground")}><Icon name="construction" className="!text-[26px]" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Maintenance hold</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{on ? <>On{by ? <> since {since ? new Date(since).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "just now"}, started by {by}</> : null}. Everyone except Core Admins sees a “please hold” screen.</> : "Puts a “please hold” screen over the whole app for everyone except Core Admins. Pages stay open underneath, so nobody loses what they were typing, and the screen lifts by itself when you turn this off."}</p>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="hold-message" className="text-sm font-medium">What people see <span className="font-normal text-muted-foreground">(optional)</span></label>
        <Textarea id="hold-message" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={300} placeholder={DEFAULT_HOLD_MESSAGE} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{on ? "You can still use the app while it is on." : "Tip: turn it on before a change goes out, off when it is live."}</p>
        {on
          ? <ConfirmButton variant="default" label="Turn off the hold" title="Let everyone back in?" description="The hold screen disappears on every open page within about 15 seconds." confirmLabel="Turn off" action={run(false)} />
          : <ConfirmButton variant="default" label="Turn on the hold" title="Put the app on hold?" description="Everyone except Core Admins sees the hold screen within about 15 seconds. Nothing they were typing is lost, and it lifts when you turn the hold off." confirmLabel="Turn on" action={run(true)} />}
      </div>
    </section>
  );
}
