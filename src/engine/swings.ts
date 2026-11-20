import type { Frame, Handedness, Swing } from "./types";
import { LM, get, racketSide, torsoScale, visible } from "./pose";
import { MIN_WRIST_VISIBILITY } from "./config";

export const SWING = {
  /** Contact must be a peak of wrist height within ± this window. */
  peakWindowMs: 250,
  /**
   * Wrist height above the shoulders, in torso lengths, to count as an overhead contact.
   * About head height: practice swings without full reach still count, and the
   * contact-height and extension checks then grade the reach.
   */
  minContactHeight: 0.45,
  /** Wrist must rise at least this much (torso lengths) from preparation to contact. */
  minRise: 0.3,
  /** Preparation is searched for this far before contact (ms): [furthest, nearest]. */
  prepWindowMs: [1200, 120] as [number, number],
  /** Two contacts closer than this are one swing. */
  minGapMs: 700,
  /**
   * After contact the racket arm follows through downwards. Within this window (ms) the
   * wrist must drop by `minFollowThrough` torso lengths, which rules out simply raising
   * the racket and holding it up. Live detection waits this long before confirming.
   */
  followThroughMs: 600,
  minFollowThrough: 0.25,
  /**
   * Between consecutive tracked frames the body may change size by at most this ratio and
   * move at most `maxBodyJump` torso lengths. A bigger change is a camera cut or the
   * tracker hopping to another person, and a swing can't span it.
   */
  maxScaleChange: 1.4,
  maxBodyJump: 0.8,
  /**
   * Preparation and contact must also be the same body directly: tracking can drift
   * onto another person gradually, in steps that each look continuous.
   */
  maxSpanBodyJump: 1.2,
  /**
   * A real overhead swing keeps the arm up for more than one sample: another frame
   * within this window (ms) must also be at least `supportHeight` high. Single-frame
   * landmark glitches fail this.
   */
  supportMs: 150,
  supportHeight: 0.2,
  /** See `MIN_WRIST_VISIBILITY`: a blurred racket wrist is still used. */
  minWristVisibility: MIN_WRIST_VISIBILITY,
  /** Heights are averaged with neighbours this close in time (ms), whatever the frame rate. */
  smoothMs: 45,
  /**
   * A raised racket hand often leaves the top of a portrait frame, where MediaPipe still
   * places it but with near-zero visibility. Above this y (image top is 0) it is trusted.
   */
  topEdgeY: 0.03,
  /** Below this share of frames with a measurable racket wrist, report it as not tracked. */
  minTrackedShare: 0.3,
};

/**
 * Racket-wrist height above the shoulders, in torso lengths (null if unseen).
 * Side-on, either shoulder may be hidden; both sit at about the same height, so the
 * visible one(s) give the reference.
 */
export function wristHeight(frame: Frame, handedness: Handedness, aspect: number): number | null {
  const lm = frame.lm;
  const wrist = get(lm, racketSide(handedness).wrist);
  const offTop = wrist.y <= SWING.topEdgeY && wrist.visibility > 0;
  if (wrist.visibility < SWING.minWristVisibility && !offTop) return null;
  const shoulders = [LM.leftShoulder, LM.rightShoulder].filter((i) => visible(lm, i));
  if (shoulders.length === 0) return null;
  const scale = torsoScale(lm, aspect);
  if (scale === null) return null;
  const shoulderY = shoulders.reduce((sum, i) => sum + get(lm, i).y, 0) / shoulders.length;
  return (shoulderY - wrist.y) / scale;
}

/**
 * Finds overhead swings in a pose sequence. Contact is a local peak in racket-wrist
 * height high above the shoulder; preparation is the lowest wrist point shortly before.
 * Returned indices refer to the input `frames` array.
 */
