import { useCallback, useEffect, useRef, useState } from "react";

const MIME_TYPES = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * 3–2–1 countdown, then records the stream for `durationMs`.
 * `record` resolves the clip, or null if cancelled or unsupported.
 */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const cancelled = useRef(false);
  const mounted = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const record = useCallback(
    async (stream: MediaStream | null, durationMs = 5000): Promise<Blob | null> => {
      if (active.current) return null;
      setError(null);
      if (!stream || typeof MediaRecorder === "undefined") {
        setError("Recording isn’t supported in this browser. Upload a video instead.");
        return null;
      }
      active.current = true;
      cancelled.current = false;
      setRecording(true);
      const finish = () => {
        active.current = false;
        recorderRef.current = null;
        if (mounted.current) {
          setRecording(false);
          setCountdown(null);
          setRemainingMs(null);
        }
      };

      for (const count of [3, 2, 1]) {
        if (cancelled.current || !mounted.current) {
          finish();
          return null;
        }
        setCountdown(count);
        await wait(1000);
      }
      if (cancelled.current || !mounted.current) {
        finish();
        return null;
      }
      setCountdown(null);

      const mimeType = pickMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      } catch {
        setError("Recording isn’t supported in this browser. Upload a video instead.");
        finish();
        return null;
      }
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));
      const startedAt = performance.now();
      recorder.start(250);
      setRemainingMs(durationMs);
      const tick = setInterval(() => {
        if (mounted.current)
          setRemainingMs(Math.max(0, durationMs - (performance.now() - startedAt)));
      }, 100);
      const timer = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, durationMs);
      await stopped;
      clearInterval(tick);
      clearTimeout(timer);
      const wasCancelled = cancelled.current;
      finish();
      if (wasCancelled || chunks.length === 0) return null;
      return new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
    },
    [],
  );

  return { recording, countdown, remainingMs, record, cancel, error };
}
