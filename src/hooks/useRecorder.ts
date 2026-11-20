import { useCallback, useEffect, useRef, useState } from "react";

const MIME_TYPES = ["video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
}

const TICK_MS = 100;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface RecordOptions {
  /** Fires when the recorder actually starts, i.e. at time 0 of the returned clip. */
  onStart?: () => void;
  /** Seconds of countdown before recording (0 starts straight away). Default 3. */
  countdownSeconds?: number;
}

/**
 * Countdown, then records the stream for `durationMs` of unpaused time.
 * `record` resolves the clip, or null if cancelled or unsupported. `pause` holds the
 * countdown or the recording (MediaRecorder pause) until `resume`.
 */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false);
  const cancelled = useRef(false);
  const pausedRef = useRef(false);
  const mounted = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      if (recorderRef.current && recorderRef.current.state !== "inactive")
        recorderRef.current.stop();
    };
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  }, []);

  const pause = useCallback(() => {
    if (!active.current || pausedRef.current) return;
    pausedRef.current = true;
    setPaused(true);
    if (recorderRef.current?.state === "recording") recorderRef.current.pause();
  }, []);

  const resume = useCallback(() => {
    if (!pausedRef.current) return;
    pausedRef.current = false;
    setPaused(false);
    if (recorderRef.current?.state === "paused") recorderRef.current.resume();
  }, []);

  const record = useCallback(
    async (
      source: MediaStream | null | (() => MediaStream | null),
      durationMs = 5000,
      { onStart, countdownSeconds = 3 }: RecordOptions = {},
    ): Promise<Blob | null> => {
      if (active.current) return null;
      setError(null);
      // A getter is read again when recording starts (the camera may change meanwhile).
      const current = () => (typeof source === "function" ? source() : source);
      if (!current() || typeof MediaRecorder === "undefined") {
        setError("Recording isn’t supported in this browser. Upload a video instead.");
        return null;
      }
      active.current = true;
      cancelled.current = false;
      pausedRef.current = false;
      setPaused(false);
      setRecording(true);
      const finish = () => {
        active.current = false;
        pausedRef.current = false;
        recorderRef.current = null;
        if (mounted.current) {
          setRecording(false);
          setCountdown(null);
          setRemainingMs(null);
          setPaused(false);
        }
      };
      const stop = () => cancelled.current || !mounted.current;

      // Countdown in TICK_MS steps so a pause holds it.
      for (let left = Math.max(0, Math.round(countdownSeconds)); left > 0; left--) {
        setCountdown(left);
        let waited = 0;
        while (waited < 1000) {
          if (stop()) {
            finish();
            return null;
          }
          await wait(TICK_MS);
          if (!pausedRef.current) waited += TICK_MS;
        }
      }
      if (stop()) {
        finish();
        return null;
      }
      setCountdown(null);

      const mimeType = pickMimeType();
      const stream = current();
      let recorder: MediaRecorder;
      try {
        if (!stream) throw new Error("No camera stream");
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
      recorder.start(250);
      if (pausedRef.current) recorder.pause();
      // Lets callers line up their own per-frame data with the clip's timeline.
      onStart?.();
      setRemainingMs(durationMs);
      // Count only unpaused time, so a paused clip still ends up `durationMs` long.
      let recordedMs = 0;
      const tick = setInterval(() => {
        if (!pausedRef.current) recordedMs += TICK_MS;
        if (mounted.current) setRemainingMs(Math.max(0, durationMs - recordedMs));
        if (recordedMs >= durationMs && recorder.state !== "inactive") recorder.stop();
      }, TICK_MS);
      await stopped;
      clearInterval(tick);
      const wasCancelled = cancelled.current;
      finish();
      if (wasCancelled || chunks.length === 0) return null;
      return new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" });
    },
    [],
  );

  return { recording, countdown, remainingMs, paused, record, pause, resume, cancel, error };
}
