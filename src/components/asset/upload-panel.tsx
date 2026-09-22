"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { createClient } from "@/lib/supabase/client";
import { createUploadUrl } from "@/app/actions/uploads";

export function UploadPanel({ slotId, accept, isPrint, nextNumber, compact, needsBack }: { slotId: string; accept: string[]; isPrint: boolean; nextNumber: number; compact?: boolean; needsBack?: boolean }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handle(file: File) {
    setBusy("Uploading…");
    try {
      const start = await createUploadUrl(slotId, file.name, file.type, file.size);
      if ("error" in start) throw new Error(start.error);
      const { error } = await createClient().storage.from("assets").uploadToSignedUrl(start.path, start.token, file, { contentType: file.type });
      if (error) throw new Error(error.message);
      setBusy("Optimising and watermarking…");
      const res = await fetch("/api/uploads/finalize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slotId, tmpPath: start.path, mime: file.type, side }) });
      const done = await res.json().catch(() => ({ error: `Processing failed (${res.status})` })) as { error?: string; number?: number };
      if (!res.ok || done.error) throw new Error(done.error ?? `Processing failed (${res.status})`);
      toast.success(`Version ${done.number} is in review`);
      router.refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); if (input.current) input.current.value = ""; }
  }

  return (
    <div className={compact ? "flex flex-wrap items-center gap-2" : "rounded-2xl border border-dashed border-border p-5 text-center"}>
      <input ref={input} type="file" accept={accept.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      <Button onClick={() => { setSide("front"); input.current?.click(); }} disabled={!!busy} size={compact ? "default" : "lg"}>
        <Icon name="upload" />{busy ?? (isPrint && !compact ? `Upload version ${nextNumber} (front, or a 2-page PDF)` : `Upload version ${nextNumber}`)}
      </Button>
      {isPrint && needsBack && <Button variant="secondary" onClick={() => { setSide("back"); input.current?.click(); }} disabled={!!busy}><Icon name="flip" />Add back side</Button>}
      {!compact && <p className="mt-3 text-xs text-muted-foreground">{accept.map((m) => m.split("/")[1].toUpperCase().replace("JPEG", "JPG")).join(", ")} up to 8 MB. It is optimised once and shown with a DRAFT watermark until approved.{isPrint && accept.includes("application/pdf") ? " A PDF with two pages fills Front and Back in one go." : ""}</p>}
    </div>
  );
}
