"use client";
// icons: mic, stop, arrow_upward, keyboard, close, edit
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";
import { errorMessage } from "@/lib/user-error";
import { assistantTurn, assistantCreateProjects, assistantAddFormats, assistantComment, assistantUpdateProject } from "@/app/actions/assistant";
import type { CommentDraft, Outcome, Person, Turn, Where } from "@/lib/assistant/schema";
import { NavDock, FloatingMic, HelloCard, Face, useSlot, NAV_SLOT_ID, HELLO_SLOT_ID } from "@/components/assistant/dock";
import { ASSISTANT_ART, ASSISTANT_HELLO_VERSION } from "@/config/assistant";
import { useRecorder } from "@/components/assistant/use-recorder";
import { CardActions, CommentCard, DoneCard, OptionButtons, ProjectCard, ProjectUpdateCard, Say } from "@/components/assistant/cards";
import { Tour, tourDone, markTourDone, type TourState } from "@/components/assistant/tour";

export interface AssistantProps {
  name: string;
  /** Which transcription service is set up; none means the browser listens on its own. */
  ears: "sarvam" | "gemini" | null;
  /** Format key → name, for the cards. */
  formats: { key: string; name: string }[];
  keyterms: string[];
}

type Entry = Turn | { role: "done"; title: string; links: { href: string; label: string }[]; needs?: string[] } | { role: "error"; text: string };

/**
 * The thread outlives a page change (creating a project lands on its review step, which has its own frame), kept in
 * this tab for a short while. Nothing is written anywhere else.
 */
const THREAD_KEY = "dc.vichar.thread";
const THREAD_TTL_MS = 20 * 60_000;
type Saved = { entries: Entry[]; people: Person[]; open: boolean; at: number };
const restore = (): Saved | null => { try { const s = JSON.parse(sessionStorage.getItem(THREAD_KEY) ?? "null") as Saved | null; return s && Date.now() - s.at < THREAD_TTL_MS ? s : null; } catch { return null; } };
const persist = (s: Omit<Saved, "at"> | null) => { try { if (s && s.entries.length) sessionStorage.setItem(THREAD_KEY, JSON.stringify({ ...s, at: Date.now() })); else sessionStorage.removeItem(THREAD_KEY); } catch { /* private mode */ } };

const whereOf = (path: string): Where => {
  const asset = path.match(/^\/events\/([^/]+)\/slots\/([^/]+)/);
  if (asset) return { page: "asset", eventId: asset[1], slotId: asset[2], path };
  const project = path.match(/^\/events\/([^/]+)$/);
  if (project) return { page: "project", eventId: project[1], slotId: null, path };
  const wizard = path.match(/^\/events\/([^/]+)\/edit\//);
  if (wizard) return { page: "wizard", eventId: wizard[1], slotId: null, path };
  return { page: path === "/events" || path === "/" ? "projects" : "other", eventId: null, slotId: null, path };
};

/** Wide screens get him as a panel docked on the right instead of the whole screen. */
const WIDE = "(min-width: 768px)";
const useWide = () => useSyncExternalStore((cb) => { const m = matchMedia(WIDE); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); }, () => matchMedia(WIDE).matches, () => false);
/** The sidebar's Vichar row (src/components/app-sidebar.tsx) asks for him with this event; ⌘J / Ctrl+J does the same. */
export const VICHAR_EVENT = "dc:vichar";

/** The sound while he listens: one bar every so often, the newest at the right, as many as the pill can show. */
const WAVE_BARS = 64;
const WAVE_EVERY_MS = 70;
/** How long a press counts as holding the mic. */
const HOLD_MS = 400;
/** His hello card stays away once dismissed, until he learns something new. */
const HELLO_KEY = "dc.vichar.hello";
const helloDismissed = () => { try { return localStorage.getItem(HELLO_KEY) === ASSISTANT_HELLO_VERSION; } catch { return true; } };
/** A line under his pill the first time his screen opens on a kind of page: what this page is good for. */
const NUDGES: Partial<Record<Where["page"], string>> = {
  asset: "Here you can say: tell someone what to change on this design.",
  wizard: "Say the date, the invite text, who gets which format, or “publish it”.",
  project: "Say a format to add to this project, or ask what is pending on it.",
};
const NUDGE_KEY = "dc.vichar.nudges";
const nudgesSeen = (): string[] => { try { return JSON.parse(localStorage.getItem(NUDGE_KEY) ?? "[]"); } catch { return []; } };

