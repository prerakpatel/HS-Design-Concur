"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { approveVersion, requestChanges, reopenVersion } from "@/app/actions/reviews";
import { useIsMobile } from "@/hooks/use-mobile";

export function ReviewActions({ versionId, label, eventTitle, decision, canApprove, isOwnUpload, downloadUrl }: {
  versionId: string; label: string; eventTitle: string; decision: string; canApprove: boolean; isOwnUpload: boolean; downloadUrl: string | null;
}) {
  const [mode, setMode] = useState<"none" | "approve" | "changes" | "reopen">("none");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const mobile = useIsMobile();
  const close = () => { setMode("none"); setText(""); };
  const run = (fn: () => Promise<unknown>, after?: () => void) => start(async () => { try { await fn(); close(); after?.(); router.refresh(); } catch (e) { toast.error((e as Error).message); } });

  if (!canApprove) return decision === "approved" && downloadUrl ? <Button asChild variant="secondary"><a href={downloadUrl} download>Download approved</a></Button> : null;
  const approved = decision === "approved";

  const approveBody = (
    <div className="flex flex-col gap-2">
      <Button size="lg" disabled={pending} onClick={() => run(() => approveVersion(versionId))}>Approve and notify</Button>
      <Button size="lg" variant="secondary" disabled={pending || !downloadUrl} onClick={() => run(() => approveVersion(versionId), () => { if (downloadUrl) window.open(downloadUrl, "_blank"); })}>Approve and download</Button>
      <Button size="lg" variant="ghost" onClick={close}>Cancel</Button>
    </div>
  );
  const title = mode === "approve" ? `Approve ${label}?` : mode === "changes" ? "What needs to change?" : `Reopen ${label}?`;
  const desc = mode === "approve" ? `Everyone on ${eventTitle} is notified. You can reopen it later.` : mode === "changes" ? "Your note is posted as a comment and the designer is notified." : "It goes back to work-in-progress and everyone on the event is notified.";
  const body = mode === "approve" ? approveBody : (
    <div className="flex flex-col gap-3">
      <Textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "changes" ? "Move the date above the fold…" : "Why is it being reopened?"} />
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={pending || !text.trim()} onClick={() => run(() => (mode === "changes" ? requestChanges(versionId, text) : reopenVersion(versionId, text)))}>{mode === "changes" ? "Request changes" : "Reopen"}</Button></div>
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {approved ? (
          <>
            {downloadUrl && <Button asChild variant="secondary"><a href={downloadUrl} download>Download</a></Button>}
            <Button variant="outline" onClick={() => setMode("reopen")}>Reopen for changes</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setMode("changes")} disabled={isOwnUpload}>Request changes</Button>
            {mobile ? <Button onClick={() => setMode("approve")} disabled={isOwnUpload}>Approve</Button> : (
              <>
                <Button variant="secondary" disabled={isOwnUpload || pending} onClick={() => setMode("approve")}>Approve and notify</Button>
                <Button disabled={isOwnUpload || pending} onClick={() => setMode("approve")}>Approve and download</Button>
              </>
            )}
          </>
        )}
        {isOwnUpload && !approved && <p className="w-full text-xs text-muted-foreground">You uploaded this version, so someone else has to approve it.</p>}
      </div>
      {mobile ? (
        <Drawer open={mode !== "none"} onOpenChange={(o) => !o && close()}><DrawerContent className="px-5 pb-8"><DrawerHeader className="text-center"><DrawerTitle>{title}</DrawerTitle><DrawerDescription>{desc}</DrawerDescription></DrawerHeader>{body}</DrawerContent></Drawer>
      ) : (
        <Dialog open={mode !== "none"} onOpenChange={(o) => !o && close()}><DialogContent className="rounded-2xl sm:max-w-md"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription></DialogHeader>{body}<DialogFooter /></DialogContent></Dialog>
      )}
    </>
  );
}
