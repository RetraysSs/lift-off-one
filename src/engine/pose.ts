import type { Handedness, Landmark } from "./types";
import { MIN_VISIBILITY } from "./config";

/** MediaPipe BlazePose landmark indices (anatomical left/right of the player). */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** Skeleton drawn on the overlay (face points other than the nose are omitted). */
export const BONES: [number, number][] = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [27, 31],
  [28, 30],
  [30, 32],
  [28, 32],
];
export const DRAWN_JOINTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export interface Side {
  shoulder: number;
  elbow: number;
  wrist: number;
  hip: number;
  knee: number;
  ankle: number;
}
const LEFT: Side = { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
const RIGHT: Side = { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 };

export const racketSide = (h: Handedness): Side => (h === "right" ? RIGHT : LEFT);
export const freeSide = (h: Handedness): Side => (h === "right" ? LEFT : RIGHT);

export interface Point {
  x: number;
  y: number;
}

/**
 * Normalised landmarks are scaled 0–1 on each axis independently; multiply x by the
 * frame aspect ratio (width ÷ height) so distances and angles are in square units.
 */
const MISSING: Landmark = { x: 0, y: 0, z: 0, visibility: 0 };

/** Landmark at index i, or an invisible placeholder when the model returned fewer points. */
export const get = (lm: Landmark[], i: number): Landmark => lm[i] ?? MISSING;

export function pt(lm: Landmark[], i: number, aspect: number): Point {
  const l = get(lm, i);
  return { x: l.x * aspect, y: l.y };
}

export function visible(lm: Landmark[], ...indices: number[]) {
  return indices.every((i) => lm[i] !== undefined && (lm[i].visibility ?? 1) >= MIN_VISIBILITY);
}

export function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Interior angle at b, in degrees (0–180). */
export function angle(a: Point, b: Point, c: Point) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const len = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (len === 0) return 180;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / len));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Shoulder-midpoint to hip-midpoint distance: the body's scale reference. */
export function torsoLength(lm: Landmark[], aspect: number) {
  const s = mid(pt(lm, LM.leftShoulder, aspect), pt(lm, LM.rightShoulder, aspect));
  const h = mid(pt(lm, LM.leftHip, aspect), pt(lm, LM.rightHip, aspect));
  return dist(s, h);
}

/** Head-to-ankle landmarks needed for whole-body analysis. */
export const WHOLE_BODY = [
  LM.nose,
  LM.leftShoulder,
  LM.rightShoulder,
  LM.leftHip,
  LM.rightHip,
  LM.leftKnee,
  LM.rightKnee,
  LM.leftAnkle,
  LM.rightAnkle,
];

export function wholeBodyVisible(lm: Landmark[] | null | undefined) {
  return !!lm && lm.length >= 33 && visible(lm, ...WHOLE_BODY);
}

/**
 * Shoulder-to-hip length from whichever body side is visible (longest if both are).
 * Side-on, the far shoulder and hip hide behind the body, so this is the robust scale
 * for side-on moves where `torsoLength` would need all four joints.
 */
export function torsoScale(lm: Landmark[], aspect: number): number | null {
  const lengths = [LEFT, RIGHT]
    .filter((s) => visible(lm, s.shoulder, s.hip))
    .map((s) => dist(pt(lm, s.shoulder, aspect), pt(lm, s.hip, aspect)));
  const length = lengths.length ? Math.max(...lengths) : 0;
  return length > 0 ? length : null;
}
