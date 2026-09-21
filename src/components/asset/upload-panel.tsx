"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { createClient } from "@/lib/supabase/client";
import { createUploadUrl, finalizeUpload } from "@/app/actions/uploads";

export function UploadPanel({ slotId, accept, isPrint, nextNumber, compact }: { slotId: string; accept: string[]; isPrint: boolean; nextNumber: number; compact?: boolean }) {
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
      const done = await finalizeUpload(slotId, start.path, file.type, side);
      if ("error" in done) throw new Error(done.error);
      toast.success(`Version ${done.number} is in review`);
      router.refresh();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); if (input.current) input.current.value = ""; }
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "rounded-2xl border border-dashed border-border p-5 text-center"}>
      <input ref={input} type="file" accept={accept.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
      {isPrint && (
        <div className="mb-3 inline-flex rounded-full bg-muted p-1 text-xs font-medium">
          {(["front", "back"] as const).map((s) => <button key={s} type="button" onClick={() => setSide(s)} className={"rounded-full px-3 py-1 capitalize " + (side === s ? "bg-card shadow-sm" : "text-muted-foreground")}>{s}</button>)}
        </div>
      )}
      <Button onClick={() => input.current?.click()} disabled={!!busy} size={compact ? "default" : "lg"} className={compact ? "" : "h-11 rounded-[10px] px-5"}>
        <Icon name="upload" />{busy ?? (isPrint && side === "back" ? "Upload back" : `Upload version ${nextNumber}`)}
      </Button>
      {!compact && <p className="mt-3 text-xs text-muted-foreground">{accept.map((m) => m.split("/")[1].toUpperCase()).join(", ")} up to 8 MB. It is optimised once and shown with a DRAFT watermark until approved.</p>}
    </div>
  );
}
