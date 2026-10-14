"use client";
// icons: edit, check, arrow_forward, open_in_new, person, warning
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";
import type { CommentDraft, Outcome, Person, ProjectDraft } from "@/lib/assistant/schema";

/** A line that needs the person: shown in amber inside the card. */
export function Gap({ children }: { children: React.ReactNode }) {
  return <p className="flex items-start gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1.5 text-[13px] text-warning-text"><Icon name="warning" className="mt-px !text-[16px]" /><span>{children}</span></p>;
}

const sizeText = (f: ProjectDraft["formats"][number]) => (f.size ? ` · ${f.size.w} × ${f.size.h}` : "");

export function ProjectCard({ p, formatNames }: { p: ProjectDraft; formatNames: Map<string, string> }) {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <p className="font-medium leading-5">{p.title}</p>
      <p className="text-[13px] text-muted-foreground">{p.eventDate ? `Date ${p.eventDate}` : "Date: not set yet"}{p.venueName ? ` · ${p.venueName}` : ""}</p>
      {p.description && <p className="text-[13px]">{p.description}</p>}
      <ul className="space-y-1 text-sm">
        {p.formats.map((f, i) => <li key={i} className="flex items-center gap-2"><Icon name="check" className="!text-[16px] text-success-text" /><span>{formatNames.get(f.formatKey) ?? f.formatKey}{f.label ? ` · ${f.label}` : ""}{sizeText(f)}{f.formatKey === p.primaryFormatKey ? " · primary" : ""}</span></li>)}
        {!p.formats.length && <li className="text-muted-foreground">No formats yet</li>}
      </ul>
      {p.gaps.map((g, i) => <Gap key={i}>{g}</Gap>)}
    </div>
  );
}

export function CommentCard({ c, people, onChange }: { c: CommentDraft; people: Person[]; onChange: (next: CommentDraft) => void }) {
  const named = c.mentionUserIds.map((id) => people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <p className="font-medium leading-5">{c.slotName}<span className="font-normal text-muted-foreground"> · {c.eventTitle}</span></p>
      <p className="text-[13px] text-muted-foreground">{c.change ? `${c.items.length === 1 ? "Change request" : `${c.items.length} change requests`}` : `${c.items.length === 1 ? "Comment" : `${c.items.length} comments`}`}{named.length ? ` for ${named.map((p) => p.name).join(", ")}` : ""}</p>
      <ul className="space-y-1.5 text-sm">{c.items.map((t, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">{i + 1}.</span><span>{t}</span></li>)}</ul>
      {c.unresolved.map((name) => (
        <div key={name} className="space-y-1.5">
          <Gap>Who is {name}? Nobody on this project goes by that.</Gap>
          <select className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm" defaultValue="" onChange={(e) => { const id = e.target.value; if (!id) return; onChange({ ...c, mentionUserIds: [...new Set([...c.mentionUserIds, id])], unresolved: c.unresolved.filter((n) => n !== name) }); }}>
            <option value="" disabled>Pick a person</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

/** The buttons under a card. `primary` is the one that creates; the rest are ways out. */
export function CardActions({ primary, onPrimary, pending, onCancel, alt }: { primary: string; onPrimary: () => void; pending: boolean; onCancel: () => void; alt?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button onClick={onPrimary} disabled={pending} className="h-10">{pending ? "Working…" : primary}<Icon name="arrow_forward" className="!text-[18px]" /></Button>
      <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      {alt && <Button asChild variant="ghost" className="ml-auto text-muted-foreground"><Link href={alt.href}><Icon name="edit" className="!text-[18px]" />{alt.label}</Link></Button>}
    </div>
  );
}

export function Say({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "muted" }) {
  return <p className={cn("text-[15px] leading-6", tone === "muted" && "text-muted-foreground")}>{children}</p>;
}

export function OptionButtons({ options, onPick, disabled }: { options: string[]; onPick: (o: string) => void; disabled: boolean }) {
  return <div className="flex flex-wrap gap-2">{options.map((o) => <Button key={o} variant="secondary" size="sm" disabled={disabled} onClick={() => onPick(o)}>{o}</Button>)}</div>;
}

export function DoneCard({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="space-y-2 rounded-2xl bg-success-soft p-4 text-success-text">
      <p className="flex items-center gap-2 font-medium"><Icon name="check" className="!text-[20px]" />{title}</p>
      <div className="flex flex-wrap gap-2">{links.map((l) => <Button key={l.href} asChild variant="secondary" size="sm"><Link href={l.href}>{l.label}<Icon name="open_in_new" className="!text-[16px]" /></Link></Button>)}</div>
    </div>
  );
}

export const isEmptyDraft = (o: Outcome) => o.kind === "draft" && !o.projects.length && !o.addFormats && !o.comments.length;
