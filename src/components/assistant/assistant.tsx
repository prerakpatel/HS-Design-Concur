"use client";
// icons: mic, stop, send, keyboard, close, edit
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/user-error";
import { assistantTurn, assistantCreateProjects, assistantAddFormats, assistantComment } from "@/app/actions/assistant";
import type { CommentDraft, Outcome, Person, Turn, Where } from "@/lib/assistant/schema";
import { Buddy, PeekingBuddy, type BuddyArt, type Mood } from "@/components/assistant/buddy";
import { ASSISTANT_ART, ASSISTANT_FIGURE, ASSISTANT_PEEK } from "@/config/assistant";
import { useRecorder } from "@/components/assistant/use-recorder";
import { CardActions, CommentCard, DoneCard, OptionButtons, ProjectCard, Say } from "@/components/assistant/cards";

export interface AssistantProps {
  name: string;
  /** Which transcription service is set up; none means the browser listens on its own. */
  ears: "sarvam" | "gemini" | null;
  /** Format key → name, for the cards. */
  formats: { key: string; name: string }[];
  keyterms: string[];
  art?: BuddyArt;
}

type Entry = Turn | { role: "done"; title: string; links: { href: string; label: string }[] } | { role: "error"; text: string };

const whereOf = (path: string): Where => {
  const asset = path.match(/^\/events\/([^/]+)\/slots\/([^/]+)/);
  if (asset) return { page: "asset", eventId: asset[1], slotId: asset[2], path };
  const project = path.match(/^\/events\/([^/]+)$/);
  if (project) return { page: "project", eventId: project[1], slotId: null, path };
  return { page: path === "/events" || path === "/" ? "projects" : "other", eventId: null, slotId: null, path };
};

/**
 * The assistant: the character peeking from the screen's edge, and the thread that opens under it. Say or type
 * what you want; it answers with a card; you tap. Each thread is one task: Create, Send or Cancel ends it.
 */
