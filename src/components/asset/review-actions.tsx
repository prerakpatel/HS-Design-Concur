"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { approveVersion, requestChanges, reopenVersion, downloadLink } from "@/app/actions/reviews";
import { useIsMobile } from "@/hooks/use-mobile";

/** Approve (notify / download), request changes, reopen. Downloads are named year_event_format_vN and saved, not opened. */
export function ReviewActions({ versionId, label, eventTitle, decision, canApprove, isOwnUpload, hasBack, layout = "row" }: {
  versionId: string; label: string; eventTitle: string; decision: string; canApprove: boolean; isOwnUpload: boolean; hasBack: boolean;
  /** `row`: buttons side by side (phone bar). `fill`: stacked, full width (status card). */
  layout?: "row" | "fill";
}) {
  const [mode, setMode] = useState<"none" | "approve" | "changes" | "reopen">("none");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const mobile = useIsMobile();
  const approved = decision === "approved";
  const close = () => { setMode("none"); setText(""); };

  const download = async (side: "front" | "back" = "front") => {
    const url = await downloadLink(versionId, side);
    const a = document.createElement("a"); a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
    toast.success(side === "back" ? "Downloading the back" : "Download started");
  };
  const run = (fn: () => Promise<unknown>, done: string) => start(async () => { try { await fn(); close(); toast.success(done); router.refresh(); } catch (e) { toast.error((e as Error).message); } });

  const downloadButtons = (
    <>
      <Button variant="secondary" disabled={pending} onClick={() => start(async () => { try { await download("front"); } catch (e) { toast.error((e as Error).message); } })}>Download{hasBack ? " front" : ""}</Button>
      {hasBack && <Button variant="secondary" disabled={pending} onClick={() => start(async () => { try { await download("back"); } catch (e) { toast.error((e as Error).message); } })}>Download back</Button>}
    </>
  );
  const wrap = layout === "fill" ? "flex flex-col gap-2 [&>button]:w-full" : "flex flex-wrap gap-2";
  if (!canApprove) return approved ? <div className={wrap}>{downloadButtons}</div> : null;

  const approveBody = (
    <div className="flex flex-col gap-2">
      <Button size="lg" disabled={pending} onClick={() => run(() => approveVersion(versionId), "Approved · everyone on the event is notified")}>Approve and notify</Button>
      <Button size="lg" variant="secondary" disabled={pending} onClick={() => run(async () => { await approveVersion(versionId); await download("front"); if (hasBack) await download("back"); }, "Approved · download started")}>Approve and download</Button>
      <Button size="lg" variant="ghost" onClick={close}>Cancel</Button>
    </div>
  );
  const title = mode === "approve" ? `Approve ${label}?` : mode === "changes" ? "What needs to change?" : `Reopen ${label}?`;
  const desc = mode === "approve" ? `Everyone on ${eventTitle} is notified. You can reopen it later.` : mode === "changes" ? "Your note is posted as a comment and the designer is notified." : "It goes back to work-in-progress and everyone on the event is notified.";
  const body = mode === "approve" ? approveBody : (
    <div className="flex flex-col gap-3">
      <Textarea autoFocus rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "changes" ? "Move the date above the fold…" : "Why is it being reopened?"} />
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancel</Button><Button disabled={pending || !text.trim()} onClick={() => mode === "changes" ? run(() => requestChanges(versionId, text), "Changes requested · designer notified") : run(() => reopenVersion(versionId, text), "Reopened · everyone notified")}>{mode === "changes" ? "Request changes" : "Reopen"}</Button></div>
    </div>
  );

  return (
    <>
      <div className={wrap}>
        {approved ? (
          <>{downloadButtons}<Button variant="outline" onClick={() => setMode("reopen")}>Reopen for changes</Button></>
        ) : (
          <>
            <Button disabled={isOwnUpload || pending} onClick={() => setMode("approve")}>Approve…</Button>
            <Button variant="outline" onClick={() => setMode("changes")} disabled={isOwnUpload}><span className={layout === "row" ? "sm:hidden" : "hidden"}>Changes</span><span className={layout === "row" ? "hidden sm:inline" : ""}>Request changes</span></Button>
          </>
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
