"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SelectField } from "@/components/ui/select-field";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { StateBadge } from "@/components/state-badge";
import { Icon } from "@/components/material-icon";
import { formatSize } from "@/lib/labels";
import { AspectIcon } from "@/components/aspect-icon";
import { ratioOf, ratioLabel } from "@/lib/aspect";
import { saveFormat, removeFormat } from "@/app/actions/formats";
import type { Format } from "@/lib/types";
import { errorMessage } from "@/lib/user-error";

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
  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">Every new event starts with all active formats. A new format is added to open events as N/A so nothing changes until someone requests it.</p>
        <Button onClick={() => setOpen("new")} className="self-start sm:shrink-0"><Icon name="add" className="!text-[18px]" />Add format</Button>
      </div>
      <ul className="divide-y divide-border">
        {formats.map((f) => (
          <li key={f.id} className={"flex items-center gap-3 py-3 " + (f.active ? "" : "opacity-60")}>
            <button type="button" onClick={() => setOpen(f)} className="-my-1 flex min-w-0 flex-1 items-center gap-4 rounded-xl px-2 py-2 text-left hover:bg-subtle">
              <AspectIcon ratio={f.allow_custom_size ? null : ratioOf(f.width, f.height)} box={22} />
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
      {/* Keyed by format so each one opens with its own values (the panel keeps state; without the key it kept the last one's). */}
      <FormatPanel key={open === "new" ? "new" : open?.id ?? "closed"} format={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** Defaults for a kind of format. A format keeps its own saved values while it stays the kind it is; switching kind starts from these. */
const DEFAULTS = {
  digital: { unit: "px", frame: "flat", mimes: ["image/png", "image/jpeg", "image/webp", "image/gif"] },
  print: { unit: "in", frame: "print", mimes: ["image/png", "image/jpeg", "application/pdf"] },
} as const;

function FormatPanel({ format, onClose }: { format: Format | "new" | null; onClose: () => void }) {
  const f = format === "new" ? null : format;
  const [pending, start] = useTransition();
  const [cls, setCls] = useState<"digital" | "print">(f?.class ?? "digital");
  const own = f && f.class === cls ? f : null;
  const [custom, setCustom] = useState(f?.allow_custom_size ?? false);
  const [active, setActive] = useState(f?.active ?? true);
  // Sizes in whole feet open as feet (a 24 × 72 in poster is 2 × 6 ft); everything else in its own unit.
  const inFeet = !!f && f.unit === "in" && !!f.width && !!f.height && f.width % 12 === 0 && f.height % 12 === 0;
  const [unit, setUnit] = useState<"px" | "in" | "ft">(inFeet ? "ft" : f?.unit ?? DEFAULTS[f?.class ?? "digital"].unit);
  const shown = (v: number | null | undefined) => (v == null ? "" : String(inFeet ? v / 12 : v));
  const [dims, setDims] = useState({ w: shown(f?.width), h: shown(f?.height) });
  const ratio = ratioOf(Number(dims.w), Number(dims.h));
  const [askRemove, setAskRemove] = useState(false);
  const router = useRouter();
  const changeKind = (k: "digital" | "print") => { setCls(k); setUnit(f && f.class === k ? (inFeet ? "ft" : f.unit) : DEFAULTS[k].unit); };
  const remove = () => start(async () => { try { const r = await removeFormat(f!.id); toast.success(`${f!.name} removed${r.turnedOff ? ` · turned off in ${r.turnedOff} project${r.turnedOff === 1 ? "" : "s"}` : ""}`); setAskRemove(false); onClose(); router.refresh(); } catch (err) { setAskRemove(false); toast.error(errorMessage(err)); } });
  return (
    <>
    <Dialog open={!!format} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[520px]">
        {format && (
          <form key={f?.id ?? "new"} className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { try { await saveFormat(fd); toast.success(f ? "Format saved" : "Format added"); onClose(); router.refresh(); } catch (err) { toast.error(errorMessage(err)); } }); }}>
            {f && <input type="hidden" name="id" value={f.id} />}
            <input type="hidden" name="class" value={cls} />
            <input type="hidden" name="allow_custom_size" value={custom ? "on" : "off"} />
            <input type="hidden" name="active" value={active ? "on" : "off"} />
            <DialogHeader className="border-b border-border px-6 py-5 text-left"><DialogTitle className="text-lg">{f ? f.name : "New format"}</DialogTitle><DialogDescription>{f ? `Key ${f.key}. Changes apply to future uploads; existing versions keep their files.` : "Added to the catalog and, as N/A, to every open event."}</DialogDescription></DialogHeader>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
              <div className="space-y-2"><Label htmlFor="f-name">Name</Label><Input id="f-name" name="name" required defaultValue={f?.name ?? ""} placeholder="IG Post" /></div>
              <div className="space-y-2"><Label>Kind</Label><ChoiceChips name="class_choice" defaultValue={cls} onChange={(v) => changeKind(v[0] === "print" ? "print" : "digital")} options={[{ value: "digital", label: "Digital" }, { value: "print", label: "Print" }]} /></div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><Label>Size</Label><label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={custom} onCheckedChange={setCustom} />Custom per event</label></div>
                {!custom && (
                  <div className="grid grid-cols-[1fr_1fr_96px] gap-2">
                    <Input name="width" type="number" step="any" min="0" required defaultValue={shown(f?.width)} onChange={(e) => setDims((d) => ({ ...d, w: e.target.value }))} placeholder="W" aria-label="Width" />
                    <Input name="height" type="number" step="any" min="0" required defaultValue={shown(f?.height)} onChange={(e) => setDims((d) => ({ ...d, h: e.target.value }))} placeholder="H" aria-label="Height" />
                    <SelectField name="unit" value={unit} onChange={(e) => setUnit(e.target.value as "px" | "in" | "ft")}><option value="px">px</option><option value="in">in</option><option value="ft">ft</option></SelectField>
                  </div>
                )}
                {!custom && <p className="flex items-center gap-2 text-sm text-muted-foreground"><AspectIcon ratio={ratio} box={22} />{ratio ? <>Shape {ratioLabel(ratio)}. Drawn from the size.{unit === "ft" ? ` In inches: ${+(Number(dims.w) * 12).toFixed(3)} × ${+(Number(dims.h) * 12).toFixed(3)}.` : ""}</> : "Type a width and height to see its shape."}</p>}
                {custom && <p className="text-sm text-muted-foreground">The width and height are typed in when the event is set up (like the LED wall).</p>}
              </div>
              {cls === "print" ? (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2"><Label htmlFor="f-dpi">DPI</Label><Input id="f-dpi" name="dpi" type="number" defaultValue={own?.dpi ?? 300} /></div>
                  <div className="space-y-2"><Label htmlFor="f-bleed">Bleed, in</Label><Input id="f-bleed" name="bleed_in" type="number" step="any" min="0" defaultValue={own?.bleed_in ?? 0.125} /></div>
                  <div className="space-y-2"><Label htmlFor="f-safe">Safe, in</Label><Input id="f-safe" name="safe_margin_in" type="number" step="any" min="0" defaultValue={own?.safe_margin_in ?? 0.25} /></div>
                </div>
              ) : null}
              {cls === "print" ? (
                <p className="text-sm text-muted-foreground">Bleed and safe margin are per format, so each print piece can have its own. Width and height are the file size including bleed on every side; the guides show trim (bleed in from the edge) and the safe area (safe margin in from trim).</p>
              ) : (
                <div className="space-y-2">
                  <Label>Safe area, px from each edge</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {(["top", "right", "bottom", "left"] as const).map((k) => <div key={k}><Input name={`safe_${k}`} type="number" min="0" defaultValue={own?.[`safe_${k}`] ?? 0} aria-label={`Safe ${k}`} /><p className="mt-1 text-center text-xs capitalize text-muted-foreground">{k}</p></div>)}
                  </div>
                  <p className="text-sm text-muted-foreground">Artwork may extend into these bands, but text, murti and logos should stay out of them.</p>
                </div>
              )}
              <div className="space-y-2"><Label htmlFor="f-frame">Preview frame</Label><SelectField key={cls} id="f-frame" name="frame" defaultValue={own?.frame ?? DEFAULTS[cls].frame}>{FRAMES.map((x) => <option key={x.value} value={x.value}>{x.label} · {x.hint}</option>)}</SelectField></div>
              <div className="space-y-2"><Label>Accepted files</Label><ChoiceChips key={cls} name="mime" multiple size="sm" defaultValue={own?.allowed_mimes ?? [...DEFAULTS[cls].mimes]} options={MIMES} /></div>
              <div className="space-y-2"><Label htmlFor="f-notes">Notes for designers</Label><Input id="f-notes" name="notes" defaultValue={f?.notes ?? ""} placeholder="Where it is used, anything to watch for" /></div>
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <span><span className="block text-sm font-medium">Active</span><span className="block text-sm text-muted-foreground">Inactive formats stay on old events but are left out of new ones.</span></span>
                <Switch checked={active} onCheckedChange={setActive} />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              {f && <Button type="button" variant="ghost" className="mr-auto text-destructive-text" onClick={() => setAskRemove(true)}>Remove</Button>}
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending ? "Saving…" : f ? "Save changes" : "Add format"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={askRemove} onOpenChange={setAskRemove}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Remove {f?.name}?</DialogTitle><DialogDescription>It disappears from Settings and from every project&apos;s format list. Projects that requested it but have no design for it yet will have it turned off. If any project has designs in it, it can&apos;t be removed; use Inactive instead.</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-2">
          <Button size="lg" variant="destructive" disabled={pending} onClick={remove}>{pending ? "Removing…" : "Remove format"}</Button>
          <Button size="lg" variant="outline" onClick={() => setAskRemove(false)}>Keep it</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
