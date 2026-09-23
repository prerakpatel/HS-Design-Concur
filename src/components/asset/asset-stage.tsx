"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";
import { StateBadge, type BadgeState } from "@/components/state-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Lightbox } from "@/components/asset/lightbox";
import { UploadPanel, requestUpload } from "@/components/asset/upload-panel";
import { Guides, PinBubble, DraftMark, guideGeometry, type SafeArea, type Pin, type PrintGuides } from "@/components/asset/viewer";
import { addComment, setCommentFlag, editComment, deleteComment, deleteVersion } from "@/app/actions/reviews";
import { relativeTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

// icons: add_comment grid_on zoom_out_map check close arrow_upward more_horiz upload sync flip delete replay edit chat_bubble
export type Side = "front" | "back";
export interface SideView { side: Side; src: string | null; isGif: boolean; width: number; height: number }
export interface CommentView { id: string; body: string; created_at: string; edited_at?: string | null; pin_x: number | null; pin_y: number | null; pin_side: Side; addressed_at: string | null; confirmed_at: string | null; mine?: boolean; author: { name: string; initials: string; avatar?: string | null; role: string } }
export interface Member { id: string; name: string; handle: string; avatar?: string | null }
export interface VersionChip { id: string; number: number; decision: string; canManage: boolean; hasBack: boolean }
export interface StatusView { state: BadgeState; version: number | null; uploader: string | null; uploadedAt: string | null }

/** Enter = new line. ⌘/Ctrl+Enter posts, everywhere a comment is written. */
const postKey = (e: React.KeyboardEvent) => e.key === "Enter" && (e.metaKey || e.ctrlKey);

/**
 * The asset page body. Left: a plain toolbar (versions · upload · ⋯ | comment · guides) over the artwork, front and
 * back stacked; Enlarge appears on hover. Right: a status card (state, version, uploader, open comments; approvers
 * get their decision here on desktop) and the comment thread. Comment mode: click the design, a bubble drops, a
 * small composer opens under it.
 */
export function AssetStage({ versionId, sides, safe, print, comments, members, canComment, canModerate = false, versions, currentVersionId, eventId, slotId, upload, status, decision, decisionBar, readOnly }: {
  versionId: string | null; sides: SideView[]; safe: SafeArea; print: PrintGuides | null;
  comments: CommentView[]; members: Member[]; canComment: boolean; canModerate?: boolean;
  versions: VersionChip[]; currentVersionId: string | null; eventId: string; slotId: string;
  upload: { accept: string[]; isPrint: boolean; nextNumber: number } | null; status: StatusView; decision: React.ReactNode; decisionBar?: React.ReactNode; readOnly: boolean;
}) {
  const [showGuides, setShowGuides] = useState(false);
  const [open, setOpen] = useState<Side | null>(null);
  const [mode, setMode] = useState<"view" | "place">("view");
  const [draft, setDraft] = useState<{ side: Side; x: number; y: number } | null>(null);
  const [draftText, setDraftText] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null);
  const draftInput = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const numbered = useMemo(() => { let n = 0; return new Map(comments.filter((c) => c.pin_x != null && c.pin_y != null).map((c) => [c.id, ++n])); }, [comments]);
  const pinsFor = (side: Side): Pin[] => comments.filter((c) => c.pin_x != null && c.pin_y != null && c.pin_side === side).map((c) => ({ id: c.id, n: numbered.get(c.id)!, x: c.pin_x!, y: c.pin_y! }));
  const openCount = comments.filter((c) => !c.addressed_at && !c.confirmed_at).length;
  const suggestions = mentionQuery == null ? [] : members.filter((m) => m.name.toLowerCase().includes(mentionQuery) || m.handle.includes(mentionQuery)).slice(0, 5);
  useEffect(() => { if (draft) draftInput.current?.focus(); }, [draft]);
  useEffect(() => { if (active) document.getElementById(`comment-${active}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [active]);

  const stop = () => { setMode("view"); setDraft(null); setDraftText(""); };
  const post = (body: string, pin: { side: Side; x: number; y: number } | null) => start(async () => {
    try { await addComment(versionId!, body, pin); setText(""); stop(); toast.success(pin ? "Comment pinned" : "Comment posted"); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
  });
  const flag = (id: string, f: "addressed" | "unaddress" | "reopen") => start(async () => {
    try { await setCommentFlag(id, f); router.refresh(); if (f === "addressed") toast.success("Marked as done", { action: { label: "Undo", onClick: () => flag(id, "unaddress") }, duration: 8000 }); }
    catch (e) { toast.error((e as Error).message); }
  });
  const removeVersion = (v: VersionChip) => start(async () => {
    if (!confirm(`Delete v${v.number}? Its files are removed for good.`)) return;
    try { await deleteVersion(v.id); toast.success(`Version ${v.number} deleted`); router.replace(`/events/${eventId}/slots/${slotId}`); router.refresh(); } catch (e) { toast.error((e as Error).message); }
  });
  function onChange(v: string) { setText(v); const m = v.slice(0, ta.current?.selectionStart ?? v.length).match(/@([\w.-]*)$/); setMentionQuery(m ? m[1].toLowerCase() : null); }
  function pick(m: Member) { const pos = ta.current?.selectionStart ?? text.length; setText(text.slice(0, pos).replace(/@([\w.-]*)$/, `@${m.name} `) + text.slice(pos)); setMentionQuery(null); ta.current?.focus(); }

  const hasGuides = sides.some((s) => { const g = guideGeometry(safe, print, s.width, s.height); return g.cut || g.safe.top + g.safe.right + g.safe.bottom + g.safe.left > 0; });
  const current = versions.find((v) => v.id === currentVersionId) ?? null;
  const manage = !readOnly && !!current?.canManage && !!upload;
  const pill = "rounded-full";
  const iconPill = "rounded-full max-sm:size-10 max-sm:px-0";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        {/* Toolbar: what changes the file on the left, how everyone looks at it on the right */}
        <div className="mb-4 flex items-center gap-2">
          {versions.length > 1 && (
            <div className="flex items-center gap-1" role="tablist" aria-label="Versions">
              {[...versions].sort((a, b) => a.number - b.number).map((v) => (
                <Button key={v.id} asChild variant="outline" role="tab" aria-selected={currentVersionId === v.id} className={cn(pill, "px-3.5", currentVersionId === v.id && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")}>
                  <Link href={`/events/${eventId}/slots/${slotId}?v=${v.number}`}>v{v.number}{v.decision === "approved" && <Icon name="check" className="!text-[16px]" />}</Link>
                </Button>
              ))}
            </div>
          )}
          {upload && !readOnly && <UploadPanel slotId={slotId} accept={upload.accept} isPrint={upload.isPrint} nextNumber={upload.nextNumber} variant="pill" label="Upload" compactOnPhone className={iconPill} />}
          {manage && current && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label={`More for v${current.number}`}><Icon name="more_horiz" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
                <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => requestUpload({ side: "front", replaceVersionId: current.id })}><Icon name="sync" />Replace v{current.number}</DropdownMenuItem>
                {upload?.isPrint && !current.hasBack && <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => requestUpload({ side: "back", replaceVersionId: null })}><Icon name="flip" />Add back side</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm text-destructive-text" disabled={pending} onSelect={() => removeVersion(current)}><Icon name="delete" />Delete v{current.number}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="ml-auto flex items-center gap-2">
            {mode === "place" ? (
              <div className="flex h-10 items-center gap-2 rounded-full bg-foreground pl-4 pr-1 text-sm font-medium text-background"><span className="truncate">{draft ? "Describe the change" : "Click where the change is needed"}</span><button type="button" onClick={stop} aria-label="Cancel" className="flex size-8 items-center justify-center rounded-full hover:bg-background/15"><Icon name="close" className="!text-[18px]" /></button></div>
            ) : (
              <>
                {canComment && versionId && <Button variant="outline" onClick={() => setMode("place")} className={iconPill} aria-label="Comment on the design"><Icon name="add_comment" /><span className="max-sm:hidden">Comment</span></Button>}
                {hasGuides && <Button variant="outline" onClick={() => setShowGuides((v) => !v)} aria-pressed={showGuides} className={cn(iconPill, showGuides && "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background")} aria-label="Toggle guides"><Icon name="grid_on" /><span className="max-sm:hidden">Guides</span></Button>}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-8">
          {sides.map((s) => {
            const g = guideGeometry(safe, print, s.width, s.height);
            const pins = pinsFor(s.side);
            return (
              <figure key={s.side} className="group max-w-full">
                {s.src ? (
                  <div className="relative inline-block max-w-full">
                    <img src={s.src} alt="" className={cn("block max-h-[75dvh] max-w-full rounded-md shadow-md", mode === "place" ? "cursor-crosshair" : "cursor-zoom-in")} style={{ aspectRatio: s.width && s.height ? `${s.width} / ${s.height}` : undefined }}
                      onClick={(e) => { if (mode !== "place") { setOpen(s.side); return; } const r = e.currentTarget.getBoundingClientRect(); setDraft({ side: s.side, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); }} />
                    {s.isGif && <DraftMark width={s.width} height={s.height} />}
                    {showGuides && <Guides cut={g.cut} safe={g.safe} />}
                    {pins.map((p) => <PinBubble key={p.id} n={p.n} x={p.x} y={p.y} active={active === p.id} onClick={() => setActive(active === p.id ? null : p.id)} />)}
                    {draft?.side === s.side && <PinBubble n={numbered.size + 1} x={draft.x} y={draft.y} draft />}
                    {draft?.side === s.side && (
                      <div className={cn("absolute z-10 w-[min(340px,calc(100vw-2rem))] rounded-2xl bg-card p-2 shadow-xl ring-1 ring-border", draft.y > 0.7 ? "-translate-y-[calc(100%+26px)]" : "translate-y-[26px]")} style={{ left: `clamp(0px, ${draft.x * 100}% - 24px, calc(100% - min(340px, calc(100vw - 2rem))))`, top: `${draft.y * 100}%` }} onClick={(e) => e.stopPropagation()}>
                        <Textarea ref={draftInput} rows={2} value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Describe the change" className="min-h-0 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
                          onKeyDown={(e) => { if (postKey(e) && draftText.trim() && !pending) { e.preventDefault(); post(draftText.trim(), draft); } if (e.key === "Escape") stop(); }} />
                        <div className="flex justify-end gap-1">
                          <Button type="button" variant="ghost" size="icon-sm" onClick={stop} aria-label="Cancel"><Icon name="close" className="!text-[18px]" /></Button>
                          <Button type="button" size="icon-sm" disabled={!draftText.trim() || pending} onClick={() => post(draftText.trim(), draft)} aria-label="Post comment"><Icon name="check" className="!text-[18px]" /></Button>
                        </div>
                      </div>
                    )}
                    {mode === "view" && <button type="button" onClick={() => setOpen(s.side)} aria-label="Enlarge" className="absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-70"><Icon name="zoom_out_map" className="!text-[18px]" /></button>}
                  </div>
                ) : <div className="flex aspect-[4/5] w-64 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">No design yet</div>}
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
          {status.uploader && <p className="mt-3 flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Uploaded by</span><span className="truncate text-right">{status.uploader}{status.uploadedAt ? <span className="text-muted-foreground"> · {relativeTime(status.uploadedAt)}</span> : null}</span></p>}
          {decision && <div className="mt-4 hidden md:block">{decision}</div>}
        </div>

        <div className="flex max-h-[min(78dvh,880px)] flex-col rounded-2xl border border-border">
          <p className="flex items-baseline justify-between border-b border-border px-4 py-3 text-sm font-medium">Comments <span className="text-muted-foreground">· {comments.length}</span>{openCount > 0 && <span className="ml-auto text-xs font-normal text-muted-foreground">{openCount} open</span>}</p>
          <ul className="flex-1 overflow-y-auto px-2 py-2">
            {comments.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No comments yet. Use Comment to pin one on the design, or write below.</li>}
            {comments.map((c) => {
              const done = !!c.addressed_at || !!c.confirmed_at; const n = numbered.get(c.id);
              return (
                <li key={c.id} id={`comment-${c.id}`} onClick={() => n && setActive(c.id)} className={cn("group/c flex gap-3 rounded-xl px-2 py-2.5 transition-colors", active === c.id && "bg-subtle", done && "opacity-70")}>
                  <UserAvatar initials={c.author.initials} src={c.author.avatar} size={32} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start gap-2">
                      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-sm">
                        <span className="font-medium">{c.author.name}</span>
                        <span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}{c.edited_at ? " · edited" : ""}</span>
                        {n && <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Icon name="chat_bubble" className="!text-[13px]" />{n}{sides.length > 1 ? ` · ${c.pin_side}` : ""}</span>}
                      </p>
                      {canComment && editing?.id !== c.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger aria-label="Comment options" className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100 group-hover/c:opacity-100"><Icon name="more_horiz" className="!text-[18px]" /></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                            {done ? <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => flag(c.id, "reopen")}><Icon name="replay" />Reopen</DropdownMenuItem> : <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => flag(c.id, "addressed")}><Icon name="check" />Mark as done</DropdownMenuItem>}
                            {(c.mine || canModerate) && <>
                              <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => setEditing({ id: c.id, text: c.body })}><Icon name="edit" />Edit</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm text-destructive-text" onSelect={() => start(async () => { if (!confirm("Delete this comment?")) return; try { await deleteComment(c.id); toast.success("Comment deleted"); router.refresh(); } catch (err) { toast.error((err as Error).message); } })}><Icon name="delete" />Delete</DropdownMenuItem>
                            </>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    {editing?.id === c.id ? (
                      <div className="space-y-2">
                        <Textarea rows={3} value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} className="rounded-xl" autoFocus />
                        <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" disabled={pending || !editing.text.trim()} onClick={() => start(async () => { try { await editComment(c.id, editing.text); setEditing(null); toast.success("Saved"); router.refresh(); } catch (e) { toast.error((e as Error).message); } })}>Save</Button></div>
                      </div>
                    ) : <p className={cn("whitespace-pre-wrap text-sm leading-5", done && "line-through decoration-muted-foreground/60")}>{c.body}</p>}
                    {!done && canComment && <button className="text-[13px] font-medium text-info hover:underline" onClick={(e) => { e.stopPropagation(); flag(c.id, "addressed"); }} disabled={pending}>Mark as done</button>}
                    {done && <span className="flex items-center gap-1 text-[13px] text-success-text"><Icon name="check" className="!text-[16px]" />Done</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          {canComment && versionId && (
            <div className="relative border-t border-border p-3">
              {suggestions.length > 0 && (
                <ul className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  {suggestions.map((m) => <li key={m.id}><button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); pick(m); }}><UserAvatar initials={m.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} src={m.avatar} size={24} />{m.name}</button></li>)}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <Textarea ref={ta} rows={1} value={text} onChange={(e) => onChange(e.target.value)} placeholder="Write a comment… @ to mention" className="min-h-11 resize-none rounded-xl" onKeyDown={(e) => { if (postKey(e) && text.trim() && !pending) { e.preventDefault(); post(text, null); } }} />
                <Button size="icon" disabled={pending || !text.trim()} onClick={() => post(text, null)} aria-label="Post"><Icon name="arrow_upward" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Phones: the decision rides in a fixed bar */}
      {decisionBar && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden [&>div]:justify-end">{decisionBar}</div>}
    </div>
  );
}
