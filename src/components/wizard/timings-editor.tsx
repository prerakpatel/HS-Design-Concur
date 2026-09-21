"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/material-icon";

export interface Timing { label: string; on_date: string; starts_at: string; ends_at: string }

/** One timing line by default, "+ add timing" for more (PRD §6.1). Dates come from the native picker, never typed. */
export function TimingsEditor({ initial }: { initial: Timing[] }) {
  const [rows, setRows] = useState<Timing[]>(initial.length ? initial : [{ label: "", on_date: "", starts_at: "", ends_at: "" }]);
  const update = (i: number, k: keyof Timing, v: string) => setRows((r) => r.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 md:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto]">
          <Input name="timing_label" placeholder="Label, e.g. Aarti" value={r.label} onChange={(e) => update(i, "label", e.target.value)} className="col-span-2 md:col-span-1" />
          <Input name="timing_date" type="date" value={r.on_date} onChange={(e) => update(i, "on_date", e.target.value)} className="col-span-2 md:col-span-1" />
          <Input name="timing_start" type="time" value={r.starts_at} onChange={(e) => update(i, "starts_at", e.target.value)} />
          <Input name="timing_end" type="time" value={r.ends_at} onChange={(e) => update(i, "ends_at", e.target.value)} />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove timing" className="col-span-2 justify-self-end md:col-span-1" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} disabled={rows.length === 1}><Icon name="close" /></Button>
        </div>
      ))}
      <Button type="button" variant="secondary" onClick={() => setRows((rs) => [...rs, { label: "", on_date: "", starts_at: "", ends_at: "" }])}><Icon name="add" />Add timing</Button>
    </div>
  );
}
