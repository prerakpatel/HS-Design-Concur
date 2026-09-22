"use client";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/material-icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UploadPanel, requestUpload } from "@/components/asset/upload-panel";
import { ReviewActions } from "@/components/asset/review-actions";
import { deleteVersion } from "@/app/actions/reviews";
import { cn } from "@/lib/utils";

export interface VersionChip { id: string; number: number; decision: string; canManage: boolean; hasBack: boolean }

/**
 * One fixed bar for everything you can *do* here. Left: versions (each with a ⋯ menu to replace or delete)
 * and Upload. Right: Request changes / Approve, or Download / Reopen. Same on every width.
 */
export function AssetFooter({ eventId, slotId, versions, currentId, isPrint, accept, upload, actions, readOnly }: {
  eventId: string; slotId: string; versions: VersionChip[]; currentId: string | null; isPrint: boolean; accept: string[];
  upload: { nextNumber: number } | null;
  actions: { versionId: string; label: string; eventTitle: string; decision: string; canApprove: boolean; isOwnUpload: boolean; hasBack: boolean } | null;
  readOnly: boolean;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const remove = (v: VersionChip) => start(async () => {
    if (!confirm(`Delete v${v.number}? Its files are removed for good.`)) return;
    try { await deleteVersion(v.id); toast.success(`Version ${v.number} deleted`); router.replace(`/events/${eventId}/slots/${slotId}`); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
  });
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:left-[var(--sidebar-width,0px)]">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 md:px-10 md:py-3">
        <div className="flex items-center gap-1.5">
          {versions.length > 0 && (
            <div className="inline-flex items-center rounded-full bg-muted p-1">
              {[...versions].sort((a, b) => a.number - b.number).map((v) => (
                <div key={v.id} className={cn("flex items-center rounded-full text-sm font-medium", currentId === v.id ? "bg-card shadow-sm" : "text-muted-foreground")}>
                  <Link href={`/events/${eventId}/slots/${slotId}?v=${v.number}`} className="py-1 pl-3 pr-1.5">v{v.number}{v.decision === "approved" ? " ✓" : ""}</Link>
                  {v.canManage && !readOnly ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger aria-label={`Version ${v.number} options`} className="mr-0.5 flex size-7 items-center justify-center rounded-full hover:bg-muted"><Icon name="more_vert" className="!text-[16px]" /></DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
                        <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => requestUpload({ side: "front", replaceVersionId: v.id })}><Icon name="sync" />Replace v{v.number}{isPrint ? " (front or PDF)" : ""}</DropdownMenuItem>
                        {isPrint && !v.hasBack && <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => requestUpload({ side: "back", replaceVersionId: null })}><Icon name="flip" />Add back side</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm text-destructive-text" disabled={pending} onSelect={() => remove(v)}><Icon name="delete" />Delete v{v.number}</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : <span className="w-2" />}
                </div>
              ))}
            </div>
          )}
          {upload && !readOnly && <UploadPanel slotId={slotId} accept={accept} isPrint={isPrint} nextNumber={upload.nextNumber} label={versions.length ? "Upload" : "Upload design"} compactOnPhone />}
        </div>
        <div className="ml-auto flex items-center gap-2 [&>div]:flex-nowrap">
          {actions && !readOnly && <ReviewActions versionId={actions.versionId} label={actions.label} eventTitle={actions.eventTitle} decision={actions.decision} canApprove={actions.canApprove} isOwnUpload={actions.isOwnUpload} hasBack={actions.hasBack} />}
        </div>
      </div>
    </div>
  );
}
