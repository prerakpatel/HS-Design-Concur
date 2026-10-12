"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Lightbox } from "@/components/asset/lightbox";
import { UploadPanel, UploadDropArea, requestUpload } from "@/components/asset/upload-panel";
import { MockStage, hasMock } from "@/components/events/format-thumb";
import type { Format } from "@/lib/types";

// icons: image devices
import { Guides, PinBubble, PinChip, DraftMark, guideGeometry, type SafeArea, type Pin, type PrintGuides } from "@/components/asset/viewer";
import { addComment, sendCommentBatch, discardCommentBatch, setCommentFlag, editComment, deleteComment, deleteVersion } from "@/app/actions/reviews";
import { assignSlot } from "@/app/actions/events";
import { CommentEditor } from "@/components/rich/comment-editor";
import { RichBody } from "@/components/rich/rich-body";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SelectField } from "@/components/ui/select-field";
import { relativeTime } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/user-error";

// icons: forum add_comment history grid_on zoom_out_map check close arrow_upward more_vert upload sync flip delete replay edit chat_bubble
export type Side = "front" | "back";
export interface SideView { side: Side; src: string | null; isGif: boolean; width: number; height: number; /** The requested size the safe bands are measured in, when it differs from the file. */ specW?: number; specH?: number }
export interface CommentView { id: string; version: number; body: string; created_at: string; edited_at?: string | null; pin_x: number | null; pin_y: number | null; pin_side: Side; addressed_at: string | null; confirmed_at: string | null; mine?: boolean; draft?: boolean; author: { name: string; initials: string; avatar?: string | null; role: string } }
export interface Member { id: string; name: string; handle: string; avatar?: string | null; kind?: "person" | "group" }
export interface VersionChip { id: string; number: number; decision: string; sent?: boolean; canManage: boolean; hasBack: boolean; purged?: boolean }
export interface StatusView { state: BadgeState; version: number | null; uploader: string | null; uploadedAt: string | null; assigneeId?: string | null; canAssign?: boolean }


/**
 * The asset page body. Left: a plain toolbar (versions · upload · ⋯ | comment · guides) over the artwork, front and
 * back stacked; Enlarge appears on hover. Right: a status card (state, version, uploader, open comments; approvers
 * get their decision here on desktop) and the comment thread. Comment mode: click the design, a bubble drops, a
 * small composer opens under it.
 */
