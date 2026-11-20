import type { Frame, Handedness, Move, ReportData } from "./types";
import type { PoseDetector } from "./detector";
import { ANALYSIS_FPS } from "./config";
import { buildReport } from "./report";
import { captureSnapshot } from "./draw";

/** Longer videos are trimmed to keep analysis responsive on phones. */
export const MAX_ANALYSIS_SECONDS = 90;

export class UnreadableVideoError extends Error {
  constructor() {
    super("This file isn’t a readable video. Choose an MP4, MOV or WebM video.");
    this.name = "UnreadableVideoError";
  }
}

export class AbortedError extends Error {
  constructor() {
    super("Analysis cancelled.");
    this.name = "AbortError";
  }
}

function once(target: HTMLVideoElement, event: string, timeoutMs = 5000) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new UnreadableVideoError());
    }, timeoutMs);
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new UnreadableVideoError());
    };
    const cleanup = () => {
      clearTimeout(timer);
      target.removeEventListener(event, ok);
      target.removeEventListener("error", fail);
    };
    target.addEventListener(event, ok, { once: true });
    target.addEventListener("error", fail, { once: true });
  });
}

async function seek(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 1e-3) return;
  const done = once(video, "seeked");
  video.currentTime = time;
  await done;
}

/**
 * MediaRecorder WebM files often report an infinite duration until the browser has
 * scanned to the end, so force that scan before stepping through frames.
 */
async function resolveDuration(video: HTMLVideoElement) {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  const done = once(video, "durationchange", 8000).catch(() => undefined);
  video.currentTime = 1e7;
  await done;
  await seek(video, 0).catch(() => undefined);
  return Number.isFinite(video.duration) ? video.duration : 0;
}

export interface AnalyseVideoOptions {
  move: Move;
  handedness: Handedness;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface VideoAnalysis {
  report: ReportData;
  frames: Frame[];
  aspect: number;
}

/** Steps through a video file, detects the pose in each sampled frame and builds a report. */
export async function analyseVideo(
  source: Blob,
  detector: PoseDetector,
  { move, handedness, onProgress, signal }: AnalyseVideoOptions,
): Promise<VideoAnalysis> {
  const url = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  try {
    const loaded = once(video, "loadeddata", 10000);
    video.src = url;
    video.load();
    await loaded;
    if (!video.videoWidth || !video.videoHeight) throw new UnreadableVideoError();
    // iOS Safari only paints frames after a play() call.
    await video.play().catch(() => undefined);
    video.pause();

    const duration = Math.min(await resolveDuration(video), MAX_ANALYSIS_SECONDS);
    if (!duration) throw new UnreadableVideoError();
    const aspect = video.videoWidth / video.videoHeight;
    const step = 1 / ANALYSIS_FPS;
    const frames: Frame[] = [];
    const total = Math.max(1, Math.floor(duration / step));
    const base = performance.now();

    for (let n = 0; n <= total; n++) {
      if (signal?.aborted) throw new AbortedError();
      const t = Math.min(n * step, Math.max(0, duration - 0.01));
      await seek(video, t);
      const lm = detector.detect(video, base + t * 1000);
      if (lm) frames.push({ t: t * 1000, lm });
      onProgress?.((n / total) * 0.9);
      // Yield so the progress bar can paint.
      if (n % 4 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const { report, keyFrames } = buildReport(frames, move, handedness, aspect);
    for (const [k, key] of keyFrames.entries()) {
      if (signal?.aborted) throw new AbortedError();
      const frame = frames[key.frameIndex];
      if (!frame) continue;
      await seek(video, frame.t / 1000);
      const url = captureSnapshot(video, frame.lm, key.analysis);
      if (url) key.assign(report, url);
      onProgress?.(0.9 + (0.1 * (k + 1)) / keyFrames.length);
    }
    onProgress?.(1);
    return { report, frames, aspect };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
