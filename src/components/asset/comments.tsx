"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { Viewer, type SafeArea, type Pin } from "@/components/asset/viewer";
import { addComment, setCommentFlag } from "@/app/actions/reviews";
import { relativeTime } from "@/lib/labels";

export interface CommentView { id: string; body: string; created_at: string; pin_x: number | null; pin_y: number | null; addressed_at: string | null; confirmed_at: string | null; author: { name: string; initials: string; role: string } }
export interface Member { id: string; name: string; handle: string }

/** Viewer + threaded comments with @mentions, pins, addressed/confirmed flags (PRD §6.3). */
export function CommentsPanel({ versionId, viewer, comments, members, canApprove, canComment }: {
  versionId: string | null;
  viewer: { src: string | null; isGif: boolean; width: number; height: number; safe: SafeArea; caption: string; frame: "phone" | "card" | "flat" | "tv" | "led" | "print" };
  comments: CommentView[]; members: Member[]; canApprove: boolean; canComment: boolean;
}) {
  const [text, setText] = useState("");
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ta = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const pins: Pin[] = useMemo(() => { let n = 0; return comments.filter((c) => c.pin_x != null && c.pin_y != null).map((c) => ({ n: ++n, x: c.pin_x!, y: c.pin_y! })); }, [comments]);
  const pinNumber = new Map(comments.filter((c) => c.pin_x != null).map((c, i) => [c.id, i + 1]));
  const suggestions = mentionQuery == null ? [] : members.filter((m) => m.name.toLowerCase().includes(mentionQuery) || m.handle.includes(mentionQuery)).slice(0, 5);

  function onChange(v: string) {
    setText(v);
    const m = v.slice(0, ta.current?.selectionStart ?? v.length).match(/@([\w.-]*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  }
  function pick(m: Member) {
    const pos = ta.current?.selectionStart ?? text.length;
    const before = text.slice(0, pos).replace(/@([\w.-]*)$/, `@${m.name} `);
    setText(before + text.slice(pos)); setMentionQuery(null); ta.current?.focus();
  }
  const flag = (id: string, f: "addressed" | "confirmed" | "reopen") => start(async () => { try { await setCommentFlag(id, f); router.refresh(); } catch (e) { toast.error((e as Error).message); } });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="rounded-2xl bg-canvas p-4 md:p-6"><Viewer {...viewer} pins={pins} onPick={picking ? (p) => { setPin(p); setPicking(false); } : undefined} picked={pin} /></div>
      <div className="flex flex-col rounded-2xl border border-border">
        <div className="border-b border-border px-5 py-3 text-sm font-medium">Comments <span className="text-muted-foreground">· {comments.length}</span></div>
        <ul className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {comments.length === 0 && <li className="text-sm text-muted-foreground">No comments yet.</li>}
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <UserAvatar initials={c.author.initials} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="flex flex-wrap items-center gap-1.5 text-sm"><span className="font-medium">{c.author.name}</span><span className="text-xs text-muted-foreground">{c.author.role} · {relativeTime(c.created_at)}</span>{pinNumber.has(c.id) && <span className="flex size-4 items-center justify-center rounded-full bg-brand text-[10px] font-medium text-brand-foreground">{pinNumber.get(c.id)}</span>}</p>
                <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {c.confirmed_at ? <StateBadge state="approved" label="Confirmed" /> : c.addressed_at ? <StateBadge state="in_review" label="Addressed" /> : null}
                  {!c.addressed_at && !c.confirmed_at && canComment && <button className="font-medium text-muted-foreground hover:text-foreground" onClick={() => flag(c.id, "addressed")} disabled={pending}>Mark addressed</button>}
                  {c.addressed_at && !c.confirmed_at && canApprove && <><button className="font-medium text-info" onClick={() => flag(c.id, "confirmed")} disabled={pending}>Confirm</button><button className="font-medium text-muted-foreground" onClick={() => flag(c.id, "reopen")} disabled={pending}>Reopen</button></>}
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
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button type="button" className={"flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium " + (picking || pin ? "bg-brand-soft text-brand-foreground" : "text-muted-foreground hover:bg-muted")} onClick={() => { if (pin) setPin(null); else setPicking((p) => !p); }}><Icon name="add_location_alt" />{pin ? "Pinned · remove" : picking ? "Click the image…" : "Pin to image"}</button>
              </div>
              <Button size="sm" disabled={pending || !text.trim()} onClick={() => start(async () => { try { await addComment(versionId, text, pin); setText(""); setPin(null); router.refresh(); } catch (e) { toast.error((e as Error).message); } })}>Post</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
