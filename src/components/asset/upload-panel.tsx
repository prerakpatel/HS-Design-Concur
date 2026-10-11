"use client";
import { useRef, useState, useSyncExternalStore, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { cn } from "@/lib/utils";
import { createUploadUrl } from "@/app/actions/uploads";
import { errorMessage } from "@/lib/user-error";

export interface UploadTarget { side: "front" | "back"; replaceVersionId: string | null }

/** Hidden file input + the upload flow. Renders a single Upload button; `openWith` lets a menu start a replace or back-side upload. */
export function UploadPanel({ slotId, accept, isPrint, nextNumber, variant = "button", label, compactOnPhone, className }: { slotId: string; accept: string[]; isPrint: boolean; nextNumber: number; variant?: "button" | "dropzone" | "pill"; label?: string; compactOnPhone?: boolean; className?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  // Progress lives in a small shared store: the drop zone / design overlay shows it inside the section.
  const setProgress = (next: Progress | null | ((p: Progress | null) => Progress | null)) => uploadState.set(typeof next === "function" ? next(uploadState.get()) : next);
  const xhr = useRef<XMLHttpRequest | null>(null);
  const [target, setTarget] = useState<UploadTarget>({ side: "front", replaceVersionId: null });
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handle(file: File, t: UploadTarget = target) {
    if (busy) return;
    if (accept.length && !accept.includes(file.type)) { toast.error(`${file.name} isn't a supported file. Use ${typesLabel(accept)}.`); return; }
    setBusy("Uploading…"); setProgress({ name: file.name, phase: "upload", pct: 0 });
    try {
      const start = await createUploadUrl(slotId, file.name, file.type, file.size);
      if ("error" in start) throw new Error(start.error);
      await putWithProgress(start.path, start.token, file, xhr, (pct) => setProgress((p) => p && { ...p, pct }));
      setBusy("Optimising…"); setProgress((p) => p && { ...p, phase: "optimise", pct: 100 });
      const res = await fetch("/api/uploads/finalize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slotId, tmpPath: start.path, mime: file.type, side: t.side, replaceVersionId: t.replaceVersionId }) });
      const done = await res.json().catch(() => ({ error: `Processing failed (${res.status})` })) as { error?: string; number?: number };
      if (!res.ok || done.error) throw new Error(done.error ?? `Processing failed (${res.status})`);
      setProgress({ name: t.replaceVersionId ? `Version ${done.number} replaced` : t.side === "back" ? "Back side added" : `Version ${done.number} uploaded`, phase: "done", pct: 100 });
      setTimeout(() => setProgress((p) => (p?.phase === "done" ? null : p)), 2400);
      router.refresh();
    } catch (e) {
      setProgress(null);
      if ((e as Error).name !== "AbortError") toast.error(errorMessage(e));
    }
    finally { xhr.current = null; setBusy(null); setTarget({ side: "front", replaceVersionId: null }); if (input.current) input.current.value = ""; }
  }
  const openWith = (t: UploadTarget) => { setTarget(t); input.current?.click(); };

  const bridge = <><input ref={input} type="file" accept={accept.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
    <UploadBridge openWith={openWith} drop={(f) => handle(f, { side: "front", replaceVersionId: null })} />
    <CancelBridge cancel={() => xhr.current?.abort()} /></>;

  // Empty format: the whole section is the drop target, Dropbox-style.
  if (variant === "dropzone") return (
    <DropSurface fill onFile={(f) => handle(f, { side: "front", replaceVersionId: null })} className="mt-4 min-h-[calc(100dvh-270px)] md:min-h-[calc(100dvh-170px)]">
      {(dragging) => <>
        <p className="mt-7 text-base font-medium">{dragging ? "Drop to upload" : busy ? "Uploading your design" : <><span className="md:hidden">Add your design</span><span className="max-md:hidden">Drop your design here</span></>}</p>
        {busy ? <div className="mt-5 flex w-full justify-center"><UploadStatus /></div> : <>
          <p className="mt-1 text-sm text-muted-foreground max-md:hidden">or</p>
          <Button onClick={() => openWith({ side: "front", replaceVersionId: null })} size="lg" className="mt-3"><Icon name="upload" />{label ?? "Upload design"}</Button>
        </>}
        <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground">{typesLabel(accept)} up to 8 MB. Shown with a DRAFT mark until approved. Nobody is notified until you send it for review.{isPrint && accept.includes("application/pdf") ? " A two-page PDF fills Front and Back at once." : ""}</p>
        {bridge}
      </>}
    </DropSurface>
  );

  return (
    <div className="contents" data-upload-panel>
      <Button onClick={() => openWith({ side: "front", replaceVersionId: null })} disabled={!!busy} variant={variant === "pill" ? "default" : "secondary"} className={className} aria-label={compactOnPhone ? (label ?? "Upload") : undefined}>
        <Icon name="upload" /><span className={compactOnPhone && !busy ? "hidden sm:inline" : undefined}>{busy ?? label ?? (nextNumber === 1 ? "Upload design" : "Upload new version")}</span>
      </Button>
      {bridge}
    </div>
  );
}

interface Progress { name: string; phase: "upload" | "optimise" | "done"; pct: number }
const typesLabel = (accept: string[]) => accept.map((m) => m.split("/")[1].toUpperCase().replace("JPEG", "JPG")).join(", ");

/** PUT to the signed storage URL with XHR (fetch has no upload progress). Same request supabase-js makes. */
function putWithProgress(path: string, token: string, file: File, ref: { current: XMLHttpRequest | null }, onPct: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/assets/${path}?token=${encodeURIComponent(token)}`;
    const body = new FormData(); body.append("cacheControl", "3600"); body.append("", file);
    const x = new XMLHttpRequest(); ref.current = x;
    x.open("PUT", url);
    x.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
    x.setRequestHeader("x-upsert", "false");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => x.status < 300 ? resolve() : reject(new Error(uploadError(x.responseText, x.status)));
    x.onerror = () => reject(new Error("The upload didn't go through. Check your connection and try again."));
    x.onabort = () => reject(Object.assign(new Error("Upload cancelled"), { name: "AbortError" }));
    x.send(body);
  });
}
function uploadError(text: string, status: number) { try { return (JSON.parse(text) as { message?: string }).message ?? `Upload failed (${status})`; } catch { return `Upload failed (${status})`; } }

/** Thin progress strip shown inside the drop zone / design overlay: file name, bar, ✕ while uploading; "Done" when finished. */
export function UploadProgress({ p, cancel }: { p: Progress; cancel: () => void }) {
  return (
    <div role="status" aria-live="polite" className="animate-nudge pointer-events-auto w-[min(100%,22rem)] overflow-hidden rounded-xl bg-inverse-surface text-left text-inverse-on-surface shadow-lg">
      <div className="flex h-11 items-center gap-2.5 pl-4 pr-1.5 text-sm">
        <Icon name={p.phase === "done" ? "check_circle" : "upload"} className={cn("!text-[18px]", p.phase === "done" && "text-success")} />
        <span className="min-w-0 flex-1 truncate">{p.phase === "done" ? <><span className="font-medium">Done</span> · {p.name}</> : p.phase === "optimise" ? "Optimising…" : <>{p.name}</>}</span>
        {p.phase === "upload" && <span className="tabular-nums text-xs opacity-70">{p.pct}%</span>}
        {p.phase === "upload" ? <button type="button" onClick={cancel} aria-label="Cancel upload" className="flex size-8 items-center justify-center rounded-full hover:bg-white/10"><Icon name="close" className="!text-[18px]" /></button> : <span className="w-1.5" />}
      </div>
      <div className="h-[3px] bg-white/10"><div className={cn("h-full bg-info transition-[width] duration-200", p.phase === "optimise" && "animate-pulse")} style={{ width: `${p.pct}%` }} /></div>
    </div>
  );
}

/** Upload progress shared with the drop zone and design overlay, which show it inside the section. */
const uploadState = (() => {
  let v: Progress | null = null; const subs = new Set<() => void>();
  return { get: () => v, set: (n: Progress | null) => { v = n; subs.forEach((f) => f()); }, sub: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; } };
})();
const useUploadProgress = () => useSyncExternalStore(uploadState.sub, uploadState.get, () => null);
let cancelUpload: () => void = () => {};
function CancelBridge({ cancel }: { cancel: () => void }) { cancelUpload = cancel; return null; }
function UploadStatus() { const p = useUploadProgress(); return p ? <UploadProgress p={p} cancel={() => cancelUpload()} /> : null; }

/**
 * Drag-and-drop target. `fill`: the zone is always visible (empty format). Otherwise it wraps the
 * design section and appears only while a file is dragged over it, or while that upload runs.
 * Dashed border marches while dragging and turns colour on hover; the paper stack piles up.
 */
function DropSurface({ fill, enabled = true, onFile, className, label, children }: { fill?: boolean; enabled?: boolean; onFile: (f: File) => void; className?: string; label?: string; children: ReactNode | ((dragging: boolean) => ReactNode) }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const progress = useUploadProgress();
  const busy = !!progress;
  const isFiles = (e: DragEvent) => enabled && e.dataTransfer.types.includes("Files");
  const showOverlay = !fill && enabled && (over || busy);
  return (
    <div className={cn("group/drop relative", fill && "flex flex-col items-center justify-center rounded-3xl px-6 py-10 text-center transition-colors", fill && over && "bg-info-soft/60", className)}
      onDragEnter={(e) => { if (!isFiles(e)) return; e.preventDefault(); depth.current++; setOver(true); }}
      onDragOver={(e) => { if (!isFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={(e) => { if (!isFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); }}
      onDrop={(e) => { if (!isFiles(e)) return; e.preventDefault(); depth.current = 0; setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}>
      {fill && <Ants active={over} />}
      {fill && <PaperStack moving={over || (busy && progress?.phase !== "done")} />}
      {typeof children === "function" ? children(over) : children}
      {showOverlay && (
        <div className="pointer-events-none absolute -inset-2 z-20 flex flex-col items-center justify-center rounded-3xl bg-info-soft/85 backdrop-blur-[2px]">
          <Ants active />
          <PaperStack moving={over || progress?.phase !== "done"} />
          {over || !progress
            ? <p className="mt-6 text-base font-medium text-info-text">{label ?? "Drop to upload a new version"}</p>
            : <div className="mt-6 flex w-full justify-center px-4"><UploadStatus /></div>}
        </div>
      )}
    </div>
  );
}

/** The design section of a format page: drop a file anywhere on it to upload a new version. */
export function UploadDropArea({ children, enabled = true, label, className }: { children: ReactNode; enabled?: boolean; label?: string; className?: string }) {
  return <DropSurface enabled={enabled} label={label} onFile={dropFile} className={className}>{children}</DropSurface>;
}

/** Dashed outline drawn in SVG so the dashes can march. Colour on hover, brighter and moving while dragging. */
function Ants({ active }: { active: boolean }) {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
      <rect width="100%" height="100%" rx="24" fill="none" strokeDasharray="8 6" vectorEffect="non-scaling-stroke"
        className={cn("transition-[stroke]", active ? "drop-ants stroke-info stroke-2" : "stroke-foreground/20 stroke-[1.5] group-hover/drop:stroke-info")} />
    </svg>
  );
}

/** Three generic pages, fanned. While a file is dragged or uploading they drop in one by one and pile up, then repeat. */
function PaperStack({ moving }: { moving: boolean }) {
  const pages: { r: number; x: number; body: ReactNode }[] = [
    { r: -12, x: -18, body: <><span className="block h-[38%] rounded-[3px] bg-brand-soft" /><span className="mt-2 block h-1 w-4/5 rounded-full bg-muted-strong" /><span className="mt-1 block h-1 w-3/5 rounded-full bg-muted-strong" /></> },
    { r: 9, x: 18, body: <>{[90, 70, 85, 60, 75].map((w) => <span key={w} className="mb-1.5 block h-1 rounded-full bg-muted-strong" style={{ width: `${w}%` }} />)}</> },
    { r: -2, x: 0, body: <><span className="flex h-[52%] items-center justify-center rounded-[3px] bg-info-soft"><span className="size-4 rounded-full bg-info/40" /></span><span className="mt-2 block h-1 w-3/4 rounded-full bg-muted-strong" /><span className="mt-1 block h-1 w-1/2 rounded-full bg-muted-strong" /></> },
  ];
  return (
    <div aria-hidden className="relative h-24 w-28">
      {pages.map((p, i) => (
        <div key={i} className={cn("absolute left-1/2 top-1/2 h-[84px] w-16 rounded-md bg-card p-2 shadow-[0_2px_8px_-2px_rgba(0,0,0,.18)] ring-1 ring-black/5", moving && "paper-pile")}
          style={{ ["--r" as string]: `${p.r}deg`, ["--x" as string]: `${p.x}px`, transform: `translate(calc(-50% + var(--x)), -50%) rotate(var(--r))`, animationDelay: `${i * 0.35}s` }}>
          {p.body}
        </div>
      ))}
    </div>
  );
}

type Bridge = { __dcUpload?: (t: UploadTarget) => void; __dcDrop?: (f: File) => void };
/** Lets a sibling menu (version ⋯) start a replace / back-side upload, and the drop area hand over a file, through this panel. */
function UploadBridge({ openWith, drop }: { openWith: (t: UploadTarget) => void; drop: (f: File) => void }) {
  if (typeof window !== "undefined") { (window as unknown as Bridge).__dcUpload = openWith; (window as unknown as Bridge).__dcDrop = drop; }
  return null;
}
export function requestUpload(t: UploadTarget) { (window as unknown as Bridge).__dcUpload?.(t); }
function dropFile(f: File) { (window as unknown as Bridge).__dcDrop?.(f); }
