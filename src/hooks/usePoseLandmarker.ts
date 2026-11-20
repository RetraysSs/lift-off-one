import { useCallback, useEffect, useState } from "react";
import { createPoseDetector, type PoseDetector } from "@/engine/detector";

export type ModelStatus = "idle" | "loading" | "ready" | "error";

// One detector per page: the model is several MB and must not reload on every screen change.
let shared: Promise<PoseDetector> | null = null;
function loadShared() {
  if (!shared) {
    shared = createPoseDetector().catch((err) => {
      shared = null;
      throw err;
    });
  }
  return shared;
}

/**
 * Loads the pose model when `enabled` first becomes true. Returns the ready detector,
 * a status for the UI and a retry for failed downloads.
 */
export function usePoseLandmarker(enabled = true) {
  const [status, setStatus] = useState<ModelStatus>("idle");
  const [detector, setDetector] = useState<PoseDetector | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || detector) return;
    let cancelled = false;
    setStatus("loading");
    setError(null);
    loadShared()
      .then((d) => {
        if (cancelled) return;
        setDetector(d);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setStatus("error");
        setError("The pose model couldn’t load. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, detector, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { status, detector, error, retry };
}
