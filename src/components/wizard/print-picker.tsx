"use client";
import { useState } from "react";
import { SelectField } from "@/components/ui/select-field";
import { Input } from "@/components/ui/input";
import type { FormatRow } from "@/components/wizard/steps";

/**
 * Print formats on the Formats step: an event normally has one print piece, so it is a single dropdown rather
 * than a row per size. "+ Add a print item" reveals another dropdown for the rare second piece. Every print slot
 * still posts `req_<slotId>` so saveFormats() stays the same.
 */
export function PrintPicker({ rows }: { rows: FormatRow[] }) {
  const initial = rows.filter((r) => r.requested).map((r) => r.slotId);
  const [picks, setPicks] = useState<string[]>(initial.length ? initial : [""]);
  const chosen = new Set(picks.filter(Boolean));
  const set = (i: number, v: string) => setPicks((p) => p.map((x, j) => (j === i ? v : x)));
  const remove = (i: number) => setPicks((p) => (p.length === 1 ? [""] : p.filter((_, j) => j !== i)));
  return (
    <li className="py-5">
      <p className="text-sm font-medium">Print</p>
      <p className="mt-0.5 text-sm text-muted-foreground">Sizes include the 0.125 in bleed. Pick the one being printed, or none.</p>
      <div className="mt-3 space-y-3">
        {picks.map((pick, i) => {
          const row = rows.find((r) => r.slotId === pick);
          return (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <SelectField value={pick} onChange={(e) => set(i, e.target.value)} aria-label={i === 0 ? "Print format" : `Print item ${i + 1}`} className="min-w-0 flex-1">
                  <option value="">{i === 0 ? "No print item" : "Choose a size"}</option>
                  {rows.filter((r) => r.slotId === pick || !chosen.has(r.slotId)).map((r) => <option key={r.slotId} value={r.slotId}>{r.name.replace(/^Print\s+/i, "")}</option>)}
                </SelectField>
                {i > 0 && <button type="button" onClick={() => remove(i)} className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Remove</button>}
              </div>
              {row && (
                <div className="flex flex-wrap items-center gap-3">
                  <Input name={`notes_${row.slotId}`} defaultValue={row.notes} placeholder="Notes for the print piece (optional)" className="h-11 min-w-0 flex-1 text-sm" />
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name="primary" value={row.slotId} defaultChecked={row.isPrimary} className="size-4 accent-[var(--brand)]" />Primary</label>
                </div>
              )}
            </div>
          );
        })}
        {picks.every(Boolean) && picks.length < rows.length && (
          <button type="button" onClick={() => setPicks((p) => [...p, ""])} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">+ Add a print item</button>
        )}
      </div>
      {rows.map((r) => <input key={r.slotId} type="hidden" name={`req_${r.slotId}`} value={chosen.has(r.slotId) ? "on" : "off"} />)}
    </li>
  );
}
