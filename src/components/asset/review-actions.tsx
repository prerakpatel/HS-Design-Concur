"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { approveVersion, reopenVersion, downloadLink, sendForReview } from "@/app/actions/reviews";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { toastError } from "@/lib/toast-error";

/**
 * The decision row. An unsent version shows Send for review to whoever may send it (uploader, assignee, Core
 * Admin) and nothing to approvers; a sent one shows approve (notify / download), request changes, reopen.
 * Downloads are named year_event_format_vN and saved, not opened.
 */
export function ReviewActions({ versionId, stamp, label, eventTitle, decision, canApprove, isOwnUpload, hasBack, openChanges = 0, sent = true, canSend = false, layout = "row", zip }: {
  versionId: string; stamp?: string; label: string; eventTitle: string; decision: string; canApprove: boolean; isOwnUpload: boolean; hasBack: boolean;
  /** ZIP downloads once approved: every approved design in the project, and this format's front and back. */
  zip?: { all: string; format: string };
  /** Change requests on this version that are not done yet: the approval dialog says so. */
  openChanges?: number;
  /** Has the designer sent this version to the approvers yet? */
  sent?: boolean; canSend?: boolean;
  /** `row`: buttons side by side (phone bar). `fill`: stacked, full width (status card). */
  layout?: "row" | "fill";
}) {
  const [mode, setMode] = useState<"none" | "approve" | "reopen">("none");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const mobile = useIsMobile();
  const approved = decision === "approved";
  const close = () => { setMode("none"); setText(""); };

  const download = async (side: "front" | "back" = "front") => {
    const url = await downloadLink(versionId, side);
    const a = document.createElement("a"); a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    toast.success(side === "back" ? "Downloading the back" : "Download started");
  };
  const run = (fn: () => Promise<unknown>, done: string | ((r: unknown) => string)) => start(async () => { try { const r = await fn(); close(); toast.success(typeof done === "function" ? done(r) : done); } catch (e) { toastError(e); } });

  const downloadButtons = (
    <>
      <Button variant="secondary" disabled={pending} onClick={() => start(async () => { try { await download("front"); } catch (e) { toastError(e); } })}>Download{hasBack ? " front" : ""}</Button>
      {hasBack && <Button variant="secondary" disabled={pending} onClick={() => start(async () => { try { await download("back"); } catch (e) { toastError(e); } })}>Download back</Button>}
      {zip && hasBack && <Button asChild variant="secondary"><a href={zip.format} download>Front and back · ZIP</a></Button>}
      {zip && <Button asChild variant="secondary"><a href={zip.all} download>All approved · ZIP</a></Button>}
    </>
  );
  const wrap = layout === "fill" ? "flex flex-col gap-2 [&>a]:w-full [&>button]:w-full" : "flex flex-wrap gap-2";
  if (!sent) {
    if (!canSend) return <p className="text-sm text-muted-foreground">Not sent for review yet. The designer is still working on it.</p>;
    return (
      <div className={wrap}>
        <Button disabled={pending} onClick={() => run(() => sendForReview(versionId), (r) => ((r as { quiet?: boolean })?.quiet ? "Updated · approvers were already told about this version" : "Sent for review · approvers notified"))}>Send for review</Button>
        <p className="w-full text-xs text-muted-foreground">Only you can see it is here. Check it, replace it or add the back first; approvers are told when you send.</p>
      </div>
    );
  }
  if (!canApprove) return approved ? <div className={wrap}>{downloadButtons}</div> : null;

  const approveBody = (
    <div className="flex flex-col gap-2">
      <Button size="lg" disabled={pending} onClick={() => run(() => approveVersion(versionId, stamp), "Approved · everyone on the event is notified")}>Approve and notify</Button>
      <Button size="lg" variant="secondary" disabled={pending} onClick={() => run(async () => { await approveVersion(versionId, stamp); try { await download("front"); if (hasBack) await download("back"); } catch { toast.error("Approved, but the download did not start. Use the Download buttons."); } }, "Approved")}>Approve and download</Button>
      <Button size="lg" variant="ghost" onClick={close}>Cancel</Button>
    </div>
  );
  const title = mode === "approve" ? `Approve ${label}?` : `Reopen ${label}?`;
  const desc = mode === "approve" ? (decision === "changes_requested" ? `${label} has changes requested and no newer version has been uploaded since${openChanges > 0 ? ` (${openChanges} still open)` : " (it may have been reopened by accident)"}. Approve it as it is? Everyone on ${eventTitle} is notified.` : openChanges > 0 ? `${openChanges} change${openChanges === 1 ? " is" : "s are"} still open on ${label}. Approve anyway? Everyone on ${eventTitle} is notified.` : `Everyone on ${eventTitle} is notified. You can reopen it later.`) : "It goes back to work-in-progress and everyone on the event is notified.";
  const body = mode === "approve" ? approveBody : (
    <div className="flex flex-col gap-3">
      <Textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Why is it being reopened?" />
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={pending || !text.trim()} onClick={() => run(() => reopenVersion(versionId, text), "Reopened · everyone notified")}>Reopen</Button></div>
    </div>
  );

  return (
    <>
      <div className={wrap}>
        {approved ? (
          <>{downloadButtons}<Button variant="outline" onClick={() => setMode("reopen")}>Reopen for changes</Button></>
        ) : (
          <div className={cn(wrap, layout === "fill" && "flex-col-reverse")}>
            <Button disabled={isOwnUpload || pending} onClick={() => setMode("approve")}>Approve…</Button>
          </div>
        )}
        {isOwnUpload && !approved && <p className="w-full text-xs text-muted-foreground">You uploaded this version, so someone else has to approve it.</p>}
      </div>
      {mobile ? (
        <Drawer open={mode !== "none"} onOpenChange={(o) => !o && close()}><DrawerContent className="px-5 pb-8"><DrawerHeader className="text-center"><DrawerTitle>{title}</DrawerTitle><DrawerDescription>{desc}</DrawerDescription></DrawerHeader>{body}</DrawerContent></Drawer>
      ) : (
        <Dialog open={mode !== "none"} onOpenChange={(o) => !o && close()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{desc}</DialogDescription></DialogHeader>{body}</DialogContent></Dialog>
      )}
    </>
  );
}