export function detectSwings(frames: Frame[], handedness: Handedness, aspect = 16 / 9): Swing[] {
  const raw = frames.map((f) => wristHeight(f, handedness, aspect));
  const t = (i: number) => frames[i]?.t ?? 0;
  // Average with neighbours within `smoothMs` to suppress landmark jitter. Time-based, so
  // live (~30 fps) and file analysis (sampled) smooth the same amount and agree.
  const smooth = raw.map((v, i) => {
    if (v === null) return null;
    let sum = v;
    let n = 1;
    for (const j of [i - 1, i + 1]) {
      const r = raw[j];
      if (r != null && Math.abs(t(j) - t(i)) <= SWING.smoothMs) {
        sum += r;
        n++;
      }
    }
    return sum / n;
  });
  const h = (i: number) => smooth[i] ?? null;
  const bodies = frames.map((f) => body(f.lm, aspect));
  // Frames without a measurable body are not evidence of a jump.
  const sameBody = (a: number, b: number, maxJump = SWING.maxBodyJump) => {
    const p = bodies[a];
    const q = bodies[b];
    if (!p || !q) return true;
    const ratio = Math.max(p.scale, q.scale) / Math.min(p.scale, q.scale);
    const jump = Math.hypot(p.x - q.x, p.y - q.y) / Math.max(p.scale, q.scale);
    return ratio <= SWING.maxScaleChange && jump <= maxJump;
  };

  // True if another frame near contact is also high (not a one-frame glitch).
  const supported = (c: number) => {
    for (let j = c - 1; j >= 0 && t(c) - t(j) <= SWING.supportMs; j--)
      if ((h(j) ?? -Infinity) >= SWING.supportHeight) return true;
    for (let j = c + 1; j < frames.length && t(j) - t(c) <= SWING.supportMs; j++)
      if ((h(j) ?? -Infinity) >= SWING.supportHeight) return true;
    return false;
  };

  // True if the wrist drops after contact. If the sequence ends (or the wrist is lost)
  // before the window is over, give it the benefit of the doubt.
  const followsThrough = (c: number, hc: number) => {
    let lowest = hc;
    let seen = 0;
    let windowComplete = false;
    for (let j = c + 1; j < frames.length; j++) {
      if (t(j) - t(c) > SWING.followThroughMs) {
        windowComplete = true;
        break;
      }
      const hj = h(j);
      if (hj !== null) {
        lowest = Math.min(lowest, hj);
        seen++;
      }
    }
    return hc - lowest >= SWING.minFollowThrough || !windowComplete || seen === 0;
  };

  const contacts: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    const hi = h(i);
    if (hi === null || hi < SWING.minContactHeight) continue;
    let isPeak = true;
    for (let j = i - 1; j >= 0 && t(i) - t(j) <= SWING.peakWindowMs; j--) {
      const hj = h(j);
      if (hj !== null && hj > hi) isPeak = false;
    }
    for (let j = i + 1; j < frames.length && t(j) - t(i) <= SWING.peakWindowMs; j++) {
      const hj = h(j);
      if (hj !== null && hj >= hi) isPeak = false;
    }
    if (isPeak && supported(i)) contacts.push(i);
  }

  const swings: Swing[] = [];
  for (const c of contacts) {
    let prep = -1;
    let anchor = c;
    for (let j = c - 1; j >= 0; j--) {
      const dt = t(c) - t(j);
      if (dt > SWING.prepWindowMs[0]) break;
      if (!sameBody(j, anchor) || !sameBody(j, c, SWING.maxSpanBodyJump)) break;
      if (bodies[j]) anchor = j;
      const hj = h(j);
      if (dt < SWING.prepWindowMs[1] || hj === null) continue;
      const hp = h(prep);
      if (hp === null || hj < hp) prep = j;
    }
    const hc = h(c);
    const hp = h(prep);
    if (hc === null || hp === null || hc - hp < SWING.minRise) continue;
    if (!followsThrough(c, hc)) continue;

    const last = swings[swings.length - 1];
    if (last && t(c) - t(last.contactIndex) < SWING.minGapMs) {
      const hl = h(last.contactIndex);
      if (hl !== null && hc > hl) swings[swings.length - 1] = { prepIndex: prep, contactIndex: c };
      continue;
    }
    swings.push({ prepIndex: prep, contactIndex: c });
  }
  return swings;
}

const otherHand = (h: Handedness): Handedness => (h === "right" ? "left" : "right");

/**
 * Swings on the player's racket arm. Side-on, MediaPipe sometimes labels the arms the
 * wrong way round (and players sometimes leave Racket hand on the wrong setting), so if
 * the racket arm shows no swing, the other arm is tried. `handedness` says which arm
 * the swings were found on, so checks can be run on that arm.
 */
export function findSwings(
  frames: Frame[],
  handedness: Handedness,
  aspect = 16 / 9,
): { swings: Swing[]; handedness: Handedness } {
  const swings = detectSwings(frames, handedness, aspect);
  if (swings.length > 0) return { swings, handedness };
  const other = otherHand(handedness);
  const flipped = detectSwings(frames, other, aspect);
  return flipped.length > 0 ? { swings: flipped, handedness: other } : { swings, handedness };
}

export type NoSwingReason = "not-tracked" | "not-high" | "no-rise";

export interface SwingDiagnosis {
  reason: NoSwingReason;
  message: string;
  /** Share of frames where the racket wrist height could be measured (0–1). */
  trackedShare: number;
  /** Highest racket-wrist height reached, in torso lengths above the shoulders. */
  maxHeight: number | null;
}

/** Explains, in coaching terms, why `findSwings` found nothing in this sequence. */
export function diagnoseSwings(
  frames: Frame[],
  handedness: Handedness,
  aspect = 16 / 9,
): SwingDiagnosis {
  const measure = (h: Handedness) =>
    frames.map((f) => wristHeight(f, h, aspect)).filter((v): v is number => v !== null);
  // Judge the racket arm; fall back to the other arm only if the racket arm was barely
  // seen (the camera may have mixed the arms up).
  let heights = measure(handedness);
  const share = (hs: number[]) => (frames.length ? hs.length / frames.length : 0);
  if (share(heights) < SWING.minTrackedShare) {
    const other = measure(otherHand(handedness));
    if (share(other) > share(heights)) heights = other;
  }
  const trackedShare = share(heights);
  const maxHeight = heights.length ? Math.round(Math.max(...heights) * 100) / 100 : null;
  if (trackedShare < SWING.minTrackedShare || maxHeight === null)
    return {
      reason: "not-tracked",
      message:
        "Your racket arm was out of sight for most of the clip. Put your phone 2–3 m away where the net would be, with your whole body and raised racket in frame.",
      trackedShare,
      maxHeight,
    };
  if (maxHeight < SWING.minContactHeight)
    return {
      reason: "not-high",
      message:
        "No swing detected: your racket hand never went clearly above your head. Reach up and hit at full stretch.",
      trackedShare,
      maxHeight,
    };
  return {
    reason: "no-rise",
    message:
      "No swing detected: your racket arm stayed up without a full swing. Start from a cocked position behind your head, then swing up through the shuttle.",
    trackedShare,
    maxHeight,
  };
}

/** Torso centre and size, used to tell whether two frames show the same body. */
function body(lm: Frame["lm"], aspect: number) {
  const scale = torsoScale(lm, aspect);
  const joints = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip].filter((i) =>
    visible(lm, i),
  );
  if (scale === null || joints.length === 0) return null;
  const x = joints.reduce((s, i) => s + get(lm, i).x * aspect, 0) / joints.length;
  const y = joints.reduce((s, i) => s + get(lm, i).y, 0) / joints.length;
  return { x, y, scale };
}
