import { useCallback, useEffect, useRef, useState } from "react";

export type Facing = "user" | "environment";

export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error || err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access was blocked. Allow camera access in your browser settings, then try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "No camera was found on this device.";
  if (name === "NotReadableError")
    return "Your camera is busy. Close other apps using it, then try again.";
  if (name === "InsecureContext") return "The camera needs a secure (https) connection.";
  return "The camera couldn’t start. Try again.";
}

/** Opens the device camera into a video element and cleans the stream up on stop/unmount. */
export function useCamera() {
  const [cameraOn, setCameraOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setCameraOn(false);
    setStarting(false);
  }, [release]);

  const start = useCallback(
    async (video: HTMLVideoElement | null, nextFacing: Facing = facing) => {
      setError(null);
      if (!video) return false;
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError(cameraErrorMessage({ name: "InsecureContext" } as Error));
        return false;
      }
      setStarting(true);
      release();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: nextFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });
        streamRef.current = stream;
        videoRef.current = video;
        video.srcObject = stream;
        video.muted = true;
        await video.play().catch(() => undefined);
        setFacing(nextFacing);
        setCameraOn(true);
        return true;
      } catch (err) {
        setError(cameraErrorMessage(err));
        setCameraOn(false);
        return false;
      } finally {
        setStarting(false);
      }
    },
    [facing, release],
  );

  useEffect(() => release, [release]);

  // Keep the screen awake while practising.
  useEffect(() => {
    if (!cameraOn || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock
      .request("screen")
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => {
      void lock?.release().catch(() => undefined);
    };
  }, [cameraOn]);

  return {
    cameraOn,
    starting,
    start,
    stop,
    error,
    clearError: () => setError(null),
    facing,
    stream: () => streamRef.current,
  };
}
