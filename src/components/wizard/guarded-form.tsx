"use client";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/user-error";

/**
 * A wizard step's form. The server action runs from a submit handler (not the `action` prop), so a refused request
 * (a date out of range, the slot cap, a lost connection) shows a message and keeps everything typed, instead of
 * the error page. While it runs, the buttons are off, so a double click cannot create two drafts.
 */
export function GuardedForm({ action, className, children }: { action: (formData: FormData) => Promise<void>; className?: string; children: React.ReactNode }) {
  const [pending, start] = useTransition();
  const busy = useRef(false);
  return (
    <form className={className} onSubmit={(e) => {
      e.preventDefault();
      if (busy.current) return;
      busy.current = true;
      const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
      start(async () => {
        try { await action(data); }
        catch (err) { toast.error(errorMessage(err)); }
        finally { busy.current = false; }
      });
    }}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
    </form>
  );
}
