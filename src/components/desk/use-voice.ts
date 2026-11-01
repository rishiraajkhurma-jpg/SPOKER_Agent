"use client";

import { useEffect, useRef, useState } from "react";

import { type Any, api } from "./format";

// Sarvam takes 30 seconds per request, so long dictation is sent as back-to-back 25 second pieces.
const PIECE_MS = 25000;

export function useVoice(opts: { mode: "transcribe" | "translate"; continuous?: boolean; onText: (text: string, lang: string) => void; onError?: (message: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [recording, setRecording] = useState(false);
  const [working, setWorking] = useState(0);
  const latest = useRef(opts); latest.current = opts;
  const rec = useRef<{ stream: MediaStream; recorder?: MediaRecorder; timer?: ReturnType<typeof setTimeout>; keep: boolean } | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { api("/api/voice").then((r) => setEnabled(!!r.enabled)).catch(() => {}); }, []);
  useEffect(() => () => { const s = rec.current; if (s) { s.keep = false; if (s.timer) clearTimeout(s.timer); s.stream.getTracks().forEach((t) => t.stop()); } }, []);

  const upload = (blob: Blob) => {
    setWorking((n) => n + 1);
    // Chained so dictated pieces land in the order they were spoken.
    queue.current = queue.current.then(async () => {
      try {
        const form = new FormData();
        form.append("file", new File([blob], "audio.webm", { type: blob.type || "audio/webm" }));
        form.append("mode", latest.current.mode);
        const res = await fetch("/api/voice", { method: "POST", body: form });
        const j: Any = await res.json().catch(() => ({}));
        if (!res.ok || j.error) throw new Error(j.error || `HTTP ${res.status}`);
        if (j.text?.trim()) latest.current.onText(j.text.trim(), j.lang || "");
      } catch (e: Any) { latest.current.onError?.(e.message); } finally { setWorking((n) => n - 1); }
    });
  };

  const piece = () => {
    const s = rec.current!;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(s.stream);
    s.recorder = r;
    r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      upload(new Blob(chunks, { type: r.mimeType }));
      if (s.keep && latest.current.continuous) piece();
      else { s.stream.getTracks().forEach((t) => t.stop()); rec.current = null; setRecording(false); }
    };
    r.start();
    s.timer = setTimeout(() => { if (r.state === "recording") r.stop(); }, PIECE_MS);
  };

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      rec.current = { stream, keep: true };
      setRecording(true);
      piece();
    } catch { latest.current.onError?.("Microphone is blocked. Allow it in the browser and try again."); }
  };
  const stop = () => {
    const s = rec.current;
    if (!s) return;
    s.keep = false;
    if (s.timer) clearTimeout(s.timer);
    if (s.recorder?.state === "recording") s.recorder.stop();
  };

  return { enabled, recording, working: working > 0, toggle: () => (recording ? stop() : start()) };
}

/** Play text aloud through Sarvam. */
export async function playText(text: string, lang?: string) {
  const r = await api("/api/voice", { speak: text, lang });
  await new Audio(`data:audio/wav;base64,${r.audio}`).play();
}
