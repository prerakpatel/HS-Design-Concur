"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { createClient } from "@/lib/supabase/client";
import { createUploadUrl } from "@/app/actions/uploads";

export interface UploadTarget { side: "front" | "back"; replaceVersionId: string | null }

/** Hidden file input + the upload flow. Renders a single Upload button; `openWith` lets a menu start a replace or back-side upload. */
export function UploadPanel({ slotId, accept, isPrint, nextNumber, variant = "button", label, compactOnPhone, className }: { slotId: string; accept: string[]; isPrint: boolean; nextNumber: number; variant?: "button" | "dropzone" | "pill"; label?: string; compactOnPhone?: boolean; className?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [target, setTarget] = useState<UploadTarget>({ side: "front", replaceVersionId: null });
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handle(file: File) {
    setBusy("Uploading…");
    try {
      const start = await createUploadUrl(slotId, file.name, file.type, file.size);
      if ("error" in start) throw new Error(start.error);
      const { error } = await createClient().storage.from("assets").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      setBusy("Optimising…");
      const res = await fetch("/api/uploads/finalize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slotId, tmpPath: start.path, mime: file.type, side: target.side, replaceVersionId: target.replaceVersionId }) });
      const done = await res.json().catch(() => ({ error: `Processing failed (${res.status})` })) as { error?: string; number?: number };
      if (!res.ok || done.error) throw new Error(done.error ?? `Processing failed (${res.status})`);
      toast.success(target.replaceVersionId ? `Version ${done.number} replaced · back in review` : target.side === "back" ? "Back side added" : `Version ${done.number} is in review`);
      router.refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); setTarget({ side: "front", replaceVersionId: null }); if (input.current) input.current.value = ""; }
  }
  const openWith = (t: UploadTarget) => { setTarget(t); input.current?.click(); };

  return (
    <div className={variant === "dropzone" ? "rounded-2xl border border-dashed border-border p-6 text-center" : "contents"} data-upload-panel>
      <input ref={input} type="file" accept={accept.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <Button onClick={() => openWith({ side: "front", replaceVersionId: null })} disabled={!!busy} size={variant === "dropzone" ? "lg" : "default"} variant={variant === "pill" || variant === "dropzone" ? "default" : "secondary"} className={className} aria-label={compactOnPhone ? (label ?? "Upload") : undefined}>
        <Icon name="upload" /><span className={compactOnPhone && !busy ? "hidden sm:inline" : undefined}>{busy ?? label ?? (nextNumber === 1 ? "Upload design" : "Upload new version")}</span>
      </Button>
      {variant === "dropzone" && <p className="mt-3 text-xs text-muted-foreground">{accept.map((m) => m.split("/")[1].toUpperCase().replace("JPEG", "JPG")).join(", ")} up to 8 MB. Shown with a DRAFT mark until approved.{isPrint && accept.includes("application/pdf") ? " A two-page PDF fills Front and Back at once." : ""}</p>}
      <UploadBridge openWith={openWith} />
    </div>
  );
}

/** Lets a sibling menu (version ⋯) start a replace / back-side upload through this panel. */
function UploadBridge({ openWith }: { openWith: (t: UploadTarget) => void }) {
  if (typeof window !== "undefined") (window as unknown as { __dcUpload?: (t: UploadTarget) => void }).__dcUpload = openWith;
  return null;
}
export function requestUpload(t: UploadTarget) { (window as unknown as { __dcUpload?: (t: UploadTarget) => void }).__dcUpload?.(t); }
