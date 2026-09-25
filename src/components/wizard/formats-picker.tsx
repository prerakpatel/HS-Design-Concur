"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Icon } from "@/components/material-icon";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FormatRow } from "@/components/wizard/steps";

// icons: check
/**
 * The Formats step body. One quiet row per digital format: name and size, Need this / Skip, and, once needed,
 * a Primary toggle and an "Add note" link that opens the note field. Print sits last as a single row whose size is
 * a dropdown (an event normally has one print piece); "+ Add a print item" allows a second. Everything posts as
 * hidden inputs (`req_<slotId>`, `primary`, `notes_<slotId>`) so saveFormats() is unchanged.
 */
export function FormatsPicker({ rows }: { rows: FormatRow[] }) {
  const digital = rows.filter((r) => r.kind !== "print"); const print = rows.filter((r) => r.kind === "print");
  const [on, setOn] = useState<Set<string>>(() => new Set(rows.filter((r) => r.requested).map((r) => r.slotId)));
  const [primary, setPrimary] = useState<string>(() => rows.find((r) => r.isPrimary)?.slotId ?? "");
  const [notesOpen, setNotesOpen] = useState<Set<string>>(() => new Set(rows.filter((r) => r.notes).map((r) => r.slotId)));
  // A print item is a slot. Its dropdown picks a size; changing it on an item that already has designs asks the
  // server to move those designs to the new size (saveFormats swaps the formats), so nothing is lost.
  const initialPrint = print.filter((r) => r.requested).map((r) => r.slotId);
  const [printOn, setPrintOn] = useState(initialPrint.length > 0);
  const [items, setItems] = useState<{ orig: string | null; pick: string }[]>(() => initialPrint.length ? initialPrint.map((id) => ({ orig: id, pick: id })) : [{ orig: null, pick: print[0]?.slotId ?? "" }]);
  const picks = items.map((it) => it.pick);

  const need = (id: string, want: boolean) => setOn((s) => { const n = new Set(s); if (want) n.add(id); else { n.delete(id); if (primary === id) setPrimary(""); } return n; });
  const chosenPrint = new Set(printOn ? picks.filter(Boolean) : []);
  const requested = (id: string) => on.has(id) || chosenPrint.has(id);
  const setPick = (i: number, v: string) => setItems((p) => { const next = p.map((it, j) => (j === i ? { ...it, pick: v } : it)); if (primary && !next.some((it) => it.pick === primary) && print.some((r) => r.slotId === primary)) setPrimary(""); return next; });
  const removeItem = (i: number) => setItems((p) => { const next = p.filter((_, j) => j !== i); if (primary === p[i].pick) setPrimary(""); return next; });

  return (
    <div>
      <input type="hidden" name="primary" value={primary} />
      {rows.map((r) => <input key={r.slotId} type="hidden" name={`req_${r.slotId}`} value={requested(r.slotId) ? "on" : "off"} />)}
      <ul className="space-y-2">
        {digital.map((r) => (
          <li key={r.slotId} className={cn("rounded-2xl px-4 py-3.5 transition-colors", primary === r.slotId ? "bg-brand-soft/70" : on.has(r.slotId) ? "bg-subtle" : "")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.name}</p><p className="mt-0.5 text-sm text-muted-foreground">{r.size}</p></div>
              <NeedChips label={r.name} isOn={on.has(r.slotId)} onChange={(v) => need(r.slotId, v)} />
            </div>
            {on.has(r.slotId) && <RowExtras row={r} primary={primary} onPrimary={(id) => setPrimary(primary === id ? "" : id)} noteOpen={notesOpen.has(r.slotId)} onOpenNote={(id) => setNotesOpen((s) => new Set(s).add(id))} />}
          </li>
        ))}
        {print.length > 0 && (
          <li className={cn("rounded-2xl px-4 py-3.5 transition-colors", printOn && print.some((r) => r.slotId === primary) ? "bg-brand-soft/70" : printOn ? "bg-subtle" : "")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">Print</p><p className="mt-0.5 text-sm text-muted-foreground">{printOn ? "Sizes include the 0.125 in bleed." : "Invitation card or flyer."}</p></div>
              <NeedChips label="Print" isOn={printOn} onChange={(v) => { setPrintOn(v); if (!v && print.some((r) => r.slotId === primary)) setPrimary(""); }} />
            </div>
            {printOn && (
              <div className="mt-3 space-y-3">
                {items.map((it, i) => {
                  const row = print.find((r) => r.slotId === it.pick);
                  const origRow = it.orig ? print.find((r) => r.slotId === it.orig) : null;
                  const moving = !!origRow?.hasVersions && it.pick !== it.orig;
                  return (
                    <div key={i}>
                      <input type="hidden" name={`print_orig_${i}`} value={it.orig ?? ""} /><input type="hidden" name={`print_pick_${i}`} value={it.pick} />
                      <div className="flex items-center gap-2">
                        <SelectField value={it.pick} onChange={(e) => setPick(i, e.target.value)} aria-label={i === 0 ? "Print size" : `Print item ${i + 1}`} className="min-w-0 flex-1 sm:max-w-xs">
                          {print.filter((r) => r.slotId === it.pick || !chosenPrint.has(r.slotId)).map((r) => <option key={r.slotId} value={r.slotId}>{r.name.replace(/^Print\s+/i, "")}{r.hasVersions ? " · has designs" : ""}</option>)}
                        </SelectField>
                        {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Remove</button>}
                      </div>
                      {moving && <p className="mt-1.5 text-[13px] text-muted-foreground">The designs and comments on {origRow!.name.replace(/^Print\s+/i, "")} move to this size when you save.</p>}
                      {row && <RowExtras row={row} primary={primary} onPrimary={(id) => setPrimary(primary === id ? "" : id)} noteOpen={notesOpen.has(row.slotId)} onOpenNote={(id) => setNotesOpen((s) => new Set(s).add(id))} />}
                    </div>
                  );
                })}
                {items.length < print.length && <button type="button" onClick={() => setItems((p) => [...p, { orig: null, pick: print.find((r) => !chosenPrint.has(r.slotId))?.slotId ?? "" }])} className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">+ Add a print item</button>}
              </div>
            )}
          </li>
        )}
      </ul>
    </div>
  );
}

function NeedChips({ label, isOn, onChange }: { label: string; isOn: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label={`Need ${label}?`}>
      {([["Need this", true], ["Skip", false]] as const).map(([text, v]) => (
        <button key={text} type="button" role="radio" aria-checked={isOn === v} onClick={() => onChange(v)}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors", isOn === v ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/40")}>
          {isOn === v && <Icon name="check" className="!text-[16px]" />}{text}
        </button>
      ))}
    </div>
  );
}

/** Under a needed format: the Primary switch on the left, the note link on the right; the note field below when opened. */
function RowExtras({ row, primary, onPrimary, noteOpen, onOpenNote }: { row: FormatRow; primary: string; onPrimary: (id: string) => void; noteOpen: boolean; onOpenNote: (id: string) => void }) {
  const isPrimary = primary === row.slotId;
  return (
    <div className="mt-3 space-y-2.5">
      <div className="flex items-center justify-between gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium">
          <Switch size="sm" checked={isPrimary} onCheckedChange={() => onPrimary(row.slotId)} aria-label={`Make ${row.name} the primary format`} className="data-checked:bg-brand" />
          <span className={isPrimary ? "text-brand-foreground" : "text-muted-foreground"}>Primary</span>
        </label>
        {!noteOpen && <button type="button" onClick={() => onOpenNote(row.slotId)} className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">+ Add note</button>}
      </div>
      {noteOpen && <Input name={`notes_${row.slotId}`} defaultValue={row.notes} autoFocus={!row.notes} placeholder="Note for the designer (optional)" className="h-11 bg-card text-sm" />}
    </div>
  );
}