export function AssetStage({ versionId, sides, safe, print, comments, members, canComment, canModerate = false, versions, currentVersionId, eventId, slotId, upload, status, decision, decisionBar, readOnly, mockup }: {
  versionId: string | null; sides: SideView[]; safe: SafeArea; print: PrintGuides | null;
  comments: CommentView[]; members: Member[]; canComment: boolean; canModerate?: boolean;
  versions: VersionChip[]; currentVersionId: string | null; eventId: string; slotId: string;
  /** The format's in-place mock (phone, Instagram, Sambandh, TV, LED), shown with the "In place" toggle. */
  mockup?: { size: string; formatKey: string; frame: Format["frame"]; event: { title: string; date: string | null } };
  upload: { accept: string[]; isPrint: boolean; nextNumber: number } | null; status: StatusView; decision: React.ReactNode; decisionBar?: React.ReactNode; readOnly: boolean;
}) {
  const [showGuides, setShowGuides] = useState(false);
  const [open, setOpen] = useState<Side | null>(null);
  const [draft, setDraft] = useState<{ side: Side; x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState(""); const [draftEmpty, setDraftEmpty] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [text, setText] = useState(""); const [textEmpty, setTextEmpty] = useState(true);
  const [pending, start] = useTransition();
  const router = useRouter();
  // Review mode: comments are saved privately and go out together as one message when the reviewer sends them.
  // It survives a refresh or a visit elsewhere because unsent comments live in the database.
  const currentNo = versions.find((v) => v.id === currentVersionId)?.number ?? null;
  const unsent = comments.filter((c) => c.draft && c.version === currentNo).length;
  const [review, setReview] = useState(unsent > 0);
  const [sending, setSending] = useState(false);
  const mode = review ? "place" : "view";
  // Design ↔ In place: the same mock the event page tiles use, at full size, as soon as a design exists.
  const front = sides.find((x) => x.side === "front")?.src ?? null;
  const canMock = !!mockup && !!front && hasMock(mockup.size, mockup.formatKey, mockup.frame);
  const [inPlace, setInPlace] = useState(false);
  const showMock = canMock && inPlace && !review;

  // Resolved comments stay: hidden by default, one tap away. Pins are drawn for the version on screen only.
  const [showResolved, setShowResolved] = useState(false);
  const isDone = (c: CommentView) => !!c.addressed_at || !!c.confirmed_at;
  const currentNumber = versions.find((v) => v.id === currentVersionId)?.number ?? null;
  const shown = useMemo(() => comments.filter((c) => showResolved || !isDone(c)), [comments, showResolved]);
  // Pinned comments are numbered per version (1, 2, 3 on v7; 1, 2 on v8), matching the markers on that version.
  const pinNo = useMemo(() => { const per = new Map<number, number>(); return new Map(shown.filter((c) => c.pin_x != null && c.pin_y != null).map((c) => { const n = (per.get(c.version) ?? 0) + 1; per.set(c.version, n); return [c.id, n] as const; })); }, [shown]);
  const numbered = useMemo(() => new Map([...pinNo].filter(([id]) => shown.find((c) => c.id === id)?.version === currentNumber)), [pinNo, shown, currentNumber]);
  const pinsFor = (side: Side): Pin[] => shown.filter((c) => numbered.has(c.id) && c.pin_side === side).map((c) => ({ id: c.id, n: numbered.get(c.id)!, x: c.pin_x!, y: c.pin_y! }));
  const openCount = comments.filter((c) => !isDone(c) && !c.draft).length;
  const resolvedCount = comments.filter(isDone).length;
  // Marker ↔ comment: picking one brings the other into view. `from` says which side was tapped.
  const [from, setFrom] = useState<"pin" | "list">("list");
  useEffect(() => {
    if (!active) return;
    document.getElementById(from === "pin" ? `comment-${active}` : `pin-${active}`)?.scrollIntoView({ block: from === "pin" ? "center" : "nearest", behavior: "smooth" });
  }, [active, from]);
  // Arriving from a comment on another version (?c=…): highlight its marker once the page is here.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c"); if (!c) return;
    const t = setTimeout(() => { setFrom("list"); setActive(c); }, 0); return () => clearTimeout(t);
  }, [currentVersionId]);
  const pickPin = (id: string) => { setFrom("pin"); setActive(active === id ? null : id); };
  const pickComment = (c: CommentView) => {
    if (!pinNo.has(c.id)) return;
    if (c.version !== currentNumber) { router.push(`/events/${eventId}/slots/${slotId}?v=${c.version}&c=${c.id}`); return; }
    setFrom("list"); setActive(active === c.id ? null : c.id);
  };

  const stop = () => { setDraft(null); setDraftText(""); setDraftEmpty(true); };
  const post = (body: string, pin: { side: Side; x: number; y: number } | null) => start(async () => {
    try { await addComment(versionId!, body, pin, { draft: review }); setText(""); setTextEmpty(true); stop(); if (!review) toast.success(pin ? "Comment pinned" : "Comment posted"); router.refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
  });
  const sendReview = () => start(async () => {
    setSending(true);
    try { const r = await sendCommentBatch(versionId!); setReview(false); stop(); toast.success(r.count === 1 ? "Comment sent" : `${r.count} comments sent`); router.refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setSending(false); }
  });
  const leaveReview = () => start(async () => {
    if (unsent > 0 && !confirm(`Discard ${unsent === 1 ? "your unsent comment" : `your ${unsent} unsent comments`}?`)) return;
    try { if (unsent > 0) await discardCommentBatch(versionId!); setReview(false); stop(); router.refresh(); }
    catch (e) { toast.error(errorMessage(e)); }
  });
  const reassign = (userId: string) => start(async () => { try { await assignSlot(slotId, userId || null); toast.success(userId ? "Designer changed" : "Unassigned"); router.refresh(); } catch (e) { toast.error(errorMessage(e)); } });
  const flag = (id: string, f: "addressed" | "unaddress" | "reopen") => start(async () => {
    try { await setCommentFlag(id, f); router.refresh(); if (f === "addressed") toast.success("Marked as done", { action: { label: "Undo", onClick: () => flag(id, "unaddress") }, duration: 8000 }); }
    catch (e) { toast.error(errorMessage(e)); }
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeVersion = (v: VersionChip) => start(async () => {
    try { await deleteVersion(v.id); setConfirmDelete(false); toast.success(`Version ${v.number} deleted`); router.replace(`/events/${eventId}/slots/${slotId}`); router.refresh(); } catch (e) { toast.error(errorMessage(e)); }
  });

  const hasGuides = sides.some((s) => { const g = guideGeometry(safe, print, s.specW || s.width, s.specH || s.height); return g.cut || g.safe.top + g.safe.right + g.safe.bottom + g.safe.left > 0; });
  const current = versions.find((v) => v.id === currentVersionId) ?? null;
  const byNumber = [...versions].sort((a, b) => a.number - b.number);
  const shownVersions = byNumber.filter((v, i) => i >= byNumber.length - 2 || v.id === currentVersionId);
  const earlierVersions = byNumber.filter((v) => !shownVersions.includes(v));
  const manage = !readOnly && !!current?.canManage && !!upload;
  // What Upload may ask (see UploadPanel): can the newest version be changed in place, and is it already in review?
  const newest = byNumber[byNumber.length - 1] ?? null;
  const newestTalked = !!newest && comments.some((c) => c.version === newest.number && !c.draft);
  const latest = manage && newest ? { number: newest.number, canEdit: newest.canManage && newest.decision === "pending" && !newestTalked, sent: !!newest.sent } : null;
  const commentsOn = (n: number) => comments.filter((c) => c.version === n && !c.draft).length;
  const canAddBack = manage && !!upload?.isPrint && !!current && current.id === newest?.id && !current.hasBack && !!front && !readOnly;
  const pill = "rounded-full";
  const iconPill = "rounded-full max-sm:size-10 max-sm:px-0";

  return (
    // The whole page takes a dropped file as a new version (no outline until a file is dragged over it).
    <UploadDropArea enabled={!!upload && !readOnly} split={!!upload?.isPrint} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {/* Toolbar: what changes the file on the left, how everyone looks at it on the right */}
        <div className="mb-4 flex items-center gap-2">
          {versions.length > 1 && (
            <div className="flex items-center gap-1" role="tablist" aria-label="Versions">
              {shownVersions.map((v, idx) => {
                const pillEl = (
                  <Button key={v.id} asChild variant="outline" role="tab" aria-selected={currentVersionId === v.id} title={v.purged ? `v${v.number}: comments only, files removed` : undefined} className={cn(pill, "px-3.5", v.purged && currentVersionId !== v.id && "border-dashed text-muted-foreground", currentVersionId === v.id && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")}>
                    <Link href={`/events/${eventId}/slots/${slotId}?v=${v.number}`}>v{v.number}{commentsOn(v.number) > 0 && currentVersionId !== v.id && <span className="text-xs font-normal opacity-60">{commentsOn(v.number)}</span>}{v.decision === "approved" && <Icon name="check" className="!text-[16px]" />}</Link>
                  </Button>
                );
                // Only the two newest versions are pills. The older of the two has the earlier ones peeking out from behind it.
                return idx === 0 && earlierVersions.length > 0
                  ? <VersionStack key={v.id} earlier={earlierVersions} eventId={eventId} slotId={slotId} commentCount={(n) => comments.filter((c) => c.version === n && !c.draft).length}>{pillEl}</VersionStack>
                  : pillEl;
              })}
            </div>
          )}
          {upload && !readOnly && <UploadPanel slotId={slotId} accept={upload.accept} isPrint={upload.isPrint} nextNumber={upload.nextNumber} latest={latest} variant="pill" label="Upload" compactOnPhone className={iconPill} title="Upload a file, or drop one anywhere on this page" />}
          <div className="ml-auto flex items-center gap-2">
            {canMock && !review && <Tip label={inPlace ? "Back to the design" : "See it in place"}><Button variant="outline" size="icon" onClick={() => setInPlace((v) => !v)} aria-pressed={inPlace} aria-label={inPlace ? "Back to the design" : "See it in place"} className={cn("rounded-full", inPlace && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")}><Icon name="devices" /></Button></Tip>}
            {canComment && versionId && !review && <Tip label="Comment on the design"><Button variant="outline" size="icon" onClick={() => { setInPlace(false); setReview(true); }} className="rounded-full" aria-label="Start a review: comment on the design"><Icon name="add_comment" /></Button></Tip>}
            {hasGuides && !showMock && <Tip label={showGuides ? "Hide guides" : "Show guides"}><Button variant="outline" size="icon" onClick={() => setShowGuides((v) => !v)} aria-pressed={showGuides} className={cn("rounded-full", showGuides && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")} aria-label="Toggle guides"><Icon name="grid_on" /></Button></Tip>}
          </div>
        </div>

        {showMock && front && mockup && <MockStage src={front} size={mockup.size} formatKey={mockup.formatKey} frame={mockup.frame} event={mockup.event} />}
        <div className={cn("flex flex-col items-center gap-8", showMock && "hidden")}>
          {sides.map((s) => {
            const g = guideGeometry(safe, print, s.specW || s.width, s.specH || s.height);
            const pins = pinsFor(s.side);
            return (
              <figure key={s.side} className="group max-w-full">
                {s.src ? (
                  <div className="relative inline-block max-w-full">
                    <img src={s.src} alt="" className={cn("block max-h-[75dvh] max-w-full rounded-md shadow-md", mode === "place" ? "cursor-crosshair" : "cursor-zoom-in")} style={{ aspectRatio: s.width && s.height ? `${s.width} / ${s.height}` : undefined }}
                      onClick={(e) => { if (mode !== "place") { setOpen(s.side); return; } const r = e.currentTarget.getBoundingClientRect(); setDraft({ side: s.side, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); }} />
                    {s.isGif && <DraftMark width={s.width} height={s.height} />}
                    {showGuides && <Guides cut={g.cut} safe={g.safe} />}
                    {pins.map((p) => <PinBubble key={p.id} id={`pin-${p.id}`} n={p.n} x={p.x} y={p.y} active={active === p.id} dimmed={!!active && active !== p.id && numbered.has(active)} onClick={() => pickPin(p.id)} />)}
                    {draft?.side === s.side && <PinBubble n={numbered.size + 1} x={draft.x} y={draft.y} draft />}
                    {draft?.side === s.side && (
                      <div className={cn("absolute z-10 w-[min(340px,calc(100vw-2rem))] rounded-2xl bg-card p-2 shadow-xl ring-1 ring-border", draft.y > 0.7 ? "-translate-y-[calc(100%+26px)]" : "translate-y-[26px]")} style={{ left: `clamp(0px, ${draft.x * 100}% - 24px, calc(100% - min(340px, calc(100vw - 2rem))))`, top: `${draft.y * 100}%` }} onClick={(e) => e.stopPropagation()}>
                        <CommentEditor value={draftText} onChange={(h, empty) => { setDraftText(h); setDraftEmpty(empty); }} onSubmit={() => { if (!draftEmpty && !pending) post(draftText, draft); }} placeholder="Describe the change · @ to mention" members={members} autoFocus compact className="border-0 focus-within:ring-0" />
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={stop} aria-label="Cancel this comment"><Icon name="close" className="!text-[18px]" /></Button>
                          <Button type="button" size="icon-sm" disabled={draftEmpty || pending} onClick={() => post(draftText, draft)} aria-label={review ? "Add to review" : "Post comment"}><Icon name="check" className="!text-[18px]" /></Button>
                        </div>
                      </div>
                    )}
                    {mode === "view" && (
                      <div className="absolute bottom-2.5 right-2.5 flex gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-70">
                        {manage && upload?.isPrint && current?.id === newest?.id && <button type="button" onClick={() => requestUpload({ side: s.side })} aria-label={`Replace the ${s.side}`} title={`Replace the ${s.side}`} className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white"><Icon name="upload" className="!text-[18px]" /></button>}
                        <button type="button" onClick={() => setOpen(s.side)} aria-label="Enlarge" className="flex size-9 items-center justify-center rounded-full bg-black/55 text-white"><Icon name="zoom_out_map" className="!text-[18px]" /></button>
                      </div>
                    )}
                  </div>
                ) : <div className="flex aspect-[4/5] w-64 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">No design yet</div>}
                {s.side === "front" && canAddBack && !sides.some((x) => x.side === "back") && !review && (
                  <button type="button" onClick={() => requestUpload({ side: "back" })} data-drop-side="back" className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-foreground/25 py-8 text-sm font-medium text-muted-foreground transition-colors hover:border-info hover:bg-info-soft/50 hover:text-info-text"><Icon name="flip" className="!text-[20px]" />Add the back side</button>
                )}
                {sides.length > 1 && <figcaption className="mt-2.5 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.side}</figcaption>}
              </figure>
            );
          })}
        </div>
        {open && <Lightbox open onClose={() => setOpen(null)} src={sides.find((s) => s.side === open)?.src ?? null} caption={open} isGif={sides.find((s) => s.side === open)?.isGif} size={sides.find((s) => s.side === open)} />}
      </div>

      <div className="flex flex-col gap-4">
        {/* Status: what everyone needs to know; approvers also decide here on desktop */}
        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <StateBadge state={status.state} />
            {status.version != null && <span className="text-sm font-medium">v{status.version}</span>}
          </div>
          {status.assigneeId !== undefined && (
            <div className="mt-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Designer</span>
              {status.canAssign && !readOnly ? (
                <SelectField value={status.assigneeId ?? ""} onChange={(e) => reassign(e.target.value)} disabled={pending} aria-label="Assigned designer" className="w-[60%] [&>select]:h-9 [&>select]:pl-3 [&>select]:text-right">
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </SelectField>
              ) : <span className="truncate text-right">{members.find((m) => m.id === status.assigneeId)?.name ?? "Unassigned"}</span>}
            </div>
          )}
          {status.uploader && <p className="mt-3 flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Uploaded by</span><span className="truncate text-right">{status.uploader}{status.uploadedAt ? <span className="text-muted-foreground"> · {relativeTime(status.uploadedAt)}</span> : null}</span></p>}
          {decision && <div className="mt-4 hidden md:block">{decision}</div>}
          {manage && current && <button type="button" onClick={() => setConfirmDelete(true)} className="mt-3 text-[13px] text-muted-foreground underline-offset-4 hover:text-destructive-text hover:underline">Delete v{current.number}</button>}
        </div>
        {manage && current && (
          <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <DialogContent className="max-w-sm rounded-2xl">
              <DialogHeader><DialogTitle>Delete v{current.number}?</DialogTitle><DialogDescription>Its files are removed for good{commentsOn(current.number) > 0 ? `, along with ${commentsOn(current.number)} comment${commentsOn(current.number) === 1 ? "" : "s"} on it` : ""}. Use this for a wrong file. To fix a file, just upload again.</DialogDescription></DialogHeader>
              <div className="flex flex-col gap-2">
                <Button size="lg" variant="destructive" disabled={pending} onClick={() => removeVersion(current)}>{pending ? "Deleting…" : `Delete v${current.number}`}</Button>
                <Button size="lg" variant="outline" onClick={() => setConfirmDelete(false)}>Keep it</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="flex max-h-[min(78dvh,880px)] flex-col rounded-2xl border border-border">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm">
            <p className="font-medium">Comments{openCount > 0 && <span className="font-normal text-muted-foreground"> · {openCount} open</span>}</p>
            {resolvedCount > 0 && <button type="button" onClick={() => setShowResolved((v) => !v)} aria-pressed={showResolved} className="text-[13px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">{showResolved ? "Hide resolved" : `Show ${resolvedCount} resolved`}</button>}
          </div>
          <ul className="flex-1 overflow-y-auto px-2 py-2">
            {comments.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No comments yet. Use Comment to pin one on the design, or write below.</li>}
            {comments.length > 0 && shown.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">Everything here is resolved. <button type="button" onClick={() => setShowResolved(true)} className="font-medium text-foreground underline-offset-4 hover:underline">Show the {resolvedCount} resolved comment{resolvedCount === 1 ? "" : "s"}</button> to read the discussion.</li>}
            {shown.map((c, i) => {
              const done = isDone(c); const pin = pinNo.get(c.id); const here = c.version === currentNumber;
              const newVersion = i === 0 || shown[i - 1].version !== c.version;
              return (
                <Fragment key={c.id}>
                {newVersion && versions.length > 1 && (
                  <li className={cn("flex items-center gap-3 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground", i > 0 && "mt-3")} aria-label={`Comments on version ${c.version}`}>
                    <span className="h-px flex-1 bg-border" /><span>v{c.version}{c.version === currentNumber ? " · this version" : ""}</span><span className="h-px flex-1 bg-border" />
                  </li>
                )}
                <li id={`comment-${c.id}`} onClick={() => pickComment(c)} className={cn("group/c flex gap-3 rounded-xl px-2 py-2.5 transition-colors", pin != null && "cursor-pointer hover:bg-subtle", active === c.id && "bg-info-soft/60 ring-1 ring-info/25 hover:bg-info-soft/60", done && "opacity-60", c.draft && "-mx-2 -mt-px rounded-none border-y border-info/15 bg-info-soft/60 px-4")}>
                  <UserAvatar initials={c.author.initials} src={c.author.avatar} size={32} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start gap-2">
                      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm">
                        <span className="font-medium">{c.author.name}</span>
                        <span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}{c.edited_at ? " · edited" : ""}</span>
                        {c.draft && <span className="rounded-full bg-info px-2 py-px text-[11px] font-medium text-white">Not sent</span>}
                        {pin != null && (here
                          ? <span title="Marker on the design: tap to find it" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><PinChip n={pin} active={active === c.id} />{sides.length > 1 ? c.pin_side : null}</span>
                          : <span title={`Pinned on v${c.version}: tap to see it there`} className="inline-flex items-center gap-1 text-xs text-muted-foreground"><PinChip n={pin} muted />on v{c.version}<Icon name="arrow_outward" className="!text-[13px]" /></span>)}
                      </p>
                      {canComment && editing?.id !== c.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger aria-label="Comment options" className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 group-hover/c:opacity-100"><Icon name="more_vert" className="!text-[18px]" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                            {c.draft ? null : done ? <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => flag(c.id, "reopen")}><Icon name="replay" />Reopen</DropdownMenuItem> : <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => flag(c.id, "addressed")}><Icon name="check" />Mark as done</DropdownMenuItem>}
                            {(c.mine || canModerate) && <>
                              <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => setEditing({ id: c.id, text: c.body })}><Icon name="edit" />Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm text-destructive-text" onSelect={() => start(async () => { if (!confirm("Delete this comment?")) return; try { await deleteComment(c.id); toast.success("Comment deleted"); router.refresh(); } catch (err) { toast.error(errorMessage(err)); } })}><Icon name="delete" />Delete</DropdownMenuItem>
                            </>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {editing?.id === c.id ? (
                      <div className="space-y-2">
                        <CommentEditor value={editing.text} onChange={(h) => setEditing({ id: c.id, text: h })} members={members} autoFocus compact />
                        <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" disabled={pending} onClick={() => start(async () => { try { await editComment(c.id, editing.text); setEditing(null); toast.success("Saved"); router.refresh(); } catch (e) { toast.error(errorMessage(e)); } })}>Save</Button></div>
                      </div>
                    ) : <RichBody body={c.body} />}
                    {!done && !c.draft && canComment && <button className="text-[13px] font-medium text-info hover:underline" onClick={(e) => { e.stopPropagation(); flag(c.id, "addressed"); }} disabled={pending}>Mark as done</button>}
                    {done && <span className="flex items-center gap-1 text-[13px] text-success-text"><Icon name="check" className="!text-[16px]" />Resolved{c.confirmed_at ? " · confirmed" : ""}</span>}
                  </div>
                </li>
                {(i === shown.length - 1 || shown[i + 1].version !== c.version) && !c.draft && versions.some((v) => v.number > c.version) && (
                  <li className="px-2 pb-1 pt-0.5"><Link href={`/events/${eventId}/slots/${slotId}?v=${Math.min(...versions.filter((v) => v.number > c.version).map((v) => v.number))}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Icon name="subdirectory_arrow_right" className="!text-[14px]" />Updated in v{Math.min(...versions.filter((v) => v.number > c.version).map((v) => v.number))}</Link></li>
                )}
                </Fragment>
              );
            })}
          </ul>
          {canComment && versionId && (
            <div className="relative border-t border-border p-3">
              <div className="flex items-end gap-2">
                <CommentEditor value={text} onChange={(h, empty) => { setText(h); setTextEmpty(empty); }} onSubmit={() => { if (!textEmpty && !pending) post(text, null); }} placeholder={review ? "Add a general note to your review… @ to mention" : "Write a comment… @ to mention"} members={members} className="min-w-0 flex-1" />
                <Button size="icon" disabled={pending || textEmpty} onClick={() => post(text, null)} aria-label={review ? "Add to review" : "Post"}><Icon name="arrow_upward" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Review mode bar: blue like the comment pins, so it reads as a mode you are in until you send. */}
      {review && canComment && versionId && (
        <div role="region" aria-label="Review mode" className={cn("fixed z-40 inset-x-3 flex items-center gap-2 rounded-full bg-info p-1.5 pl-4 text-white shadow-md md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:gap-3 md:pl-5", decisionBar ? "bottom-[calc(env(safe-area-inset-bottom)+84px)] md:bottom-6" : "bottom-[max(env(safe-area-inset-bottom),16px)] md:bottom-6")}>
          <Icon name="forum" className="shrink-0 !text-[20px]" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium md:flex-none">
            {unsent === 0 ? "Tap to comment" : `${unsent} comment${unsent === 1 ? "" : "s"}`}
          </p>
          <button type="button" onClick={leaveReview} disabled={pending} className="h-10 shrink-0 rounded-full px-3.5 text-sm font-medium text-white/90 hover:bg-white/15 disabled:opacity-60">{unsent > 0 ? "Discard" : "Cancel"}</button>
          <button type="button" onClick={sendReview} disabled={pending || unsent === 0} className="inline-flex h-10 shrink-0 items-center rounded-full bg-white px-5 text-sm font-semibold text-info-text shadow-sm transition-opacity hover:bg-white/90 disabled:opacity-50">{sending ? "Sending…" : unsent > 1 ? `Send ${unsent}` : "Send"}</button>
        </div>
      )}
      {/* Phones: the decision rides in a fixed bar */}
      {decisionBar && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden [&>div]:justify-end">{decisionBar}</div>}
    </UploadDropArea>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}

/**
 * The pill of the older of the two newest versions, with the earlier versions drawn as cards peeking out from behind
 * it. Hover (mouse) or tap (touch) opens a short read-only list of them: their files are gone, only comments remain.
 */
function VersionStack({ earlier, eventId, slotId, commentCount, children }: { earlier: VersionChip[]; eventId: string; slotId: string; commentCount: (n: number) => number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverable = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;
  const show = () => { if (timer.current) clearTimeout(timer.current); if (hoverable()) setOpen(true); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 140); };
  const layers = Math.min(2, earlier.length);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative flex items-center gap-1 md:block" style={{ marginLeft: undefined }} onMouseEnter={show} onMouseLeave={hide}>
        {/* Desktop: a history chip peeks out from behind the pill (a fainter one behind it when there are two or more), hover opens the list.
            Phones: a small round history-icon button before the pill (a 14px sliver is too small to tap). */}
        {layers >= 2 && <span aria-hidden className="absolute inset-y-0 left-0 right-6 rounded-full border border-border bg-card opacity-60 max-md:hidden" />}
        <PopoverTrigger asChild>
          <button type="button" aria-label={`${earlier.length} earlier version${earlier.length === 1 ? "" : "s"}`} className="inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-md:size-8 max-md:border max-md:border-border max-md:bg-card md:absolute md:inset-y-0 md:left-2 md:right-3 md:z-[1] md:justify-start md:border md:border-border md:bg-card md:pl-2 md:focus-visible:ring-0 md:data-[state=open]:bg-subtle">
            <Icon name="history" className="!text-[18px]" />
          </button>
        </PopoverTrigger>
        <div className="relative z-[2] md:ml-9">{children}</div>
      </div>
      <PopoverContent align="start" className="w-72 rounded-xl p-2" onMouseEnter={show} onMouseLeave={hide}>
        <p className="px-2 pb-1 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Earlier versions</p>
        <ul>
          {[...earlier].reverse().map((v) => {
            const n = commentCount(v.number);
            const label = <span className="whitespace-nowrap"><span className="font-medium">v{v.number}</span><span className="text-muted-foreground">{v.purged ? " · files removed" : ""} · {n} comment{n === 1 ? "" : "s"}</span></span>;
            return <li key={v.id}>{v.purged ? <p className="px-2 py-1.5 text-sm">{label}</p> : <Link href={`/events/${eventId}/slots/${slotId}?v=${v.number}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-subtle" onClick={() => setOpen(false)}>{label}</Link>}</li>;
          })}
        </ul>
        <p className="px-2 pt-1.5 text-[13px] text-muted-foreground">Only the two newest versions keep their files. Their comments stay in the thread.</p>
      </PopoverContent>
    </Popover>
  );
}
