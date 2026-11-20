import type { Frame } from "@/engine/types";

/**
 * Compact pose tracks: MediaPipe landmarks as [x, y, visibility] for only the landmark
 * indices the engine uses (`landmarks`); the rest load as unseen. Used for the tutorial
 * overlays (public/tutorials/*.pose.json) and the calibration fixture.
 */
export interface PoseTrack {
  aspect: number;
  /** [time ms, one [x, y, visibility] per kept landmark] */
  frames: [number, [number, number, number][]][];
}

export function expandTrack(landmarks: number[], track: PoseTrack): Frame[] {
  return track.frames.map(([t, kept]) => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    landmarks.forEach((i, k) => {
      const p = kept[k];
      if (p) lm[i] = { x: p[0], y: p[1], z: 0, visibility: p[2] };
    });
    return { t, lm };
  });
}

/** Frame nearest to `t` (ms) within `maxGap`, by binary search over sorted frames. */
export function frameAt(frames: Frame[], t: number, maxGap = 60): Frame | null {
  let lo = 0;
  let hi = frames.length - 1;
  if (hi < 0) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((frames[mid]?.t ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  const after = frames[lo];
  const before = frames[lo - 1];
  const best =
    before && (!after || Math.abs(before.t - t) < Math.abs(after.t - t)) ? before : after;
  return best && Math.abs(best.t - t) <= maxGap ? best : null;
}
