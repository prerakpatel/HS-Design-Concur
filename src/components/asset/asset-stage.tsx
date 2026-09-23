"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { Icon } from "@/components/material-icon";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Lightbox } from "@/components/asset/lightbox";
import { UploadPanel, requestUpload } from "@/components/asset/upload-panel";
import { Guides, PinBubble, guideGeometry, type SafeArea, type Pin, type PrintGuides } from "@/components/asset/viewer";
import { addComment, setCommentFlag, editComment, deleteComment, deleteVersion } from "@/app/actions/reviews";
import { relativeTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

// icons: add_comment grid_on zoom_out_map check close arrow_upward more_horiz upload sync flip delete done_all replay edit
export type Side = "front" | "back";
export interface SideView { side: Side; src: string | null; isGif: boolean; width: number; height: number }
export interface CommentView { id: string; body: string; created_at: string; edited_at?: string | null; pin_x: number | null; pin_y: number | null; pin_side: Side; addressed_at: string | null; confirmed_at: string | null; mine?: boolean; author: { name: string; initials: string; role: string } }
export interface Member { id: string; name: string; handle: string }
export interface VersionChip { id: string; number: number; decision: string; canManage: boolean; hasBack: boolean }

/**
 * The asset page body. Left: the artwork (front and back stacked) on a quiet canvas with two corner clusters:
 * version + upload (designers) top-left, comment + guides top-right; Enlarge appears on hover. Right: the
 * decision (approvers) and the comment thread. Comment mode: click the artwork, a bubble drops, an input opens.
 */
export function AssetStage({ versionId, sides, safe, print, comments, members, canComment, canModerate = false, versions, currentVersionId, eventId, slotId, upload, decision, readOnly }: {
  versionId: string | null; sides: SideView[]; safe: SafeArea; print: PrintGuides | null;
  comments: CommentView[]; members: Member[]; canComment: boolean; canModerate?: boolean;
  versions: VersionChip[]; currentVersionId: string | null; eventId: string; slotId: string;
  upload: { accept: string[]; isPrint: boolean; nextNumber: number } | null; decision: React.ReactNode; readOnly: boolean;
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
  const draftInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const numbered = useMemo(() => { let n = 0; return new Map(comments.filter((c) => c.pin_x != null && c.pin_y != null).map((c) => [c.id, ++n])); }, [comments]);
  const pinsFor = (side: Side): Pin[] => comments.filter((c) => c.pin_x != null && c.pin_y != null && c.pin_side === side).map((c) => ({ id: c.id, n: numbered.get(c.id)!, x: c.pin_x!, y: c.pin_y! }));
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
  const showVersions = versions.length > 1 || versions.some((v) => v.canManage);
  const chip = "flex h-9 items-center gap-1.5 rounded-full bg-card/90 px-3 text-[13px] font-medium shadow-sm ring-1 ring-border backdrop-blur transition-colors hover:bg-card";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="relative rounded-2xl bg-canvas px-4 pb-4 pt-16 md:px-8 md:pb-8">
          {/* Corner clusters: who-can-change on the left, everyone's tools on the right */}
          <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5 md:left-4 md:top-4">
            {showVersions && !readOnly && [...versions].sort((a, b) => a.number - b.number).map((v) => (
              <div key={v.id} className={cn(chip, "gap-0 px-0", currentVersionId === v.id ? "ring-foreground/60" : "text-muted-foreground")}>
                <Link href={`/events/${eventId}/slots/${slotId}?v=${v.number}`} className="py-1.5 pl-3 pr-2">v{v.number}{v.decision === "approved" ? " ✓" : ""}</Link>
                {v.canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger aria-label={`Version ${v.number} options`} className="mr-1 flex size-7 items-center justify-center rounded-full hover:bg-muted"><Icon name="more_horiz" className="!text-[16px]" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
                      <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => requestUpload({ side: "front", replaceVersionId: v.id })}><Icon name="sync" />Replace v{v.number}</DropdownMenuItem>
                      {upload?.isPrint && !v.hasBack && <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm" onSelect={() => requestUpload({ side: "back", replaceVersionId: null })}><Icon name="flip" />Add back side</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="h-10 rounded-lg px-3 text-sm text-destructive-text" disabled={pending} onSelect={() => removeVersion(v)}><Icon name="delete" />Delete v{v.number}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            {upload && !readOnly && <UploadPanel slotId={slotId} accept={upload.accept} isPrint={upload.isPrint} nextNumber={upload.nextNumber} label="Upload" compactOnPhone />}
          </div>
          <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 md:right-4 md:top-4">
            {mode === "place" ? (
              <div className={cn(chip, "pr-1")}><span>{draft ? "Describe the change" : "Click the design where the change is needed"}</span><button type="button" onClick={stop} aria-label="Cancel" className="ml-1 flex size-7 items-center justify-center rounded-full hover:bg-muted"><Icon name="close" className="!text-[16px]" /></button></div>
            ) : (
              <>
                {canComment && versionId && <button type="button" onClick={() => setMode("place")} className={chip}><Icon name="add_comment" className="!text-[18px]" />Comment</button>}
                {hasGuides && <button type="button" onClick={() => setShowGuides((v) => !v)} aria-pressed={showGuides} className={cn(chip, showGuides && "bg-foreground text-background ring-foreground hover:bg-foreground")}><Icon name="grid_on" className="!text-[18px]" />Guides</button>}
              </>
            )}
          </div>

          <div className="flex flex-col items-center gap-6">
            {sides.map((s) => {
              const g = guideGeometry(safe, print, s.width, s.height);
              const pins = pinsFor(s.side);
              return (
                <figure key={s.side} className="group relative inline-block max-w-full">
                  {s.src ? (
                    <>
                      <img src={s.src} alt="" className={cn("block max-h-[70dvh] max-w-full rounded-lg shadow-md", mode === "place" ? "cursor-crosshair" : "")} style={{ aspectRatio: s.width && s.height ? `${s.width} / ${s.height}` : undefined }}
                        onClick={(e) => { if (mode !== "place") return; const r = e.currentTarget.getBoundingClientRect(); setDraft({ side: s.side, x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); }} />
                      {s.isGif && <div className="pointer-events-none absolute inset-0 rounded-lg" style={{ backgroundImage: "url(/watermark-tile.png)", backgroundSize: "40%" }} />}
                      {showGuides && <Guides cut={g.cut} safe={g.safe} />}
                      {pins.map((p) => <PinBubble key={p.id} n={p.n} x={p.x} y={p.y} active={active === p.id} onClick={() => setActive(active === p.id ? null : p.id)} />)}
                      {draft?.side === s.side && <PinBubble n={numbered.size + 1} x={draft.x} y={draft.y} draft />}
                      {draft?.side === s.side && (
                        <div className={cn("absolute z-10 flex h-11 w-[min(320px,78vw)] items-center gap-1 rounded-full bg-card pl-4 pr-1 shadow-xl ring-1 ring-border", draft.y > 0.85 ? "-translate-y-[calc(100%+14px)]" : "translate-y-4")} style={{ left: `min(max(${draft.x * 100}% - 20px, 4px), calc(100% - min(320px, 78vw) - 4px))`, top: `${draft.y * 100}%` }}>
                          <input ref={draftInput} value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Describe the change" className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter" && draftText.trim() && !pending) post(draftText.trim(), draft); if (e.key === "Escape") stop(); }} />
                          <button type="button" disabled={!draftText.trim() || pending} onClick={() => post(draftText.trim(), draft)} aria-label="Post" className={cn("flex size-8 items-center justify-center rounded-full", draftText.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground/50")}><Icon name="check" className="!text-[18px]" /></button>
                          <button type="button" onClick={stop} aria-label="Cancel" className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"><Icon name="close" className="!text-[18px]" /></button>
                        </div>
                      )}
                      {mode === "view" && <button type="button" onClick={() => setOpen(s.side)} aria-label="Enlarge" className="absolute bottom-2.5 right-2.5 flex size-9 items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-70"><Icon name="zoom_out_map" className="!text-[18px]" /></button>}
                    </>
                  ) : <div className="flex aspect-[4/5] w-64 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">No design yet</div>}
                  {sides.length > 1 && <figcaption className="mt-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.side}</figcaption>}
                </figure>
              );
            })}
          </div>
        </div>
        {open && <Lightbox open onClose={() => setOpen(null)} src={sides.find((s) => s.side === open)?.src ?? null} caption={open} isGif={sides.find((s) => s.side === open)?.isGif} />}
      </div>

      <div className="flex flex-col gap-4">
        {decision && <div className="hidden rounded-2xl border border-border p-4 md:block"><p className="mb-3 text-sm font-medium">Decision</p>{decision}</div>}
        <div className="flex max-h-[min(78dvh,880px)] flex-col rounded-2xl border border-border">
          <p className="border-b border-border px-4 py-3 text-sm font-medium">Comments <span className="text-muted-foreground">· {comments.length}</span></p>
          <ul className="flex-1 overflow-y-auto px-2 py-2">
            {comments.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No comments yet. Use Comment on the design to pin one, or write below.</li>}
            {comments.map((c) => {
              const done = !!c.addressed_at || !!c.confirmed_at; const n = numbered.get(c.id);
              return (
                <li key={c.id} id={`comment-${c.id}`} onClick={() => n && setActive(c.id)} className={cn("group/c flex gap-3 rounded-xl px-2 py-2.5 transition-colors", active === c.id && "bg-info-soft/60", done && "opacity-70")}>
                  <span className="relative mt-0.5 shrink-0">
                    <UserAvatar initials={c.author.initials} size={32} />
                    {n && <span className="absolute -bottom-1 -right-1 flex size-4.5 items-center justify-center rounded-full bg-info text-[10px] font-semibold text-white ring-2 ring-card">{n}</span>}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start gap-2">
                      <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-sm"><span className="font-medium">{c.author.name}</span><span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}{n && sides.length > 1 ? ` · ${c.pin_side}` : ""}{c.edited_at ? " · edited" : ""}</span></p>
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
                  {suggestions.map((m) => <li key={m.id}><button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); pick(m); }}><UserAvatar initials={m.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={24} />{m.name}</button></li>)}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <Textarea ref={ta} rows={1} value={text} onChange={(e) => onChange(e.target.value)} placeholder="Write a comment… @ to mention" className="min-h-11 resize-none rounded-xl" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.trim() && !pending) { e.preventDefault(); post(text, null); } }} />
                <Button size="icon" disabled={pending || !text.trim()} onClick={() => post(text, null)} aria-label="Post"><Icon name="arrow_upward" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Phones: approvers get their decision in a fixed bar */}
      {decision && <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur md:hidden [&>div]:justify-end">{decision}</div>}
    </div>
  );
}
