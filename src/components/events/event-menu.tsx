"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// icons: more_vert delete
/** The event page ⋮: Delete for the creator or a Core Admin. Soft delete, restorable from Archive for 7 days. */
export function EventMenu({ title, isDraft, remove }: { title: string; isDraft: boolean; remove: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More"><Icon name="more_vert" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5">
          <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm text-destructive-text" onSelect={() => setOpen(true)}><Icon name="delete" />{isDraft ? "Delete draft" : "Delete event"}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader><DialogTitle>Delete “{title}”?</DialogTitle><DialogDescription>It leaves the Events list and frees its event slot. A Core Admin can restore it from Archive for 7 days; after that its files are removed for good.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant="destructive" disabled={pending} onClick={() => start(async () => { try { await remove(); } catch (e) { toast.error((e as Error).message); } })}>{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
