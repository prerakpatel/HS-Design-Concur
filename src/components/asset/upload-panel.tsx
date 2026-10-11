"use client";
import { useRef, useState, type DragEvent, type ReactNode } from "react";
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
  const [progress, setProgress] = useState<Progress | null>(null);
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

  return (
    <div className={variant === "dropzone" ? "rounded-2xl border border-dashed border-border p-6 text-center" : "contents"} data-upload-panel>
      <input ref={input} type="file" accept={accept.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <Button onClick={() => openWith({ side: "front", replaceVersionId: null })} disabled={!!busy} size={variant === "dropzone" ? "lg" : "default"} variant={variant === "pill" || variant === "dropzone" ? "default" : "secondary"} className={className} aria-label={compactOnPhone ? (label ?? "Upload") : undefined}>
        <Icon name="upload" /><span className={compactOnPhone && !busy ? "hidden sm:inline" : undefined}>{busy ?? label ?? (nextNumber === 1 ? "Upload design" : "Upload new version")}</span>
      </Button>
      {variant === "dropzone" && <p className="mt-3 text-xs text-muted-foreground">Drop a file here or tap Upload. {typesLabel(accept)} up to 8 MB. Shown with a DRAFT mark until approved. Nobody is notified until you send it for review.{isPrint && accept.includes("application/pdf") ? " A two-page PDF fills Front and Back at once." : ""}</p>}
      <UploadBridge openWith={openWith} drop={(f) => handle(f, { side: "front", replaceVersionId: null })} />
      {progress && <UploadProgress p={progress} cancel={() => xhr.current?.abort()} />}
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

/** Thin floating progress, bottom centre: file name, bar, ✕ while uploading; "Done" when finished. */
export function UploadProgress({ p, cancel }: { p: Progress; cancel: () => void }) {
  return (
    <div role="status" aria-live="polite" className="animate-nudge fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),12px)+80px)] z-40 mx-auto w-[min(calc(100vw-24px),22rem)] overflow-hidden rounded-xl bg-inverse-surface text-inverse-on-surface shadow-lg md:bottom-6">
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

/**
 * Wrap the design viewport: dragging a file over it tints it light blue with a dashed outline and
 * "Drop to upload"; dropping hands the file to the page's UploadPanel. Only files trigger it.
 */
export function UploadDropArea({ children, enabled = true, label = "Drop to upload a new version", className }: { children: ReactNode; enabled?: boolean; label?: string; className?: string }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const isFiles = (e: DragEvent) => enabled && e.dataTransfer.types.includes("Files");
  return (
    <div className={cn("relative", className)}
      onDragEnter={(e) => { if (!isFiles(e)) return; e.preventDefault(); depth.current++; setOver(true); }}
      onDragOver={(e) => { if (!isFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={(e) => { if (!isFiles(e)) return; depth.current = Math.max(0, depth.current - 1); if (depth.current === 0) setOver(false); }}
      onDrop={(e) => { if (!isFiles(e)) return; e.preventDefault(); depth.current = 0; setOver(false); const f = e.dataTransfer.files?.[0]; if (f) dropFile(f); }}>
      {children}
      {over && (
        <div className="pointer-events-none absolute -inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-info bg-info-soft/70 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-info-text shadow-sm"><Icon name="upload" className="!text-[18px]" />{label}</span>
        </div>
      )}
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
