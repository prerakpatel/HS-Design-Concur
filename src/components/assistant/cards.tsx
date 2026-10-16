"use client";
// icons: check, check_circle, open_in_new, warning
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";
import type { CommentDraft, Outcome, Person, ProjectDraft, ProjectUpdate } from "@/lib/assistant/schema";

/** One card look for everything he drafts: a quiet bordered panel; the colour is kept for what matters. */
const card = "space-y-2 rounded-2xl border border-border bg-card p-4";
const pill = "h-9 rounded-full";

/** A line that needs the person: a small warning mark, no block of colour. */
export function Gap({ children }: { children: React.ReactNode }) {
  return <p className="flex items-start gap-1.5 text-[13px] leading-[18px] text-warning-text"><Icon name="warning" fill className="mt-px !text-[16px]" /><span>{children}</span></p>;
}

const sizeText = (f: ProjectDraft["formats"][number]) => (f.size ? ` · ${f.size.w} × ${f.size.h}` : "");

export function ProjectCard({ p, formatNames }: { p: ProjectDraft; formatNames: Map<string, string> }) {
  return (
    <div className={card}>
      <p className="font-medium leading-5">{p.title}</p>
      <p className="text-[13px] text-muted-foreground">{p.eventDate ? `Date ${p.eventDate}` : "Date: not set yet"}{p.venueName ? ` · ${p.venueName}` : ""}</p>
      {p.description && <p className="text-[13px]">{p.description}</p>}
      <ul className="space-y-1 text-sm">
        {p.formats.map((f, i) => <li key={i} className="flex items-center gap-2"><Icon name="check" className="!text-[16px] text-muted-foreground" /><span>{formatNames.get(f.formatKey) ?? f.formatKey}{f.label ? ` · ${f.label}` : ""}{sizeText(f)}{f.formatKey === p.primaryFormatKey ? " · primary" : ""}</span></li>)}
        {!p.formats.length && <li className="text-muted-foreground">No formats yet</li>}
      </ul>
      {p.gaps.map((g, i) => <Gap key={i}>{g}</Gap>)}
    </div>
  );
}

export function CommentCard({ c, people, onChange }: { c: CommentDraft; people: Person[]; onChange: (next: CommentDraft) => void }) {
  const named = c.mentionUserIds.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  return (
    <div className={card}>
      <p className="font-medium leading-5">{c.slotName}<span className="font-normal text-muted-foreground"> · {c.eventTitle}</span></p>
      <p className="text-[13px] text-muted-foreground">{c.change ? `${c.items.length === 1 ? "Change request" : `${c.items.length} change requests`}` : `${c.items.length === 1 ? "Comment" : `${c.items.length} comments`}`}{named.length ? ` for ${named.map((p) => p.name).join(", ")}` : ""}</p>
      <ul className="space-y-1.5 text-sm">{c.items.map((t, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">{i + 1}.</span><span>{t}</span></li>)}</ul>
      {c.unresolved.map((name) => (
        <div key={name} className="space-y-1.5">
          <Gap>Who is {name}? Nobody on this project goes by that.</Gap>
          <select className="h-9 w-full rounded-full border border-border bg-background px-3 text-sm" defaultValue="" onChange={(e) => { const id = e.target.value; if (!id) return; onChange({ ...c, mentionUserIds: [...new Set([...c.mentionUserIds, id])], unresolved: c.unresolved.filter((n) => n !== name) }); }}>
            <option value="" disabled>Pick a person</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

/** Under the current card: the one button that does it, Cancel, and a quiet way out to the form. */
export function CardActions({ primary, onPrimary, pending, onCancel, alt }: { primary: string; onPrimary: () => void; pending: boolean; onCancel: () => void; alt?: { href: string; label: string } }) {
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <Button onClick={onPrimary} disabled={pending} className="h-10 rounded-full bg-brand px-5 text-brand-foreground hover:bg-brand-hover">{pending ? "Working…" : primary}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending} className="h-10 rounded-full px-4">Cancel</Button>
      </div>
      {alt && <Link href={alt.href} className="inline-block text-[13px] text-muted-foreground underline-offset-4 hover:underline">{alt.label}</Link>}
    </div>
  );
}

export function Say({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "muted" }) {
  return <p className={cn("text-[15px] leading-6", tone === "muted" && "text-muted-foreground")}>{children}</p>;
}

export function OptionButtons({ options, onPick, disabled }: { options: string[]; onPick: (o: string) => void; disabled: boolean }) {
  return <div className="flex flex-wrap gap-2">{options.map((o) => <Button key={o} variant="secondary" size="sm" className={pill} disabled={disabled} onClick={() => onPick(o)}>{o}</Button>)}</div>;
}

export function DoneCard({ title, links, needs = [] }: { title: string; links: { href: string; label: string }[]; /** What still stands between the project and publishing. */ needs?: string[] }) {
  return (
    <div className={card}>
      <p className="flex items-center gap-2 font-medium"><Icon name="check_circle" fill className="!text-[20px] text-success-text" />{title}</p>
      <div className="flex flex-wrap gap-2">{links.map((l) => <Button key={l.href} asChild variant="secondary" size="sm" className={pill}><Link href={l.href}>{l.label}<Icon name="open_in_new" className="!text-[16px]" /></Link></Button>)}</div>
      {needs.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[13px] font-medium">Before it can be published:</p>
          {needs.map((n) => <Gap key={n}>{n}</Gap>)}
          <p className="text-[13px] text-muted-foreground">Just say it: “the invite text is…”, “it’s at 6:30 pm”, “give the print card to Chirantan”, then “publish it”.</p>
        </div>
      )}
    </div>
  );
}

export function ProjectUpdateCard({ u }: { u: ProjectUpdate }) {
  const rows: [string, string][] = [];
  if (u.title) rows.push(["Title", u.title]);
  if (u.eventDate) rows.push(["Date", u.eventDate]);
  if (u.venueName) rows.push(["Venue", u.venueName + (u.venueAddress ? `, ${u.venueAddress}` : "")]);
  if (u.timeText) rows.push(["Timings", u.timeText]);
  if (u.description) rows.push(["Invite text", u.description]);
  if (u.notes) rows.push(["Notes", u.notes]);
  for (const a of u.assignments) rows.push([a.slotName, `→ ${a.userName}`]);
  return (
    <div className={card}>
      <p className="font-medium leading-5">{u.eventTitle}{u.publish && <span className="ml-2 text-[13px] font-normal text-muted-foreground">· and publish</span>}</p>
      {rows.length > 0 && <dl className="space-y-1 text-sm">{rows.map(([k, v]) => <div key={k + v} className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0">{v}</dd></div>)}</dl>}
      {!rows.length && !u.publish && <p className="text-sm text-muted-foreground">Nothing to change</p>}
      {u.gaps.map((g, i) => <Gap key={i}>{g}</Gap>)}
    </div>
  );
}

export const isEmptyDraft = (o: Outcome) => o.kind === "draft" && !o.projects.length && !o.addFormats && !o.comments.length;
