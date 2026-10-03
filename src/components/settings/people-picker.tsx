"use client";
import { useMemo, useState } from "react";
import { Icon } from "@/components/material-icon";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

// icons: close person_add
export interface PickablePerson { id: string; name: string; initials: string; avatar?: string | null; hint?: string }

/**
 * Pick people from a list that can grow: chosen ones sit as removable chips, a search box below finds the rest.
 * Posts each chosen id as a hidden input under `name`, so it works inside a plain <form>.
 */
export function PeoplePicker({ name, people, defaultValue = [], placeholder = "Add people…" }: { name: string; people: PickablePerson[]; defaultValue?: string[]; placeholder?: string }) {
  const [chosen, setChosen] = useState<string[]>(defaultValue);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const q = query.trim().toLowerCase();
  const rank = (p: PickablePerson) => { const n = p.name.toLowerCase(); return !q ? 0 : n.startsWith(q) ? 0 : n.includes(q) ? 1 : (p.hint ?? "").toLowerCase().includes(q) ? 2 : 3; };
  const matches = people.filter((p) => !chosen.includes(p.id) && rank(p) < 3).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  const add = (id: string) => { setChosen((c) => [...c, id]); setQuery(""); };
  return (
    <div className="space-y-2">
      {chosen.map((id) => <input key={id} type="hidden" name={name} value={id} />)}
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((id) => { const p = byId.get(id); if (!p) return null; return (
            <li key={id} className="flex h-8 items-center gap-1.5 rounded-full bg-subtle pl-1 pr-1.5 text-sm">
              <UserAvatar initials={p.initials} src={p.avatar} size={24} /><span className="max-w-[160px] truncate">{p.name}</span>
              <button type="button" onClick={() => setChosen((c) => c.filter((x) => x !== id))} aria-label={`Remove ${p.name}`} className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"><Icon name="close" className="!text-[16px]" /></button>
            </li>
          ); })}
        </ul>
      )}
      <div className="relative">
        <div className="flex h-11 items-center gap-2 rounded-lg border border-input bg-card px-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Icon name="person_add" className="!text-[20px] text-muted-foreground" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) add(matches[0].id); } if (e.key === "Escape") setOpen(false); }}
            placeholder={chosen.length ? "Add more…" : placeholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/55" aria-label={placeholder} />
          {chosen.length > 0 && <span className="text-xs text-muted-foreground">{chosen.length}</span>}
        </div>
        {open && matches.length > 0 && (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
            {matches.map((p, i) => (
              <li key={p.id}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); add(p.id); }} className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted", i === 0 && q && "bg-muted/60")}>
                  <UserAvatar initials={p.initials} src={p.avatar} size={28} /><span className="min-w-0 flex-1 truncate">{p.name}</span>{p.hint && <span className="truncate text-xs text-muted-foreground">{p.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && q && matches.length === 0 && <p className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground shadow-lg">No one matches “{query}”.</p>}
      </div>
    </div>
  );
}
