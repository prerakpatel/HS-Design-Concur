"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { Viewer, secondColor, type SafeArea, type Pin, type PrintGuides } from "@/components/asset/viewer";
import { Lightbox } from "@/components/asset/lightbox";
import { PinComposer } from "@/components/asset/pin-composer";
import { addComment, setCommentFlag, editComment, deleteComment } from "@/app/actions/reviews";
import { relativeTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type Side = "front" | "back";
export interface SideView { side: Side; src: string | null; isGif: boolean; width: number; height: number; guideColor: string }
export interface CommentView { id: string; body: string; created_at: string; edited_at?: string | null; pin_x: number | null; pin_y: number | null; pin_side: Side; addressed_at: string | null; confirmed_at: string | null; mine?: boolean; author: { name: string; initials: string; role: string } }
export interface Member { id: string; name: string; handle: string }

/**
 * Canvas (one side at a time, fits the viewport, click to enlarge) beside a panel: `aside` (status, actions,
 * versions) on top, comments below. Pins are numbered per side; "Mark as addressed" can be undone.
 */
export function AssetWorkspace({ versionId, sides, safe, print, caption, comments, members, canApprove, canComment, canModerate = false, aside }: {
  versionId: string | null; sides: SideView[]; safe: SafeArea; print: PrintGuides | null; caption: string;
  comments: CommentView[]; members: Member[]; canApprove: boolean; canComment: boolean; canModerate?: boolean; aside?: React.ReactNode;
}) {
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [sideKey, setSideKey] = useState<Side>("front");
  const side = sides.find((s) => s.side === sideKey) ?? sides[0];
  const [showGuides, setShowGuides] = useState(true);
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const numbered = useMemo(() => { let n = 0; return new Map(comments.filter((c) => c.pin_x != null && c.pin_y != null).map((c) => [c.id, ++n])); }, [comments]);
  const pins: Pin[] = comments.filter((c) => c.pin_x != null && c.pin_y != null && c.pin_side === (side?.side ?? "front")).map((c) => ({ n: numbered.get(c.id)!, x: c.pin_x!, y: c.pin_y! }));
  const suggestions = mentionQuery == null ? [] : members.filter((m) => m.name.toLowerCase().includes(mentionQuery) || m.handle.includes(mentionQuery)).slice(0, 5);

  function onChange(v: string) {
    setText(v);
    const m = v.slice(0, ta.current?.selectionStart ?? v.length).match(/@([\w.-]*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  }
  function pick(m: Member) {
    const pos = ta.current?.selectionStart ?? text.length;
    setText(text.slice(0, pos).replace(/@([\w.-]*)$/, `@${m.name} `) + text.slice(pos)); setMentionQuery(null); ta.current?.focus();
  }
  const flag = (id: string, f: "addressed" | "unaddress" | "confirmed" | "reopen") => start(async () => {
    try {
      await setCommentFlag(id, f); router.refresh();
      if (f === "addressed") toast.success("Marked as addressed", { action: { label: "Undo", onClick: () => flag(id, "unaddress") }, duration: 8000 });
      else if (f === "unaddress") toast("Back to open");
      else if (f === "confirmed") toast.success("Confirmed");
      else toast("Comment reopened");
    } catch (e) { toast.error((e as Error).message); }
  });
  const post = (body: string, pin: { x: number; y: number } | null) => start(async () => {
    try { await addComment(versionId!, body, pin ? { ...pin, side: side?.side ?? "front" } : null); setText(""); setComposing(false); toast.success(pin ? "Pinned comment posted" : "Comment posted"); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
  });
  const hasGuides = safe.top + safe.right + safe.bottom + safe.left > 0 || !!print;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      <div className="flex min-w-0 flex-col items-center gap-2">
        <div className="-mx-5 flex w-[calc(100%+2.5rem)] justify-center bg-canvas p-0 md:mx-0 md:w-full md:rounded-2xl md:p-5">
          {side && <Viewer src={side.src} isGif={side.isGif} width={side.width} height={side.height} safe={safe} print={print} showGuides={showGuides} guideColor={side.guideColor} caption={caption} pins={pins} onOpen={() => setOpen(true)} />}
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
          <div className="flex items-center gap-3">
            {sides.length > 1 && (
              <div className="inline-flex rounded-full bg-muted p-1 text-sm font-medium">
                {sides.map((s) => <button key={s.side} type="button" onClick={() => setSideKey(s.side)} className={cn("rounded-full px-3.5 py-1 capitalize", side?.side === s.side ? "bg-card shadow-sm" : "text-muted-foreground")}>{s.side}</button>)}
              </div>
            )}
            {side?.src && <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><Icon name="zoom_in" className="!text-[16px]" />Enlarge</button>}
          </div>
          {hasGuides && side?.src && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {showGuides && (print ? (
                <><span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-5 rounded-sm" style={{ background: `repeating-linear-gradient(45deg, ${side.guideColor}B3 0 3px, ${side.guideColor}2E 3px 7px)` }} />Bleed, trimmed off</span><span className="flex items-center gap-1.5"><i className="inline-block h-0 w-5 border-t-2 border-dotted" style={{ borderColor: secondColor(side.guideColor) }} />Safe, keep text inside</span></>
              ) : (
                <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-5 rounded-sm" style={{ background: `repeating-linear-gradient(45deg, ${side.guideColor}B3 0 3px, ${side.guideColor}2E 3px 7px)` }} />Keep text, murti and logos out of the hatched bands</span>
              ))}
              <label className="flex items-center gap-2 font-medium text-foreground"><Switch checked={showGuides} onCheckedChange={setShowGuides} className="scale-90" />Guides</label>
            </div>
          )}
        </div>
        {side && <Lightbox open={open} onClose={() => setOpen(false)} src={side.src} caption={caption} isGif={side.isGif} />}
        {side && <PinComposer open={composing} onClose={() => setComposing(false)} onSubmit={(pin, body) => post(body, pin)} src={side.src} isGif={side.isGif} width={side.width} height={side.height} safe={safe} print={print} guideColor={side.guideColor} existing={pins} nextNumber={numbered.size + 1} pending={pending} />}
      </div>

      <div className="flex flex-col gap-4">
        {aside}
        <div className="flex max-h-[min(70dvh,820px)] flex-col rounded-2xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">Comments <span className="text-muted-foreground">· {comments.length}</span></p>
            {canComment && versionId && side?.src && <Button size="sm" variant="secondary" onClick={() => setComposing(true)}><Icon name="add_location_alt" className="!text-[16px]" />Pin a comment</Button>}
          </div>
          <ul className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {comments.length === 0 && <li className="text-sm text-muted-foreground">No comments yet. Pin one to the artwork or write below.</li>}
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                {numbered.has(c.id) ? <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-info text-xs font-semibold text-white ring-2 ring-white shadow-sm">{numbered.get(c.id)}</span> : <UserAvatar initials={c.author.initials} size={28} />}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm"><span className="font-medium">{c.author.name}</span><span className="text-xs text-muted-foreground">{c.author.role} · {relativeTime(c.created_at)}{numbered.has(c.id) && sides.length > 1 ? ` · ${c.pin_side}` : ""}</span></p>
                  {editing?.id === c.id ? (
                    <div className="space-y-2">
                      <Textarea rows={3} value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} className="rounded-xl" autoFocus />
                      <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" disabled={pending || !editing.text.trim()} onClick={() => start(async () => { try { await editComment(c.id, editing.text); setEditing(null); toast.success("Comment updated"); router.refresh(); } catch (e) { toast.error((e as Error).message); } })}>Save</Button></div>
                    </div>
                  ) : <p className="whitespace-pre-wrap text-sm">{c.body}{c.edited_at && <span className="ml-1.5 text-xs text-muted-foreground">(edited)</span>}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {c.confirmed_at ? <StateBadge state="approved" label="Confirmed" /> : c.addressed_at ? <StateBadge state="in_review" label="Addressed" /> : null}
                    {!c.addressed_at && !c.confirmed_at && canComment && <button className="font-medium text-info hover:underline" onClick={() => flag(c.id, "addressed")} disabled={pending}>Mark as addressed</button>}
                    {c.addressed_at && !c.confirmed_at && canComment && <button className="font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => flag(c.id, "unaddress")} disabled={pending}>Undo</button>}
                    {c.addressed_at && !c.confirmed_at && canApprove && <button className="font-medium text-info hover:underline" onClick={() => flag(c.id, "confirmed")} disabled={pending}>Confirm fixed</button>}
                    {c.confirmed_at && canApprove && <button className="font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => flag(c.id, "reopen")} disabled={pending}>Reopen</button>}
                    {(c.mine || canModerate) && canComment && editing?.id !== c.id && <>
                      <button className="font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => setEditing({ id: c.id, text: c.body })} disabled={pending}>Edit</button>
                      <button className="font-medium text-muted-foreground hover:text-destructive-text hover:underline" disabled={pending} onClick={() => start(async () => { if (!confirm("Delete this comment?")) return; try { await deleteComment(c.id); toast.success("Comment deleted"); router.refresh(); } catch (e) { toast.error((e as Error).message); } })}>Delete</button>
                    </>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {canComment && versionId && (
            <div className="relative border-t border-border p-3">
              {suggestions.length > 0 && (
                <ul className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  {suggestions.map((m) => <li key={m.id}><button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); pick(m); }}><UserAvatar initials={m.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={24} />{m.name}</button></li>)}
                </ul>
              )}
              <Textarea ref={ta} rows={2} value={text} onChange={(e) => onChange(e.target.value)} placeholder="Comment… type @ to mention someone" className="resize-none rounded-xl" />
              <div className="mt-2 flex justify-end"><Button size="sm" disabled={pending || !text.trim()} onClick={() => post(text, null)}>Post</Button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
