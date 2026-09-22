"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectField } from "@/components/ui/select-field";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { formatSize } from "@/lib/labels";
import { saveFormat, moveFormat } from "@/app/actions/formats";
import type { Format } from "@/lib/types";

const FRAMES: { value: Format["frame"]; label: string; hint: string }[] = [
  { value: "phone", label: "Phone", hint: "Shown inside a phone outline with the status bar" },
  { value: "card", label: "Card", hint: "Small card in a feed" },
  { value: "flat", label: "Flat", hint: "Plain image, no frame" },
  { value: "tv", label: "TV", hint: "16:9 screen" },
  { value: "led", label: "LED wall", hint: "Wide panel with decorative seams" },
  { value: "print", label: "Print", hint: "Trim, bleed and safe-margin guides" },
];
const MIMES = [{ value: "image/png", label: "PNG" }, { value: "image/jpeg", label: "JPG" }, { value: "image/webp", label: "WebP" }, { value: "image/gif", label: "GIF" }, { value: "application/pdf", label: "PDF" }];

/** Catalog list + side-sheet editor. Designers and Core Admins (PRD §9). */
export function FormatsList({ formats }: { formats: Format[] }) {
  const [open, setOpen] = useState<Format | "new" | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const move = (id: string, dir: "up" | "down") => start(async () => { await moveFormat(id, dir); router.refresh(); });
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">Every new event starts with all active formats. A new format is added to open events as N/A so nothing changes until someone requests it.</p>
        <Button onClick={() => setOpen("new")} className="self-start sm:shrink-0"><Icon name="add" className="!text-[18px]" />Add format</Button>
      </div>
      <ul className="divide-y divide-border">
        {formats.map((f, i) => (
          <li key={f.id} className={"flex items-center gap-3 py-3 " + (f.active ? "" : "opacity-60")}>
            <div className="flex flex-col">
              <button type="button" aria-label="Move up" disabled={i === 0 || pending} onClick={() => move(f.id, "up")} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><Icon name="keyboard_arrow_up" className="!text-[20px]" /></button>
              <button type="button" aria-label="Move down" disabled={i === formats.length - 1 || pending} onClick={() => move(f.id, "down")} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><Icon name="keyboard_arrow_down" className="!text-[20px]" /></button>
            </div>
            <button type="button" onClick={() => setOpen(f)} className="-my-1 flex min-w-0 flex-1 items-center gap-4 rounded-xl px-2 py-2 text-left hover:bg-subtle">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-5">{f.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{formatSize(f)}{f.dpi ? ` · ${f.dpi} dpi` : ""} · {FRAMES.find((x) => x.value === f.frame)?.label ?? f.frame}{f.class === "print" ? ` · bleed ${f.bleed_in ?? 0} in` : (f.safe_top || f.safe_bottom || f.safe_left || f.safe_right) ? ` · safe ${f.safe_top}/${f.safe_right}/${f.safe_bottom}/${f.safe_left} px` : ""}</p>
              </div>
              <div className="hidden items-center gap-1.5 sm:flex">
                <StateBadge state={f.class === "print" ? "in_review" : "requested"} label={f.class === "print" ? "Print" : "Digital"} />
                <span className="text-xs text-muted-foreground">{f.allowed_mimes.map((m) => m.split("/")[1].toUpperCase().replace("JPEG", "JPG")).join(" · ")}</span>
                {!f.active && <StateBadge state="na" label="Inactive" />}
              </div>
              <Icon name="chevron_right" className="shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <FormatSheet format={open} onClose={() => setOpen(null)} />
    </>
  );
}

function FormatSheet({ format, onClose }: { format: Format | "new" | null; onClose: () => void }) {
  const f = format === "new" ? null : format;
  const [pending, start] = useTransition();
  const [cls, setCls] = useState<"digital" | "print">(f?.class ?? "digital");
  const [custom, setCustom] = useState(f?.allow_custom_size ?? false);
  const [active, setActive] = useState(f?.active ?? true);
  const router = useRouter();
  return (
    <Sheet open={!!format} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
        {format && (
          <form key={f?.id ?? "new"} className="flex h-full flex-col" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await saveFormat(fd); toast.success(f ? "Format saved" : "Format added"); onClose(); router.refresh(); } catch (err) { toast.error((err as Error).message); } }); }}>
            {f && <input type="hidden" name="id" value={f.id} />}
            <input type="hidden" name="class" value={cls} />
            <input type="hidden" name="allow_custom_size" value={custom ? "on" : "off"} />
            <input type="hidden" name="active" value={active ? "on" : "off"} />
            <SheetHeader className="px-6 pt-6"><SheetTitle className="text-lg">{f ? f.name : "New format"}</SheetTitle><SheetDescription>{f ? `Key ${f.key}. Changes apply to future uploads; existing versions keep their files.` : "Added to the catalog and, as N/A, to every open event."}</SheetDescription></SheetHeader>
            <div className="flex-1 space-y-6 px-6 py-6">
              <div className="space-y-2"><Label htmlFor="f-name">Name</Label><Input id="f-name" name="name" required defaultValue={f?.name ?? ""} placeholder="IG Post" /></div>
              <div className="space-y-2"><Label>Kind</Label><ChoiceChips name="class_choice" defaultValue={cls} onChange={(v) => setCls(v[0] === "print" ? "print" : "digital")} options={[{ value: "digital", label: "Digital" }, { value: "print", label: "Print" }]} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Size</Label><label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={custom} onCheckedChange={setCustom} />Custom per event</label></div>
                {!custom && (
                  <div className="grid grid-cols-[1fr_1fr_96px] gap-2">
                    <Input name="width" type="number" step="any" min="0" required defaultValue={f?.width ?? ""} placeholder="W" aria-label="Width" />
                    <Input name="height" type="number" step="any" min="0" required defaultValue={f?.height ?? ""} placeholder="H" aria-label="Height" />
                    <SelectField key={f ? "unit" : cls} name="unit" defaultValue={f?.unit ?? (cls === "print" ? "in" : "px")}><option value="px">px</option><option value="in">in</option></SelectField>
                  </div>
                )}
                {custom && <p className="text-sm text-muted-foreground">The width and height are typed in when the event is set up (like the LED wall).</p>}
              </div>
              {cls === "print" ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2"><Label htmlFor="f-dpi">DPI</Label><Input id="f-dpi" name="dpi" type="number" defaultValue={f?.dpi ?? 300} /></div>
                  <div className="space-y-2"><Label htmlFor="f-bleed">Bleed, in</Label><Input id="f-bleed" name="bleed_in" type="number" step="0.01" defaultValue={f?.bleed_in ?? 0.25} /></div>
                  <div className="space-y-2"><Label htmlFor="f-safe">Safe, in</Label><Input id="f-safe" name="safe_margin_in" type="number" step="0.01" defaultValue={f?.safe_margin_in ?? 0.25} /></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Safe area, px from each edge</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["top", "right", "bottom", "left"] as const).map((k) => <div key={k}><Input name={`safe_${k}`} type="number" min="0" defaultValue={f?.[`safe_${k}`] ?? 0} aria-label={`Safe ${k}`} /><p className="mt-1 text-center text-xs capitalize text-muted-foreground">{k}</p></div>)}
                  </div>
                  <p className="text-sm text-muted-foreground">Artwork may extend into these bands, but text, murti and logos should stay out of them.</p>
                </div>
              )}
              <div className="space-y-2"><Label htmlFor="f-frame">Preview frame</Label><SelectField key={f ? "frame" : cls} id="f-frame" name="frame" defaultValue={f?.frame ?? (cls === "print" ? "print" : "flat")}>{FRAMES.map((x) => <option key={x.value} value={x.value}>{x.label} · {x.hint}</option>)}</SelectField></div>
              <div className="space-y-2"><Label>Accepted files</Label><ChoiceChips key={f ? "mime" : cls} name="mime" multiple size="sm" defaultValue={f?.allowed_mimes ?? (cls === "print" ? ["image/png", "image/jpeg", "application/pdf"] : ["image/png", "image/jpeg", "image/webp", "image/gif"])} options={MIMES} /></div>
              <div className="space-y-2"><Label htmlFor="f-notes">Notes for designers</Label><Input id="f-notes" name="notes" defaultValue={f?.notes ?? ""} placeholder="Where it is used, anything to watch for" /></div>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <span><span className="block text-sm font-medium">Active</span><span className="block text-sm text-muted-foreground">Inactive formats stay on old events but are left out of new ones.</span></span>
                <Switch checked={active} onCheckedChange={setActive} />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : f ? "Save changes" : "Add format"}</Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
