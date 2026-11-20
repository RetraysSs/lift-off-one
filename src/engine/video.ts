import type { Frame, Handedness, Move, ReportData } from "./types";
import type { PoseDetector } from "./detector";
import { ANALYSIS_FPS, SHORT_CLIP_FPS, SHORT_CLIP_SECONDS } from "./config";
import { buildFullReport, buildReport, type KeyFrame } from "./report";
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

/** Loads a clip into a detached, paused video element ready for seeking. */
async function openVideo(source: Blob) {
  const url = URL.createObjectURL(source);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const close = () => {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  };
  try {
    const loaded = once(video, "loadeddata", 10000);
    video.src = url;
    video.load();
    await loaded;
    if (!video.videoWidth || !video.videoHeight) throw new UnreadableVideoError();
    // iOS Safari only paints frames after a play() call.
    await video.play().catch(() => undefined);
    video.pause();
    const duration = await resolveDuration(video);
    if (!duration) throw new UnreadableVideoError();
    return { video, duration, close };
  } catch (err) {
    close();
    throw err;
  }
}

/** Seeks to each key frame and stores a snapshot with its analysis drawn on top. */
async function fillSnapshots(
  video: HTMLVideoElement,
  duration: number,
  frames: Frame[],
  keyFrames: KeyFrame[],
  report: ReportData,
  { signal, onProgress }: { signal?: AbortSignal; onProgress?: (fraction: number) => void },
) {
  for (const [k, key] of keyFrames.entries()) {
    if (signal?.aborted) throw new AbortedError();
    const frame = frames[key.frameIndex];
    if (!frame) continue;
    await seek(video, Math.min(Math.max(0, frame.t / 1000), Math.max(0, duration - 0.01)));
    const url = captureSnapshot(video, frame.lm, key.analysis);
    if (url) key.assign(report, url);
    onProgress?.((k + 1) / keyFrames.length);
  }
}

export interface AnalyseVideoOptions {
  move: Move;
  /** "full": overall analysis of every clear and ready stance in the video (uploads). */
  scope?: "move" | "full";
  handedness: Handedness;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface VideoAnalysis {
  report: ReportData;
  frames: Frame[];
  aspect: number;
}

/** Sampling rate for a clip of this length: live rate for short clips. */
export function samplingFps(durationSeconds: number) {
  return durationSeconds <= SHORT_CLIP_SECONDS ? SHORT_CLIP_FPS : ANALYSIS_FPS;
}

/** Steps through a video file, detects the pose in each sampled frame and builds a report. */
export async function analyseVideo(
  source: Blob,
  detector: PoseDetector,
  { move, scope, handedness, onProgress, signal }: AnalyseVideoOptions,
): Promise<VideoAnalysis> {
  const { video, duration: fullDuration, close } = await openVideo(source);
  try {
    const duration = Math.min(fullDuration, MAX_ANALYSIS_SECONDS);
    const aspect = video.videoWidth / video.videoHeight;
    const step = 1 / samplingFps(duration);
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

    const { report, keyFrames } =
      scope === "full"
        ? buildFullReport(frames, handedness, aspect)
        : buildReport(frames, move, handedness, aspect);
    await fillSnapshots(video, duration, frames, keyFrames, report, {
      ...(signal ? { signal } : {}),
      onProgress: (f) => onProgress?.(0.9 + 0.1 * f),
    });
    onProgress?.(1);
    return { report, frames, aspect };
  } finally {
    close();
  }
}

/**
 * Builds a clip report from poses already detected while it was recorded (the live
 * coach's frames, timed from the start of the clip), so the report matches what the
 * player saw live. The clip itself is only opened to grab snapshots; if that fails the
 * report is still returned, without images.
 */
export async function reportFromFrames(
  source: Blob,
  frames: Frame[],
  aspect: number,
  { move, handedness, onProgress, signal }: AnalyseVideoOptions,
): Promise<VideoAnalysis> {
  const { report, keyFrames } = buildReport(frames, move, handedness, aspect);
  try {
    const { video, duration, close } = await openVideo(source);
    try {
      await fillSnapshots(video, duration, frames, keyFrames, report, {
        ...(signal ? { signal } : {}),
        ...(onProgress ? { onProgress } : {}),
      });
    } finally {
      close();
    }
  } catch (err) {
    if (err instanceof AbortedError) throw err;
    // Snapshots are a nice-to-have; keep the analysis.
  }
  onProgress?.(1);
  return { report, frames, aspect };
}
