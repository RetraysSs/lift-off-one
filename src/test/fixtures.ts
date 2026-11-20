import type { Frame, Landmark } from "@/engine/types";

type P = [number, number];

/** Builds a 33-point pose from the joints that matter; everything else sits invisible. */
export function pose(points: Record<number, P>, visibility = 1): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => {
    const p = points[i];
    return p ? { x: p[0], y: p[1], z: 0, visibility } : { x: 0, y: 0, z: 0, visibility: 0 };
  });
}

/** Player facing the camera (aspect 1). Player's left appears on the image right. */
export function facingPose({
  upright = false,
  feet = 0.24,
  racketUp = true,
}: { upright?: boolean; feet?: number; racketUp?: boolean } = {}) {
  const lx = 0.5 + feet / 2;
  const rx = 0.5 - feet / 2;
  // Knee on the hip→ankle line is a straight (180°) leg; offset outwards bends it.
  const lKnee: P = upright ? [(0.55 + lx) / 2, 0.7] : [lx, 0.7];
  const rKnee: P = upright ? [(0.45 + rx) / 2, 0.7] : [rx, 0.7];
  return pose({
    0: [0.5, 0.15],
    11: [0.58, 0.3],
    12: [0.42, 0.3],
    13: [0.62, 0.42],
    14: [0.38, 0.42],
    15: [0.63, 0.5],
    16: racketUp ? [0.37, 0.36] : [0.37, 0.5],
    23: [0.55, 0.55],
    24: [0.45, 0.55],
    25: lKnee,
    26: rKnee,
    27: [lx, 0.85],
    28: [rx, 0.85],
    29: [lx - 0.01, 0.87],
    30: [rx - 0.01, 0.87],
    31: [lx + 0.03, 0.87],
    32: [rx + 0.03, 0.87],
  });
}

/** Side-on player (aspect 1) with the right (racket) wrist at height `wristY`. */
export function sidePose(wristY: number, { freeArmUp = true, elbowY = 0.28 } = {}) {
  return pose({
    0: [0.5, 0.15],
    11: [0.52, 0.3],
    12: [0.49, 0.3],
    13: [0.56, 0.24],
    14: [0.46, elbowY],
    15: [0.6, freeArmUp ? 0.12 : 0.45],
    16: [0.45, wristY],
    23: [0.51, 0.55],
    24: [0.5, 0.55],
    25: [0.53, 0.7],
    26: [0.49, 0.7],
    27: [0.52, 0.85],
    28: [0.48, 0.85],
    29: [0.5, 0.87],
    30: [0.46, 0.87],
    31: [0.55, 0.87],
    32: [0.51, 0.87],
  });
}

/** Wrist height profile with overhead swings peaking at the given times (ms), 30 fps. */
export function swingFrames(peaks: number[], durationMs: number): Frame[] {
  const frames: Frame[] = [];
  for (let t = 0; t <= durationMs; t += 1000 / 30) {
    let y = 0.36; // resting, below shoulder
    for (const p of peaks) {
      if (t >= p - 400 && t <= p) y = Math.min(y, 0.36 - ((t - (p - 400)) / 400) * 0.34);
      else if (t > p && t <= p + 300) y = Math.min(y, 0.02 + ((t - p) / 300) * 0.34);
    }
    frames.push({ t, lm: sidePose(y) });
  }
  return frames;
}

/**
 * The same swings as `swingFrames`, as a side-on camera sees them: the far (free-side)
 * shoulder and hip are hidden behind the body and the fast racket wrist is motion-blurred.
 */
export function occludedSwingFrames(peaks: number[], durationMs: number, fps = 30): Frame[] {
  const frames: Frame[] = [];
  for (let t = 0; t <= durationMs; t += 1000 / fps) {
    let y = 0.36;
    for (const p of peaks) {
      if (t >= p - 400 && t <= p) y = Math.min(y, 0.36 - ((t - (p - 400)) / 400) * 0.34);
      else if (t > p && t <= p + 300) y = Math.min(y, 0.02 + ((t - p) / 300) * 0.34);
    }
    const lm = sidePose(y).map((l, i) =>
      i === 11 || i === 23 ? { ...l, visibility: 0.3 } : i === 16 ? { ...l, visibility: 0.4 } : l,
    );
    frames.push({ t, lm });
  }
  return frames;
}