/**
 * The assistant: his disc in the bottom bar (or floating where there is no bar), and the screen that takes over when
 * you tap it. Say or type what you want; he answers with a card; you tap. Each thread is one task: the button that
 * does it, or Cancel, ends it.
 */
export function Assistant(p: AssistantProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [saved] = useState(() => restore());
  const [open, setOpen] = useState(saved?.open ?? false);
  const [entries, setEntries] = useState<Entry[]>(saved?.entries ?? []);
  const [people, setPeople] = useState<Person[]>(saved?.people ?? []);
  useEffect(() => { persist({ entries, people, open }); }, [entries, people, open]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [hello, setHello] = useState(() => !helloDismissed());
  const [tour, setTour] = useState<TourState | null>(null);
  const tourRef = useRef<TourState | null>(null); tourRef.current = tour;
  const [nudge, setNudge] = useState<string | null>(null);
  const wide = useWide();
  // On a wide screen the page makes room beside his panel (src/app/globals.css).
  useEffect(() => { document.documentElement.classList.toggle("dc-vichar-open", open && wide); return () => document.documentElement.classList.remove("dc-vichar-open"); }, [open, wide]);
  // The sidebar row and the keyboard shortcut.
  useEffect(() => {
    const onEvent = () => setOpen((o) => !o);
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener(VICHAR_EVENT, onEvent); window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener(VICHAR_EVENT, onEvent); window.removeEventListener("keydown", onKey); };
  }, []);
  const pressAt = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const rec = useRecorder(!!p.ears, p.keyterms);
  const formatNames = useMemo(() => new Map(p.formats.map((f) => [f.key, f.name])), [p.formats]);
  const where = useMemo(() => whereOf(pathname), [pathname]);

  const last = entries[entries.length - 1];
  const lastOutcome = last?.role === "assistant" ? last.outcome : null;
  const lastUserAt = entries.reduce((at, e, i) => (e.role === "user" ? i : at), -1);
  const listening = rec.state === "listening";
  const working = rec.state === "transcribing" || thinking || busy;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [entries, thinking, rec.state]);

  // The loudness, sampled while he listens and drawn as bars that fill the pill from the right.
  const level = useRef(0); level.current = rec.level;
  const [wave, setWave] = useState<number[]>([]);
  useEffect(() => { if (!listening) { setWave([]); return; } const t = setInterval(() => setWave((w) => [...w.slice(-(WAVE_BARS - 1)), level.current]), WAVE_EVERY_MS); return () => clearInterval(t); }, [listening]);
  // The first time his screen opens on a kind of page, one line on what this page is good for.
  useEffect(() => { if (!open) { setNudge(null); return; } const text = NUDGES[where.page]; if (!text || entries.length > 0) return; const seen = nudgesSeen(); if (seen.includes(where.page)) return; setNudge(text); try { localStorage.setItem(NUDGE_KEY, JSON.stringify([...seen, where.page])); } catch { /* private mode */ } }, [open, where.page, entries.length]);
  // The pill grows with what is typed, a few lines at most.
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 144) + "px"; }, [text]);

  const reset = () => { setEntries([]); setPeople([]); setText(""); setEditing(null); setConfirmReset(false); persist(null); };
  /** Tap what you said and it comes back into the pill to fix; sending replays the thread from there. */
  const edit = (i: number, words: string) => { setEditing(i); setText(words); inputRef.current?.focus(); };
  const cancelEdit = () => { setEditing(null); setText(""); };
  const dismissHello = () => { setHello(false); try { localStorage.setItem(HELLO_KEY, ASSISTANT_HELLO_VERSION); } catch { /* private mode */ } };
  /** The walk-through: from the hello card, the first time his screen opens, or "Show me how". */
  const startTour = () => { reset(); setTour({ step: 1, said: null }); setOpen(true); };
  const tourSaid = (words: string) => { const clean = words.trim(); if (!clean) { toast.message("I didn't catch anything. Try once more."); return; } setTour((t) => (t ? { ...t, said: clean } : t)); };
  const tourNext = () => setTour((t) => (t ? { step: (t.step + 1) as TourState["step"], said: null } : t));
  const endTour = () => { markTourDone(); setTour(null); };

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
    rec.start((words) => { if (tourRef.current) tourSaid(words); else if (words.trim()) send(words, editing); else setEntries((cur) => [...cur, { role: "error", text: "I didn't catch anything. Tap the mic and speak, or type it." }]); }, (msg) => setEntries((cur) => [...cur, { role: "error", text: msg }]));
  }, [rec, send, editing]);
  /** What the pill sends: in the walk-through, to the practice step; otherwise to him. */
  const submit = () => { if (tour) { tourSaid(text); setText(""); } else send(text, editing); };

  // His disc: tap and his screen takes over and he listens straight away; hold to open it for typing.
  const navSlot = useSlot(NAV_SLOT_ID, pathname);
  const helloSlot = useSlot(HELLO_SLOT_ID, pathname);
  const tap = () => { if (open) { setOpen(false); return; } if (!tourDone() && entries.length === 0) { startTour(); return; } setOpen(true); if (!working && rec.state === "idle") listen(); };
  const attention = !open && !!last && (last.role === "done" || lastOutcome?.kind === "question" || !!lastOutcome?.projects.some((x) => x.gaps.length) || !!lastOutcome?.comments.some((c) => c.unresolved.length));
  const dock = { attention, onTap: tap, onHold: () => setOpen(true) };

  // What the pill under his face says, and which clip plays in it.
  const status = listening ? "Listening…" : rec.state === "transcribing" ? "Working out the words…" : thinking ? "Thinking…" : busy ? "Doing it…" : tour ? "Practice" : p.name;
  const clip = listening ? ASSISTANT_ART.clips.writing : working ? ASSISTANT_ART.clips.thinking : null;

  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); } };
  const createProjects = (o: Outcome) => act(async () => {
    const r = await assistantCreateProjects(o.projects);
    for (const n of r.notes) toast.message(n);
    setEntries((cur) => [...cur, { role: "done", title: r.ids.length === 1 ? "Draft project created" : `${r.ids.length} draft projects created`, links: r.ids.map((id, i) => ({ href: `/events/${id}/edit/review`, label: `Open ${o.projects[i]?.title ?? "project"}` })), needs: r.needs[0] }]);
    router.push(`/events/${r.ids[0]}/edit/review`); router.refresh();
  });
  const addFormats = (o: Outcome) => act(async () => {
    const a = o.addFormats!; const r = await assistantAddFormats(a.eventId, a.formats);
    for (const s of r.skipped) toast.message(s);
    setEntries((cur) => [...cur, { role: "done", title: r.added.length ? `Added ${r.added.join(", ")}` : "Nothing new to add", links: [{ href: `/events/${a.eventId}`, label: `Open ${a.eventTitle}` }] }]);
    router.refresh();
  });
  const updateProject = (o: Outcome) => act(async () => {
    const u = o.updateProject!; const r = await assistantUpdateProject(u);
    const what = r.changed.length ? `Saved ${r.changed.join(", ")}` : "Nothing new to save";
    setEntries((cur) => [...cur, { role: "done", title: r.published ? `${what}. Published!` : what, links: [{ href: r.published ? `/events/${u.eventId}` : `/events/${u.eventId}/edit/review`, label: `Open ${u.eventTitle}` }], needs: r.needs }]);
    if (r.published) router.push(`/events/${u.eventId}`);
    router.refresh();
  });
  const postComments = (c: CommentDraft) => act(async () => {
    const r = await assistantComment(c);
    if (r.note) toast.message(r.note);
    setEntries((cur) => [...cur, { role: "done", title: r.posted === 1 ? "Posted" : `Posted ${r.posted} ${c.change ? "change requests" : "comments"}`, links: [{ href: `/events/${c.eventId}/slots/${c.slotId}`, label: `Open ${c.slotName}` }] }]);
    router.refresh();
  });
  const updateComment = (i: number, next: CommentDraft) => setEntries((cur) => cur.map((e, j) => (j === i && e.role === "assistant" ? { ...e, outcome: { ...e.outcome, comments: e.outcome.comments.map((c) => (c.slotId === next.slotId ? next : c)) } } : e)));

  const retry = <div className="flex gap-2"><Button size="sm" variant="secondary" className="h-9 rounded-full" onClick={listen} disabled={working}><Icon name="mic" fill className="!text-[16px]" />Try again</Button><Button size="sm" variant="ghost" className="h-9 rounded-full" onClick={() => inputRef.current?.focus()}><Icon name="keyboard" className="!text-[16px]" />Type it</Button></div>;

  /* The pieces of his screen, shared by the phone (the whole screen) and the wide-screen panel. */
  const top = (
          /* The top is frosted glass: him, his name (or what he is doing) under his chin, the way out and Start over in the corners.
              The thread scrolls under it and fades out as it goes, so what was said earlier blurs away behind him. */
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
            <div className="absolute inset-x-0 top-0 h-[calc(max(env(safe-area-inset-top),16px)+164px)] bg-gradient-to-b from-card from-45% via-card/85 via-70% to-transparent" />
            <div className="absolute inset-x-0 top-0 h-[calc(max(env(safe-area-inset-top),16px)+164px)] backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_40%,transparent)]" />
            <div className="relative flex flex-col items-center pt-[max(env(safe-area-inset-top),16px)]">
              {entries.length > 0 && !tour && <Button variant="secondary" size="sm" className="pointer-events-auto absolute left-5 top-[max(env(safe-area-inset-top),16px)] h-8 rounded-full bg-card/70 backdrop-blur-md hover:bg-card" onClick={() => setConfirmReset(true)} disabled={working || listening}>Start over</Button>}
              <Button variant="secondary" size="icon-sm" className="pointer-events-auto absolute right-5 top-[max(env(safe-area-inset-top),16px)] rounded-full bg-card/70 backdrop-blur-md hover:bg-card" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" /></Button>
              <Face still={ASSISTANT_ART.still} clip={clip} size={88} className="mt-3 ring-2 ring-border" />
              <div className="buddy-art -mt-4 rounded-full border-2 border-border bg-card px-3.5 py-1.5 text-sm shadow-md" aria-live="polite">
                <DrawerTitle className="text-sm font-normal">{status}</DrawerTitle>
              </div>
              <DrawerDescription className="sr-only">Say or type what you need. Projects, formats, comments.</DrawerDescription>
              {nudge && !tour && <p className="buddy-art mt-3 max-w-[300px] text-center text-[13px] leading-[18px] text-muted-foreground">{nudge}</p>}
            </div>
          </div>
  );
  const thread = (pad: string) => (
          <div className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto px-5 pb-3", pad)}>
            {tour && <Tour tour={tour} formats={p.formats} formatNames={formatNames} busy={listening || rec.state === "transcribing"} onSay={listen} onType={() => inputRef.current?.focus()} onNext={tourNext} onSkip={endTour} onFinish={() => { endTour(); listen(); }} />}
            {!tour && entries.length === 0 && (
              <div className="space-y-2 rounded-2xl bg-subtle p-4 text-sm leading-5">
                <p className="text-muted-foreground">Try:</p>
                <p>“New project for Sharad Purnima and Annakut with a print card 8.5 by 5.5, WhatsApp, Instagram, LED and website hero.”</p>
                <p>“Tell Chirantan the text is cut off at the sides and to check the spelling of mahaprasad.”</p>
                <p className="pt-1"><button type="button" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline" onClick={startTour}>Show me how</button></p>
              </div>
            )}
            {!tour && entries.map((e, i) => {
              if (e.role === "user") return (
                <div key={i} className="flex flex-col items-end">
                  {i === lastUserAt && !working && editing == null && <span className="mb-0.5 text-[11px] text-muted-foreground">Tap to edit</span>}
                  <button type="button" title="Tap to fix what I heard" onClick={() => !working && edit(i, e.text)} className={cn("max-w-[90%] rounded-2xl rounded-br-md bg-brand-soft px-4 py-2.5 text-left text-[15px] leading-6 text-brand-soft-foreground", editing === i && "ring-2 ring-brand/50")}>
                    {e.text}<Icon name="edit" fill className="ml-1.5 align-[-3px] !text-[16px] opacity-60" />
                  </button>
                </div>
              );
              if (e.role === "error") return <div key={i} className="space-y-2"><Say tone="muted">{e.text}</Say>{i === entries.length - 1 && retry}</div>;
              if (e.role === "done") return <DoneCard key={i} title={e.title} links={e.links} needs={i === entries.length - 1 ? e.needs : []} />;
              const o = e.outcome; const current = i === entries.length - 1;
              return (
                <div key={i} className={cn("space-y-2", !current && "opacity-60")}>
                  <Say>{o.say}</Say>
                  {o.kind === "question" && o.question && <>{o.question.text !== o.say && <Say>{o.question.text}</Say>}{current && o.question.options.length > 0 && <OptionButtons options={o.question.options} onPick={(opt) => send(opt)} disabled={working} />}</>}
                  {o.kind === "unclear" && current && retry}
                  {o.kind === "unsupported" && o.link && current && <Button asChild variant="secondary" size="sm" className="h-9 rounded-full"><a href={o.link.href}>{o.link.label}</a></Button>}
                  {o.projects.map((pr, j) => <ProjectCard key={j} p={pr} formatNames={formatNames} />)}
                  {o.addFormats && (
                    <div className="space-y-1 rounded-2xl border border-border bg-card p-4 text-sm">
                      <p className="font-medium">Add to {o.addFormats.eventTitle}</p>
                      <ul className="space-y-1">{o.addFormats.formats.map((f, j) => <li key={j}>{formatNames.get(f.formatKey) ?? f.formatKey}{f.label ? ` · ${f.label}` : ""}{f.size ? ` · ${f.size.w} × ${f.size.h}` : ""}</li>)}</ul>
                    </div>
                  )}
                  {o.updateProject && <ProjectUpdateCard u={o.updateProject} />}
                  {o.comments.map((c, j) => <CommentCard key={j} c={c} people={people} onChange={(next) => updateComment(i, next)} />)}
                  {current && o.kind === "draft" && o.projects.length > 0 && <CardActions primary={o.projects.length === 1 ? "Create draft project" : `Create ${o.projects.length} draft projects`} onPrimary={() => createProjects(o)} pending={busy} alt={{ href: "/events/new", label: "Use the form instead" }} />}
                  {current && o.kind === "draft" && o.addFormats && <CardActions primary="Add formats" onPrimary={() => addFormats(o)} pending={busy} alt={{ href: `/events/${o.addFormats.eventId}/edit/formats`, label: "Use the form instead" }} />}
                  {current && o.kind === "draft" && o.updateProject && <CardActions primary={o.updateProject.publish ? "Save and publish" : "Save"} onPrimary={() => updateProject(o)} pending={busy} alt={{ href: `/events/${o.updateProject.eventId}/edit/event`, label: "Use the form instead" }} />}
                  {current && o.kind === "draft" && o.comments.map((c, j) => <CardActions key={j} primary={c.change ? "Send change request" + (c.items.length > 1 ? "s" : "") : "Post comment" + (c.items.length > 1 ? "s" : "")} onPrimary={() => postComments(c)} pending={busy} alt={{ href: `/events/${c.eventId}/slots/${c.slotId}`, label: "Open the design instead" }} />)}
                </div>
              );
            })}
            {listening && rec.live && <p className="text-right text-[15px] leading-6 text-muted-foreground">{rec.live}</p>}
            <div ref={endRef} />
          </div>
  );
  const composer = (
          /* One pill: type (it grows with the words), or the mic. While he listens it fills with the sound from the right, a stop to drop it, the arrow to send. */
          <form className="shrink-0 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {editing != null && !listening && <div className="mb-1.5 flex items-center justify-between px-3 text-xs text-muted-foreground"><span>Fixing what you said · he will redo it from there</span><button type="button" className="underline-offset-4 hover:underline" onClick={cancelEdit}>Cancel</button></div>}
            <div className="flex min-h-14 items-end gap-2 rounded-[28px] border border-border bg-background pl-4 pr-1.5 focus-within:border-foreground/40">
              {listening ? (
                <>
                  <div className="flex h-14 flex-1 items-center justify-end gap-[2px] overflow-hidden" aria-hidden>
                    {wave.map((v, i) => <span key={i} className="w-[3px] shrink-0 rounded-full bg-foreground" style={{ height: 2 + Math.round(v * 20) }} />)}
                  </div>
                  <button type="button" className="mb-1.5 flex size-10 shrink-0 items-center justify-center rounded-full text-foreground" onClick={() => rec.cancel()} aria-label="Stop and drop it"><Icon name="stop" fill size={24} /></button>
                  <button type="button" className="mb-1.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground" onClick={() => rec.stop()} aria-label="Send what I said"><Icon name="arrow_upward" size={24} /></button>
                </>
              ) : (
                <>
                  <textarea ref={inputRef} rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }} placeholder={rec.supported ? "Hold the mic, or type" : "Type what you need"} disabled={working} className="max-h-36 min-w-0 flex-1 resize-none bg-transparent py-4 text-[15px] leading-6 outline-none" />
                  {text.trim()
                    ? <button type="submit" disabled={working} className="mb-1.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground disabled:opacity-50" aria-label="Send"><Icon name="arrow_upward" size={24} /></button>
                    : <button type="button" aria-label="Hold to talk" disabled={working || rec.state === "transcribing"}
                        onPointerDown={(e) => { e.preventDefault(); if (rec.state === "idle") { pressAt.current = Date.now(); listen(); } }}
                        onPointerUp={() => { if (rec.state === "listening" && Date.now() - pressAt.current > HOLD_MS) rec.stop(); }}
                        onContextMenu={(e) => e.preventDefault()}
                        className="mb-1.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground disabled:opacity-50" style={{ touchAction: "none" }}>
                        <Icon name="mic" fill size={24} />
                      </button>}
                </>
              )}
            </div>
          </form>
  );

  return (
    <>
      {navSlot ? <NavDock slot={navSlot} {...dock} /> : !open && <FloatingMic {...dock} raised={where.page === "asset" || where.page === "wizard"} />}
      {hello && helloSlot && <HelloCard slot={helloSlot} bust={ASSISTANT_ART.bust} onTry={() => { dismissHello(); startTour(); }} onLater={dismissHello} />}
      {wide ? open && (
        /* Docked on the right of a wide screen: a compact header, the same thread and pill; the page stays usable beside it. */
        <aside data-vichar className="fixed inset-y-0 right-0 z-40 flex w-[380px] flex-col border-l border-border bg-card shadow-[-8px_0_24px_rgb(0_0_0/0.05)]" aria-label={p.name}>
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
            <Face still={ASSISTANT_ART.still} clip={clip} size={36} className="ring-2 ring-border" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-5">{p.name}</p>
              <p className="truncate text-xs text-muted-foreground" aria-live="polite">{status === p.name ? (nudge && !tour ? nudge : "Say or type what you need.") : status}</p>
            </div>
            {entries.length > 0 && !tour && <Button variant="secondary" size="sm" className="h-8 rounded-full" onClick={() => setConfirmReset(true)} disabled={working || listening}>Start over</Button>}
            <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" /></Button>
          </div>
          {thread("pt-4")}
          {composer}
        </aside>
      ) : (
      <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) { rec.cancel(); if (tour) setTour(null); if (last?.role === "done") reset(); } }}>
        {/* His screen: the whole phone; on a wide screen a tall sheet in the middle. */}
        <DrawerContent data-vichar className="relative h-[100dvh] max-h-[100dvh] rounded-none border-0 data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-[100dvh] data-[vaul-drawer-direction=bottom]:rounded-none [&>div:first-child]:hidden! md:mx-auto md:h-[85dvh] md:max-h-[85dvh] md:max-w-xl md:rounded-t-3xl md:data-[vaul-drawer-direction=bottom]:max-h-[85dvh] md:data-[vaul-drawer-direction=bottom]:rounded-t-3xl">
{top}
          {thread("pt-[calc(max(env(safe-area-inset-top),16px)+160px)]")}
          {composer}
        </DrawerContent>
      </Drawer>
      )}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Start over?</DialogTitle><DialogDescription>This drops the draft. Nothing has been created from it.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setConfirmReset(false)}>Keep it</Button>
            <Button className="rounded-full bg-brand text-brand-foreground hover:bg-brand-hover" onClick={reset}>Start over</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