export function Assistant(p: AssistantProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<Mood>("calm");
  const [editing, setEditing] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pressAt = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const rec = useRecorder(!!p.ears, p.keyterms);
  const formatNames = useMemo(() => new Map(p.formats.map((f) => [f.key, f.name])), [p.formats]);
  const where = useMemo(() => whereOf(pathname), [pathname]);
  const art: BuddyArt = p.art ?? ASSISTANT_ART;

  const last = entries[entries.length - 1];
  const lastOutcome = last?.role === "assistant" ? last.outcome : null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [entries, thinking, rec.state]);
  useEffect(() => { if (rec.state === "listening") setMood("listening"); else if (rec.state === "transcribing" || thinking) setMood("thinking"); else if (last?.role === "error" || lastOutcome?.kind === "unclear") setMood("puzzled"); else if (lastOutcome && (lastOutcome.kind === "question" || lastOutcome.projects.some((x) => x.gaps.length) || lastOutcome.comments.some((c) => c.unresolved.length))) setMood("needs-you"); else setMood("calm"); }, [rec.state, thinking, lastOutcome, last]);

  const reset = () => { setEntries([]); setPeople([]); setText(""); setEditing(null); setMood("calm"); };

  /** Send words to the brain: from the mic, the keyboard, or an edited earlier line (which replays from there). */
  const send = useCallback(async (words: string, replaceAt: number | null = null) => {
    const clean = words.trim(); if (!clean) return;
    const base = replaceAt == null ? entries : entries.slice(0, replaceAt);
    const next: Entry[] = [...base.filter((e) => e.role === "user" || e.role === "assistant"), { role: "user", text: clean }];
    setEntries(next); setText(""); setEditing(null); setThinking(true);
    try {
      const r = await assistantTurn(next.filter((e): e is Turn => e.role === "user" || e.role === "assistant"), where);
      setPeople(r.people);
      setEntries((cur) => [...cur, { role: "assistant", outcome: r.outcome, raw: r.raw }]);
    } catch (e) { setEntries((cur) => [...cur, { role: "error", text: errorMessage(e) }]); }
    finally { setThinking(false); }
  }, [entries, where]);

  const listen = useCallback(() => {
    if (!rec.supported) { toast.error("This browser can't listen. Type instead."); inputRef.current?.focus(); return; }
    rec.start((words) => { if (words.trim()) send(words); else setEntries((cur) => [...cur, { role: "error", text: "I didn't catch anything. Hold the mic and speak, or type it." }]); }, (msg) => setEntries((cur) => [...cur, { role: "error", text: msg }]));
  }, [rec, send]);

  const holdStart = () => { setOpen(true); listen(); };

  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } };
  const createProjects = (o: Outcome) => act(async () => {
    const r = await assistantCreateProjects(o.projects);
    for (const n of r.notes) toast.message(n);
    setMood("done");
    setEntries((cur) => [...cur, { role: "done", title: r.ids.length === 1 ? "Draft project created" : `${r.ids.length} draft projects created`, links: r.ids.map((id, i) => ({ href: `/events/${id}/edit/review`, label: `Open ${o.projects[i]?.title ?? "project"}` })) }]);
    router.push(`/events/${r.ids[0]}/edit/review`); router.refresh();
  });
  const addFormats = (o: Outcome) => act(async () => {
    const a = o.addFormats!; const r = await assistantAddFormats(a.eventId, a.formats);
    for (const s of r.skipped) toast.message(s);
    setMood("done");
    setEntries((cur) => [...cur, { role: "done", title: r.added.length ? `Added ${r.added.join(", ")}` : "Nothing new to add", links: [{ href: `/events/${a.eventId}`, label: `Open ${a.eventTitle}` }] }]);
    router.refresh();
  });
  const postComments = (c: CommentDraft) => act(async () => {
    const r = await assistantComment(c);
    if (r.note) toast.message(r.note);
    setMood("done");
    setEntries((cur) => [...cur, { role: "done", title: r.posted === 1 ? "Posted" : `Posted ${r.posted} ${c.change ? "change requests" : "comments"}`, links: [{ href: `/events/${c.eventId}/slots/${c.slotId}`, label: `Open ${c.slotName}` }] }]);
    router.refresh();
  });
  const updateComment = (i: number, next: CommentDraft) => setEntries((cur) => cur.map((e, j) => (j === i && e.role === "assistant" ? { ...e, outcome: { ...e.outcome, comments: e.outcome.comments.map((c) => (c.slotId === next.slotId ? next : c)) } } : e)));

  return (
    <>
      <PeekingBuddy mood={mood} level={rec.level} art={art} peek={ASSISTANT_PEEK} hidden={open} onTap={() => setOpen(true)} onHoldStart={holdStart} onHoldEnd={() => rec.stop()} />
      <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) { rec.cancel(); if (last?.role === "done") reset(); } }}>
        <DrawerContent className="max-h-[88dvh] data-[vaul-drawer-direction=bottom]:max-h-[88dvh] md:mx-auto md:max-w-xl md:rounded-t-3xl">
          <div className="flex items-center gap-3 px-5 pb-2 pt-1">
            <Buddy mood={mood} level={rec.level} size={48} art={art} className="buddy-pop" />
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-base">{p.name}</DrawerTitle>
              <DrawerDescription className="truncate">{rec.state === "listening" ? "Listening… release to send" : rec.state === "transcribing" ? "Working out the words…" : thinking ? "Thinking…" : entries.length ? "Say more to change the draft, or tap a button." : "Hold the mic and say what you need. Projects, formats, comments."}</DrawerDescription>
            </div>
            {entries.length > 0 && <Button variant="ghost" size="sm" onClick={reset} disabled={busy || thinking}>Start over</Button>}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-3">
            {entries.length === 0 && rec.state === "idle" && !thinking && (
              <div className="flex items-end gap-3 rounded-2xl bg-subtle p-4 text-sm text-muted-foreground">
                <div className="min-w-0 flex-1 space-y-2">
                  <p>Try:</p>
                  <p className="text-foreground">“New project for Sharad Purnima and Annakut with a print card 8.5 by 5.5, WhatsApp, Instagram, LED and website hero.”</p>
                  <p className="text-foreground">“Tell Chirantan the text is cut off at the sides and to check the spelling of mahaprasad.”</p>
                </div>
                <img src={ASSISTANT_FIGURE} alt="" className="buddy-pop h-36 w-auto shrink-0 select-none" draggable={false} aria-hidden />
              </div>
            )}
            {entries.map((e, i) => {
              if (e.role === "user") return (
                <div key={i} className="flex justify-end">
                  {editing === i ? (
                    <form className="w-full max-w-[90%]" onSubmit={(ev) => { ev.preventDefault(); const v = new FormData(ev.currentTarget).get("t"); send(String(v ?? ""), i); }}>
                      <input name="t" defaultValue={e.text} autoFocus className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-[15px]" />
                      <p className="mt-1 text-right text-xs text-muted-foreground">Enter to send it again · <button type="button" className="underline" onClick={() => setEditing(null)}>keep as is</button></p>
                    </form>
                  ) : (
                    <button type="button" title="Tap to fix what I heard" onClick={() => !busy && !thinking && setEditing(i)} className="group max-w-[90%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-left text-[15px] leading-6 text-brand-foreground">
                      {e.text}<Icon name="edit" className="ml-1.5 !text-[14px] opacity-60 group-hover:opacity-100" />
                    </button>
                  )}
                </div>
              );
              if (e.role === "error") return <div key={i} className="space-y-2"><Say tone="muted">{e.text}</Say><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={listen} disabled={busy || thinking}><Icon name="mic" className="!text-[16px]" />Try again</Button><Button size="sm" variant="ghost" onClick={() => inputRef.current?.focus()}><Icon name="keyboard" className="!text-[16px]" />Type it</Button></div></div>;
              if (e.role === "done") return <DoneCard key={i} title={e.title} links={e.links} />;
              const o = e.outcome; const current = i === entries.length - 1;
              return (
                <div key={i} className={cn("space-y-2", !current && "opacity-60")}>
                  <Say>{o.say}</Say>
                  {o.kind === "question" && o.question && <>{o.question.text !== o.say && <Say>{o.question.text}</Say>}{current && o.question.options.length > 0 && <OptionButtons options={o.question.options} onPick={(opt) => send(opt)} disabled={busy || thinking} />}</>}
                  {o.kind === "unclear" && current && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={listen} disabled={busy || thinking}><Icon name="mic" className="!text-[16px]" />Try again</Button><Button size="sm" variant="ghost" onClick={() => inputRef.current?.focus()}><Icon name="keyboard" className="!text-[16px]" />Type it</Button></div>}
                  {o.kind === "unsupported" && o.link && current && <Button asChild variant="secondary" size="sm"><a href={o.link.href}>{o.link.label}</a></Button>}
                  {o.projects.map((pr, j) => <ProjectCard key={j} p={pr} formatNames={formatNames} />)}
                  {o.addFormats && (
                    <div className="space-y-1 rounded-2xl border border-border bg-card p-4 text-sm">
                      <p className="font-medium">Add to {o.addFormats.eventTitle}</p>
                      <ul className="space-y-1">{o.addFormats.formats.map((f, j) => <li key={j}>{formatNames.get(f.formatKey) ?? f.formatKey}{f.label ? ` · ${f.label}` : ""}{f.size ? ` · ${f.size.w} × ${f.size.h}` : ""}</li>)}</ul>
                    </div>
                  )}
                  {o.comments.map((c, j) => <CommentCard key={j} c={c} people={people} onChange={(next) => updateComment(i, next)} />)}
                  {current && o.kind === "draft" && o.projects.length > 0 && <CardActions primary={o.projects.length === 1 ? "Create draft project" : `Create ${o.projects.length} draft projects`} onPrimary={() => createProjects(o)} pending={busy} onCancel={reset} alt={{ href: "/events/new", label: "Use the form" }} />}
                  {current && o.kind === "draft" && o.addFormats && <CardActions primary="Add formats" onPrimary={() => addFormats(o)} pending={busy} onCancel={reset} alt={{ href: `/events/${o.addFormats.eventId}/edit/formats`, label: "Use the form" }} />}
                  {current && o.kind === "draft" && o.comments.map((c, j) => <CardActions key={j} primary={c.change ? "Send change request" + (c.items.length > 1 ? "s" : "") : "Post comment" + (c.items.length > 1 ? "s" : "")} onPrimary={() => postComments(c)} pending={busy} onCancel={reset} alt={{ href: `/events/${c.eventId}/slots/${c.slotId}`, label: "Open the design" }} />)}
                </div>
              );
            })}
            {rec.state === "listening" && <div className="flex justify-end"><div className="rounded-2xl rounded-br-md bg-brand-soft px-4 py-2.5 text-[15px] text-brand-soft-foreground">{rec.live || <span className="buddy-dots-text">Listening</span>}</div></div>}
            {(rec.state === "transcribing" || thinking) && <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="buddy-dots-text">{rec.state === "transcribing" ? "Working out the words" : "Thinking"}</span></div>}
            <div ref={endRef} />
          </div>

          <form className="flex items-center gap-2 border-t border-border px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3" onSubmit={(e) => { e.preventDefault(); send(text); }}>
            {/* Hold to talk and release to send; a quick tap keeps it listening until the next tap. */}
            <button type="button" aria-label={rec.state === "listening" ? "Stop" : "Hold to talk"} disabled={busy || thinking || rec.state === "transcribing"}
              onPointerDown={(e) => { e.preventDefault(); if (rec.state === "idle") { pressAt.current = Date.now(); listen(); } else if (rec.state === "listening") rec.stop(); }} onPointerUp={() => { if (rec.state === "listening" && Date.now() - pressAt.current > 400) rec.stop(); }} onPointerCancel={() => { if (rec.state === "listening") rec.stop(); }} onContextMenu={(e) => e.preventDefault()}
              className={cn("flex size-12 shrink-0 items-center justify-center rounded-full transition-colors", rec.state === "listening" ? "bg-brand text-brand-foreground" : "bg-brand-soft text-brand-soft-foreground hover:bg-brand hover:text-brand-foreground", (busy || thinking) && "opacity-50")} style={{ touchAction: "none" }}>
              <Icon name={rec.state === "listening" ? "stop" : "mic"} size={24} fill={rec.state === "listening"} />
            </button>
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder={rec.supported ? "Hold the mic, or type" : "Type what you need"} disabled={busy || thinking} className="h-12 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-[15px] outline-none focus:border-foreground/40" />
            <Button type="submit" size="icon-lg" variant={text.trim() ? "default" : "secondary"} disabled={!text.trim() || busy || thinking} aria-label="Send"><Icon name="send" size={20} /></Button>
          </form>
        </DrawerContent>
      </Drawer>
    </>
  );
}
