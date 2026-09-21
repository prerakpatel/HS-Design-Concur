"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** "Are you sure?" gate for approve / reopen / delete (PRD §6.2). Runs a server action after confirmation. */
export function ConfirmButton({ action, title, description, label, confirmLabel, variant = "default", size = "default", withReason, reasonLabel, onDone, className }: {
  action: (reason: string) => Promise<unknown>;
  title: string; description: string; label: string; confirmLabel?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive"; size?: "default" | "sm" | "lg";
  withReason?: boolean; reasonLabel?: string; onDone?: () => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>{label}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>
          {withReason && <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={reasonLabel ?? "Reason"} rows={3} />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant={variant === "destructive" ? "destructive" : "default"} disabled={pending || (withReason && !reason.trim())} onClick={() => start(async () => {
              try { await action(reason); setOpen(false); setReason(""); onDone?.(); router.refresh(); }
              catch (e) { toast.error((e as Error).message); }
            })}>{pending ? "Working…" : (confirmLabel ?? label)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
