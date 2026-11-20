import type { Landmark } from "./types";
import { POSE_MODEL_URL, WASM_BASE_URL } from "./config";

export interface PoseDetector {
  /** Detects one pose in the current frame. Timestamps are forced to be increasing. */
  detect(source: HTMLVideoElement, timestampMs: number): Landmark[] | null;
  close(): void;
}

/**
 * Loads the MediaPipe pose landmarker in the browser. The library is imported lazily so
 * it never runs during SSR and only downloads once the player needs it.
 */
export async function createPoseDetector(): Promise<PoseDetector> {
  const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  const make = (delegate: "GPU" | "CPU") =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  let landmarker;
  try {
    landmarker = await make("GPU");
  } catch {
    landmarker = await make("CPU");
  }
  let last = -1;
  return {
    detect(source, timestampMs) {
      if (!source.videoWidth || !source.videoHeight) return null;
      const ts = Math.max(last + 1, Math.round(timestampMs));
      last = ts;
      const result = landmarker.detectForVideo(source, ts);
      const lm = result.landmarks[0];
      return lm ? lm.map((l) => ({ x: l.x, y: l.y, z: l.z, visibility: l.visibility ?? 1 })) : null;
    },
    close() {
      landmarker.close();
    },
  };
}
