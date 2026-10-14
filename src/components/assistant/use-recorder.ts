"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_CLIP_SECONDS } from "@/config/assistant";

export type RecorderState = "idle" | "listening" | "transcribing";

interface SpeechRecognitionLike { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null }
const browserSpeech = (): (new () => SpeechRecognitionLike) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/**
 * Hold to talk. With a transcription service set up (`cloud`), the microphone is recorded and the clip sent to
 * /api/assistant/transcribe; without one, the browser's own speech recognition listens and the words appear as
 * they are said. `level` is the microphone's loudness (0–1) for the character's pulse.
 */
export function useRecorder(cloud: boolean, keyterms: string[]) {
  const [state, setState] = useState<RecorderState>("idle");
  const [level, setLevel] = useState(0);
  const [live, setLive] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const speech = useRef<SpeechRecognitionLike | null>(null);
  const heard = useRef("");
  const stopMeter = useRef<() => void>(() => {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = useRef<((text: string) => void) | null>(null);
  const supported = typeof window !== "undefined" && ((cloud && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") || (!cloud && !!browserSpeech()));

  const meter = async (stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ac = new Ctx(); const src = ac.createMediaStreamSource(stream); const an = ac.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount); let raf = 0;
      const tick = () => { an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) { const d = (v - 128) / 128; sum += d * d; } setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4)); raf = requestAnimationFrame(tick); };
      tick();
      stopMeter.current = () => { cancelAnimationFrame(raf); ac.close().catch(() => {}); setLevel(0); };
    } catch { stopMeter.current = () => setLevel(0); }
  };

  const stop = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (rec.current && rec.current.state !== "inactive") { rec.current.stop(); rec.current = null; return; }
    if (speech.current) { stopMeter.current(); speech.current.stop(); }
  };

  const cancel = () => {
    done.current = null;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (rec.current && rec.current.state !== "inactive") { rec.current.onstop = () => { rec.current = null; stopMeter.current(); setState("idle"); }; rec.current.stop(); }
    if (speech.current) { speech.current.onend = null; speech.current.abort(); speech.current = null; stopMeter.current(); setState("idle"); }
  };

  /** Start listening. Resolves (through `onDone`) with the words once stopped. */
  const start = async (onDone: (text: string) => void, onError: (message: string) => void) => {
    if (state !== "idle") return;
    done.current = onDone; heard.current = ""; setLive("");
    if (cloud) {
      let stream: MediaStream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { onError("The microphone is blocked. Allow it in the browser's site settings, or type instead."); return; }
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m));
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); stopMeter.current();
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        setState("transcribing");
        try {
          const body = new FormData(); body.set("audio", blob, "clip"); body.set("keyterms", keyterms.join("|"));
          const res = await fetch("/api/assistant/transcribe", { method: "POST", body });
          const data = (await res.json()) as { transcript?: string; error?: string };
          if (!res.ok) throw new Error(data.error ?? "Transcription failed");
          setState("idle"); done.current?.(data.transcript ?? "");
        } catch (e) { setState("idle"); onError(e instanceof Error ? e.message : "Transcription failed"); }
      };
      rec.current = r; r.start(); meter(stream); setState("listening");
    } else {
      const Speech = browserSpeech(); if (!Speech) { onError("This browser can't listen. Type instead."); return; }
      const s = new Speech(); s.lang = "en-IN"; s.interimResults = true; s.continuous = true;
      s.onresult = (e) => { let finals = ""; let interim = ""; for (let i = 0; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) finals += t + " "; else interim += t; } heard.current = (finals + interim).trim(); setLive(heard.current); };
      s.onerror = (e) => { if (e.error === "not-allowed") onError("The microphone is blocked. Allow it in the browser's site settings, or type instead."); };
      s.onend = () => { setState("idle"); setLevel(0); const t = heard.current.trim(); speech.current = null; done.current?.(t); };
      speech.current = s; s.start(); setState("listening"); setLevel(0.4);
      navigator.mediaDevices?.getUserMedia?.({ audio: true }).then((st) => { meter(st); const prev = stopMeter.current; stopMeter.current = () => { prev(); st.getTracks().forEach((t) => t.stop()); }; }).catch(() => {});
    }
    timer.current = setTimeout(() => stop(), MAX_CLIP_SECONDS * 1000);
  };

  useEffect(() => () => { if (rec.current?.state === "recording") rec.current.stop(); speech.current?.abort(); }, []);
  return { state, level, live, supported, start, stop, cancel };
}
