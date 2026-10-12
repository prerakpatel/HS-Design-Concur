"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectIcon } from "@/components/aspect-icon";
import { Icon } from "@/components/material-icon";

export interface AssetFormatOption { id: string; name: string; size: string; customSize: boolean }
export interface AssetItem { slotId?: string; formatId: string; label: string; notes: string; w?: number | null; h?: number | null; /** Has designs: can be renamed, not removed or re-formatted. */ locked?: boolean }

/**
 * The Assets step of an assets-only request: pick a format and how many (12 calendar covers, 4 YouTube
 * thumbnails), then name each one. Posts the list as JSON in `items`.
 */
export function AssetItems({ formats, initial }: { formats: AssetFormatOption[]; initial: AssetItem[] }) {
  const [items, setItems] = useState<AssetItem[]>(initial);
  const [pick, setPick] = useState(formats[0]?.id ?? "");
  const [count, setCount] = useState(1);
  const fmt = (id: string) => formats.find((f) => f.id === id);
  const set = (i: number, patch: Partial<AssetItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const add = () => {
    if (!pick) return;
    const n = Math.min(Math.max(1, count || 1), 24);
    const already = items.filter((x) => x.formatId === pick).length;
    // Several of one format get numbered names to start with; rename them to "January", "Episode 3"…
    const fresh = Array.from({ length: n }, (_, k) => ({ formatId: pick, label: n > 1 || already > 0 ? String(already + k + 1) : "", notes: "" }));
    setItems((xs) => [...xs, ...fresh]); setCount(1);
  };

  return (
    <div className="space-y-4 text-left">
      <input type="hidden" name="items" value={JSON.stringify(items.map(({ locked, ...x }) => { void locked; return x; }))} />
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border p-4">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Format</label>
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose a format" /></SelectTrigger>
            <SelectContent>{formats.map((f) => <SelectItem key={f.id} value={f.id}><span className="flex items-center gap-2"><AspectIcon size={f.size} box={16} />{f.name}<span className="text-muted-foreground">{f.size}</span></span></SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="w-24 space-y-1.5">
          <label htmlFor="asset-count" className="text-xs font-medium text-muted-foreground">How many</label>
          <Input id="asset-count" type="number" min={1} max={24} value={count} onChange={(e) => setCount(Number(e.target.value))} className="h-11" />
        </div>
        <Button type="button" variant="secondary" className="h-11" onClick={add}><Icon name="add" />Add</Button>
      </div>

      {items.length === 0
        ? <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">Add the first asset above. Need twelve of the same thing? Set “How many” and name each one after.</p>
        : (
          <ul className="space-y-2">
            {items.map((it, i) => {
              const f = fmt(it.formatId);
              return (
                <li key={it.slotId ?? `new-${i}`} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3">
                  <span className="flex min-w-0 basis-full items-center gap-2 text-sm font-medium sm:basis-72"><AspectIcon size={f?.size ?? ""} box={16} /><span className="truncate">{f?.name ?? "Format"}</span><span className="shrink-0 font-normal text-muted-foreground">{f?.customSize ? "" : f?.size}</span></span>
                  <Input aria-label="Name" placeholder="Name (optional), e.g. March" value={it.label} onChange={(e) => set(i, { label: e.target.value })} className="h-10 min-w-[140px] flex-1" />
                  {f?.customSize && <span className="flex items-center gap-1"><Input aria-label="Width in px" type="number" min={1} placeholder="W" value={it.w ?? ""} onChange={(e) => set(i, { w: Number(e.target.value) || null })} className="h-10 w-20" /><span className="text-muted-foreground">×</span><Input aria-label="Height in px" type="number" min={1} placeholder="H" value={it.h ?? ""} onChange={(e) => set(i, { h: Number(e.target.value) || null })} className="h-10 w-20" /></span>}
                  <Input aria-label="Notes" placeholder="Notes for the designer" value={it.notes} onChange={(e) => set(i, { notes: e.target.value })} className="h-10 min-w-[160px] flex-[2]" />
                  <Button type="button" variant="ghost" size="icon" disabled={it.locked} title={it.locked ? "Has designs, can't be removed" : "Remove"} aria-label="Remove" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}><Icon name="close" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      {items.length > 0 && <p className="text-sm text-muted-foreground">{items.length} asset{items.length === 1 ? "" : "s"}. Each one gets its own designer, due date, review and approval.</p>}
    </div>
  );
}
