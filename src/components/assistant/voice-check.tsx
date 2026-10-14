"use client";
// icons: mic, stop
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/material-icon";
import { MAX_CLIP_SECONDS } from "@/config/assistant";

interface Result { provider: string; transcript: string; language: string | null; ms: number; error: string | null }

export function VoiceCheck({ enabled }: { enabled: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "sending">("idle");
  const [runs, setRuns] = useState<{ at: string; seconds: number; results: Result[] }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);

  const start = async () => {
    setError(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setError("The microphone is blocked. Allow it in the browser's site settings."); return; }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = []; started.current = Date.now();
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const seconds = Math.round((Date.now() - started.current) / 1000);
      setState("sending");
      try {
        const body = new FormData(); body.set("audio", new Blob(chunks.current, { type: r.mimeType || "audio/webm" }), "clip");
        const res = await fetch("/api/assistant/transcribe?all=1", { method: "POST", body });
        const data = (await res.json()) as { results?: Result[]; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed");
        setRuns((cur) => [{ at: new Date().toLocaleTimeString(), seconds, results: data.results ?? [] }, ...cur]);
      } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
      finally { setState("idle"); }
    };
    rec.current = r; r.start(); setState("recording");
    setTimeout(() => { if (rec.current === r && r.state === "recording") r.stop(); }, MAX_CLIP_SECONDS * 1000);
  };
  const stop = () => { rec.current?.stop(); rec.current = null; };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!enabled || state === "sending"} onClick={state === "recording" ? stop : start} variant={state === "recording" ? "secondary" : "default"}>
          <Icon name={state === "recording" ? "stop" : "mic"} className="!text-[20px]" />{state === "recording" ? "Stop and transcribe" : state === "sending" ? "Transcribing…" : "Record"}
        </Button>
        <p className="text-sm text-muted-foreground">Say something real: “Chirantanbhai ne kaho ke mahaprasad nu spelling check kare, and the text is cut on the sides.”</p>
      </div>
      {error && <p className="rounded-xl bg-warning-soft px-4 py-3 text-sm text-warning-text">{error}</p>}
      {runs.map((run, i) => (
        <section key={i} className="space-y-3 rounded-2xl border border-border p-4">
          <p className="text-xs text-muted-foreground">{run.at} · {run.seconds}s clip</p>
          <div className="grid gap-3 md:grid-cols-2">
            {run.results.map((r) => (
              <div key={r.provider} className="space-y-1 rounded-xl bg-subtle p-3">
                <p className="text-sm font-medium capitalize">{r.provider} <span className="font-normal text-muted-foreground">· {(r.ms / 1000).toFixed(1)}s{r.language ? ` · ${r.language}` : ""}</span></p>
                {r.error ? <p className="text-sm text-warning-text">{r.error}</p> : <p className="text-[15px] leading-6">{r.transcript || <span className="text-muted-foreground">(nothing)</span>}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
