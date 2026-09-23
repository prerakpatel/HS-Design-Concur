"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { Lightbox } from "@/components/asset/lightbox";
import { Guides, PinBubble, guideGeometry, type SafeArea, type Pin, type PrintGuides } from "@/components/asset/viewer";
import { addComment, setCommentFlag, editComment, deleteComment } from "@/app/actions/reviews";
import { relativeTime } from "@/lib/labels";
import { cn } from "@/lib/utils";

// icons: add_comment grid_on zoom_out_map check close arrow_upward
export type Side = "front" | "back";
export interface SideView { side: Side; src: string | null; isGif: boolean; width: number; height: number; guideColor: string }
export interface CommentView { id: string; body: string; created_at: string; edited_at?: string | null; pin_x: number | null; pin_y: number | null; pin_side: Side; addressed_at: string | null; confirmed_at: string | null; mine?: boolean; author: { name: string; initials: string; role: string } }
export interface Member { id: string; name: string; handle: string }

/**
 * The design on a dark stage with one floating tool pill (Comment · Guides · Front/Back · Enlarge), and the comment
 * thread beside it. Comment mode: click the artwork, a numbered bubble drops and a small input opens next to it.
 */
export function AssetStage({ versionId, sides, safe, print, caption, comments, members, canApprove, canComment, canModerate = false }: {
  versionId: string | null; sides: SideView[]; safe: SafeArea; print: PrintGuides | null; caption: string;
  comments: CommentView[]; members: Member[]; canApprove: boolean; canComment: boolean; canModerate?: boolean;
}) {
  const [sideKey, setSideKey] = useState<Side>("front");
  const side = sides.find((s) => s.side === sideKey) ?? sides[0];
  const [showGuides, setShowGuides] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "place">("view");
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
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
  const pins: Pin[] = comments.filter((c) => c.pin_x != null && c.pin_y != null && c.pin_side === (side?.side ?? "front")).map((c) => ({ id: c.id, n: numbered.get(c.id)!, x: c.pin_x!, y: c.pin_y! }));
  const g = side ? guideGeometry(safe, print, side.width, side.height) : null;
  const hasGuides = !!g && (g.bands.top + g.bands.right + g.bands.bottom + g.bands.left > 0 || g.rects.length > 0);
  const suggestions = mentionQuery == null ? [] : members.filter((m) => m.name.toLowerCase().includes(mentionQuery) || m.handle.includes(mentionQuery)).slice(0, 5);
  useEffect(() => { if (draft) draftInput.current?.focus(); }, [draft]);
  useEffect(() => { if (!active) return; document.getElementById(`comment-${active}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [active]);

  const stop = () => { setMode("view"); setDraft(null); setDraftText(""); };
  const post = (body: string, pin: { x: number; y: number } | null) => start(async () => {
    try { await addComment(versionId!, body, pin ? { ...pin, side: side?.side ?? "front" } : null); setText(""); stop(); toast.success(pin ? "Comment pinned" : "Comment posted"); router.refresh(); }
    catch (e) { toast.error((e as Error).message); }
  });
  const flag = (id: string, f: "addressed" | "unaddress" | "confirmed" | "reopen") => start(async () => {
    try {
      await setCommentFlag(id, f); router.refresh();
      if (f === "addressed") toast.success("Marked as addressed", { action: { label: "Undo", onClick: () => flag(id, "unaddress") }, duration: 8000 });
      else if (f === "confirmed") toast.success("Confirmed");
    } catch (e) { toast.error((e as Error).message); }
  });
  function onChange(v: string) { setText(v); const m = v.slice(0, ta.current?.selectionStart ?? v.length).match(/@([\w.-]*)$/); setMentionQuery(m ? m[1].toLowerCase() : null); }
  function pick(m: Member) { const pos = ta.current?.selectionStart ?? text.length; setText(text.slice(0, pos).replace(/@([\w.-]*)$/, `@${m.name} `) + text.slice(pos)); setMentionQuery(null); ta.current?.focus(); }

  const tool = (label: string, icon: string, on: boolean, onClick: () => void, extra?: string) => (
    <button type="button" onClick={onClick} className={cn("flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors", on ? "bg-white text-black" : "text-white/90 hover:bg-white/15", extra)}><Icon name={icon} className="!text-[18px]" />{label}</button>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      <div className="min-w-0">
        <div className="relative -mx-5 flex min-h-[320px] items-center justify-center bg-zinc-900 px-3 pb-3 pt-16 md:mx-0 md:rounded-2xl md:px-6 md:pb-6 md:pt-[72px]">
          {/* One floating tool pill */}
          <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/70 p-1 shadow-lg backdrop-blur md:top-4">
            {mode === "place" ? (
              <><span className="whitespace-nowrap px-3 text-[13px] font-medium text-white">{draft ? "Describe the change" : <><span className="md:hidden">Tap where the change goes</span><span className="hidden md:inline">Click the design where the change is needed</span></>}</span><button type="button" onClick={stop} aria-label="Cancel" className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/15"><Icon name="close" className="!text-[18px]" /></button></>
            ) : (
              <>
                {canComment && versionId && side?.src && tool("Comment", "add_comment", false, () => setMode("place"))}
                {hasGuides && side?.src && tool("Guides", "grid_on", showGuides, () => setShowGuides((v) => !v))}
                {sides.length > 1 && <div className="mx-0.5 flex rounded-full bg-white/10 p-0.5">{sides.map((s) => <button key={s.side} type="button" onClick={() => { setSideKey(s.side); stop(); }} className={cn("h-8 rounded-full px-3 text-[13px] font-medium capitalize", side?.side === s.side ? "bg-white text-black" : "text-white/80")}>{s.side}</button>)}</div>}
                {side?.src && tool("Enlarge", "zoom_out_map", false, () => setOpen(true))}
              </>
            )}
          </div>

          {side?.src ? (
            <div className="relative inline-block max-w-full">
              <img src={side.src} alt="" className={cn("block max-h-[62dvh] max-w-full rounded-lg object-contain md:max-h-[max(360px,calc(100dvh-300px))]", mode === "place" ? "cursor-crosshair" : "cursor-zoom-in")} style={{ aspectRatio: side.width && side.height ? `${side.width} / ${side.height}` : undefined }}
                onClick={(e) => { if (mode === "place") { const r = e.currentTarget.getBoundingClientRect(); setDraft({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }); } else setOpen(true); }} />
              {side.isGif && <div className="pointer-events-none absolute inset-0 rounded-lg" style={{ backgroundImage: "url(/watermark-tile.png)", backgroundSize: "40%" }} />}
              {showGuides && g && hasGuides && <Guides bands={g.bands} rects={g.rects} color={side.guideColor} />}
              {pins.map((p) => <PinBubble key={p.id} n={p.n} x={p.x} y={p.y} active={active === p.id} onClick={() => setActive(active === p.id ? null : p.id)} />)}
              {draft && <PinBubble n={numbered.size + 1} x={draft.x} y={draft.y} draft />}
              {draft && (
                <div className={cn("absolute z-10 flex h-12 w-[min(320px,80vw)] items-center gap-1 rounded-full bg-zinc-800 pl-4 pr-1.5 shadow-2xl ring-1 ring-white/15", draft.y > 0.85 ? "-translate-y-[calc(100%+14px)]" : "translate-y-4")} style={{ left: `min(max(${draft.x * 100}% - 20px, 8px), calc(100% - min(320px, 80vw) - 8px))`, top: `${draft.y * 100}%` }}>
                  <input ref={draftInput} value={draftText} onChange={(e) => setDraftText(e.target.value)} placeholder="Describe the change" className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter" && draftText.trim() && !pending) post(draftText.trim(), draft); if (e.key === "Escape") stop(); }} />
                  <button type="button" disabled={!draftText.trim() || pending} onClick={() => post(draftText.trim(), draft)} aria-label="Post" className={cn("flex size-9 items-center justify-center rounded-full", draftText.trim() ? "bg-white text-black" : "text-white/30")}><Icon name="check" className="!text-[18px]" /></button>
                  <button type="button" onClick={stop} aria-label="Cancel" className="flex size-9 items-center justify-center rounded-full text-white/70 hover:bg-white/15"><Icon name="close" className="!text-[18px]" /></button>
                </div>
              )}
              <span className="pointer-events-none absolute bottom-2.5 left-2.5 max-w-[60%] truncate rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white"><span className="md:hidden">{caption.split(" · ").slice(0, 2).join(" · ")}</span><span className="hidden md:inline">{caption}</span></span>
            </div>
          ) : <p className="text-sm text-white/60">No design uploaded yet</p>}
        </div>
        {side && <Lightbox open={open} onClose={() => setOpen(false)} src={side.src} caption={caption} isGif={side.isGif} />}
      </div>

      <div className="flex max-h-[min(78dvh,880px)] flex-col rounded-2xl border border-border">
        <p className="border-b border-border px-4 py-3 text-sm font-medium">Comments <span className="text-muted-foreground">· {comments.length}</span></p>
        <ul className="flex-1 space-y-4 overflow-y-auto px-2 py-2">
          {comments.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">No comments yet. Use Comment on the design to pin one, or write below.</li>}
          {comments.map((c) => (
            <li key={c.id} id={`comment-${c.id}`} onClick={() => numbered.has(c.id) && setActive(c.id)} className={cn("flex gap-3 rounded-xl px-2 py-2 transition-colors", active === c.id && "bg-info-soft/60")}>
              {numbered.has(c.id) ? <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-info text-xs font-semibold text-white ring-2 ring-white shadow-sm">{numbered.get(c.id)}</span> : <UserAvatar initials={c.author.initials} size={28} />}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm"><span className="font-medium">{c.author.name}</span><span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}{numbered.has(c.id) && sides.length > 1 ? ` · ${c.pin_side}` : ""}{c.edited_at ? " · edited" : ""}</span></p>
                {editing?.id === c.id ? (
                  <div className="space-y-2">
                    <Textarea rows={3} value={editing.text} onChange={(e) => setEditing({ id: c.id, text: e.target.value })} className="rounded-xl" autoFocus />
                    <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" disabled={pending || !editing.text.trim()} onClick={() => start(async () => { try { await editComment(c.id, editing.text); setEditing(null); toast.success("Saved"); router.refresh(); } catch (e) { toast.error((e as Error).message); } })}>Save</Button></div>
                  </div>
                ) : <p className="whitespace-pre-wrap text-sm leading-5">{c.body}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-[13px]">
                  {c.confirmed_at ? <StateBadge state="approved" label="Confirmed" /> : c.addressed_at ? <StateBadge state="in_review" label="Addressed" /> : null}
                  {!c.addressed_at && !c.confirmed_at && canComment && <button className="font-medium text-info hover:underline" onClick={(e) => { e.stopPropagation(); flag(c.id, "addressed"); }} disabled={pending}>Mark as addressed</button>}
                  {c.addressed_at && !c.confirmed_at && canComment && <button className="text-muted-foreground hover:text-foreground hover:underline" onClick={(e) => { e.stopPropagation(); flag(c.id, "unaddress"); }} disabled={pending}>Undo</button>}
                  {c.addressed_at && !c.confirmed_at && canApprove && <button className="font-medium text-info hover:underline" onClick={(e) => { e.stopPropagation(); flag(c.id, "confirmed"); }} disabled={pending}>Confirm fixed</button>}
                  {c.confirmed_at && canApprove && <button className="text-muted-foreground hover:text-foreground hover:underline" onClick={(e) => { e.stopPropagation(); flag(c.id, "reopen"); }} disabled={pending}>Reopen</button>}
                  {(c.mine || canModerate) && canComment && editing?.id !== c.id && <>
                    <button className="text-muted-foreground hover:text-foreground hover:underline" onClick={(e) => { e.stopPropagation(); setEditing({ id: c.id, text: c.body }); }} disabled={pending}>Edit</button>
                    <button className="text-muted-foreground hover:text-destructive-text hover:underline" disabled={pending} onClick={(e) => { e.stopPropagation(); start(async () => { if (!confirm("Delete this comment?")) return; try { await deleteComment(c.id); toast.success("Comment deleted"); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>Delete</button>
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
            <div className="flex items-end gap-2">
              <Textarea ref={ta} rows={1} value={text} onChange={(e) => onChange(e.target.value)} placeholder="Write a comment… @ to mention" className="min-h-11 resize-none rounded-xl" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.trim() && !pending) { e.preventDefault(); post(text, null); } }} />
              <Button size="icon" disabled={pending || !text.trim()} onClick={() => post(text, null)} aria-label="Post"><Icon name="arrow_upward" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
