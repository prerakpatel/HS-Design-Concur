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
import { Viewer, type SafeArea, type Pin, type PrintGuides } from "@/components/asset/viewer";
import { Lightbox } from "@/components/asset/lightbox";
import { addComment, setCommentFlag } from "@/app/actions/reviews";
import { relativeTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

export type Side = "front" | "back";
export interface SideView { side: Side; src: string | null; isGif: boolean; width: number; height: number; guideColor: string }
export interface CommentView { id: string; body: string; created_at: string; pin_x: number | null; pin_y: number | null; pin_side: Side; addressed_at: string | null; confirmed_at: string | null; author: { name: string; initials: string; role: string } }
export interface Member { id: string; name: string; handle: string }

/**
 * Artwork (one side at a time, fits the viewport, click to enlarge) beside the comment thread.
 * Pins are numbered per side; "Mark addressed" can be undone from the toast or the thread (PRD §6.3).
 */
export function AssetWorkspace({ versionId, sides, safe, print, caption, comments, members, canApprove, canComment, guideHint }: {
  versionId: string | null; sides: SideView[]; safe: SafeArea; print: PrintGuides | null; caption: string;
  comments: CommentView[]; members: Member[]; canApprove: boolean; canComment: boolean; guideHint: string | null;
}) {
  const [sideKey, setSideKey] = useState<Side>("front");
  const side = sides.find((s) => s.side === sideKey) ?? sides[0];
  const [showGuides, setShowGuides] = useState(true);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Pin numbers are global across sides so the thread reads top to bottom; the viewer shows only the current side's.
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
  const post = () => start(async () => {
    try { await addComment(versionId!, text, pin ? { ...pin, side: side?.side ?? "front" } : null); setText(""); setPin(null); toast.success("Comment posted"); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
  });
  const hasSafe = safe.top + safe.right + safe.bottom + safe.left > 0;
  const hasGuides = hasSafe || !!print;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col items-center gap-3">
        {sides.length > 1 && (
          <div className="inline-flex rounded-full bg-muted p-1 text-sm font-medium">
            {sides.map((s) => <button key={s.side} type="button" onClick={() => { setSideKey(s.side); setPin(null); setPicking(false); }} className={cn("rounded-full px-4 py-1.5 capitalize", side?.side === s.side ? "bg-card shadow-sm" : "text-muted-foreground")}>{s.side}</button>)}
          </div>
        )}
        <div className="-mx-5 flex w-[calc(100%+2.5rem)] justify-center bg-canvas p-0 md:mx-0 md:w-full md:rounded-2xl md:p-5">
          {side && <Viewer src={side.src} isGif={side.isGif} width={side.width} height={side.height} safe={safe} print={print} showGuides={showGuides} guideColor={side.guideColor} caption={caption} pins={pins} picked={pin} onPick={picking ? (p) => { setPin(p); setPicking(false); } : undefined} onOpen={() => setOpen(true)} />}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {hasGuides && <label className="flex items-center gap-2 font-medium text-foreground"><Switch checked={showGuides} onCheckedChange={setShowGuides} />Guides</label>}
          {hasGuides && guideHint && <span>{guideHint}</span>}
          {side?.src && <span className="flex items-center gap-1"><Icon name="zoom_in" className="!text-[16px]" />Click the image to enlarge</span>}
        </div>
        {side && <Lightbox open={open} onClose={() => setOpen(false)} src={side.src} caption={caption} isGif={side.isGif} />}
      </div>

      <div className="flex max-h-[min(80dvh,900px)] flex-col rounded-2xl border border-border">
        <div className="border-b border-border px-5 py-3 text-sm font-medium">Comments <span className="text-muted-foreground">· {comments.length}</span></div>
        <ul className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {comments.length === 0 && <li className="text-sm text-muted-foreground">No comments yet.</li>}
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              {numbered.has(c.id) ? <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-info text-[11px] font-semibold text-white ring-2 ring-white">{numbered.get(c.id)}</span> : <UserAvatar initials={c.author.initials} size={24} />}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="flex flex-wrap items-center gap-1.5 text-sm"><span className="font-medium">{c.author.name}</span><span className="text-xs text-muted-foreground">{c.author.role} · {relativeTime(c.created_at)}{numbered.has(c.id) && sides.length > 1 ? ` · ${c.pin_side}` : ""}</span></p>
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {c.confirmed_at ? <StateBadge state="approved" label="Confirmed" /> : c.addressed_at ? <StateBadge state="in_review" label="Addressed" /> : null}
                  {!c.addressed_at && !c.confirmed_at && canComment && <button className="font-medium text-info hover:underline" onClick={() => flag(c.id, "addressed")} disabled={pending}>Mark as addressed</button>}
                  {c.addressed_at && !c.confirmed_at && canComment && <button className="font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => flag(c.id, "unaddress")} disabled={pending}>Undo</button>}
                  {c.addressed_at && !c.confirmed_at && canApprove && <button className="font-medium text-info hover:underline" onClick={() => flag(c.id, "confirmed")} disabled={pending}>Confirm fixed</button>}
                  {c.confirmed_at && canApprove && <button className="font-medium text-muted-foreground hover:text-foreground hover:underline" onClick={() => flag(c.id, "reopen")} disabled={pending}>Reopen</button>}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {canComment && versionId && (
          <div className="relative border-t border-border p-4">
            {suggestions.length > 0 && (
              <ul className="absolute bottom-full left-4 right-4 mb-1 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                {suggestions.map((m) => <li key={m.id}><button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted" onMouseDown={(e) => { e.preventDefault(); pick(m); }}><UserAvatar initials={m.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()} size={24} />{m.name}</button></li>)}
              </ul>
            )}
            <Textarea ref={ta} rows={3} value={text} onChange={(e) => onChange(e.target.value)} placeholder="Comment… type @ to mention someone" className="resize-none rounded-xl" />
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", picking || pin ? "bg-info-soft text-info-text" : "text-info hover:bg-info-soft")} onClick={() => { if (pin) setPin(null); else setPicking((p) => !p); }}><Icon name="add_location_alt" className="!text-[16px]" />{pin ? "Pinned · remove" : picking ? "Click the image…" : "Pin to image"}</button>
              <Button size="sm" disabled={pending || !text.trim()} onClick={post}>Post</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
