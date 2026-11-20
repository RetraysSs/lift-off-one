import type { Frame, Handedness, Swing } from "./types";
import { get, racketSide, torsoScale, visible } from "./pose";

export const SWING = {
  /** Contact must be a peak of wrist height within ± this window. */
  peakWindowMs: 250,
  /** Wrist height above shoulder, in torso lengths, to count as an overhead contact. */
  minContactHeight: 0.6,
  /** Wrist must rise at least this much (torso lengths) from preparation to contact. */
  minRise: 0.35,
  /** Preparation is searched for this far before contact (ms): [furthest, nearest]. */
  prepWindowMs: [1200, 120] as [number, number],
  /** Two contacts closer than this are one swing. */
  minGapMs: 700,
  /**
   * The racket wrist moves fast at contact, so it is often motion-blurred and scored
   * below the general visibility floor. Accept it at this lower confidence.
   */
  minWristVisibility: 0.3,
  /** Heights are averaged with neighbours this close in time (ms), whatever the frame rate. */
  smoothMs: 45,
};

/** Racket-wrist height above the racket shoulder, in torso lengths (null if unseen). */
export function wristHeight(frame: Frame, handedness: Handedness, aspect: number): number | null {
  const side = racketSide(handedness);
  const lm = frame.lm;
  if (!visible(lm, side.shoulder)) return null;
  if (get(lm, side.wrist).visibility < SWING.minWristVisibility) return null;
  const scale = torsoScale(lm, aspect);
  if (scale === null) return null;
  return (get(lm, side.shoulder).y - get(lm, side.wrist).y) / scale;
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
    if (isPeak) contacts.push(i);
  }

  const swings: Swing[] = [];
  for (const c of contacts) {
    let prep = -1;
    for (let j = c - 1; j >= 0; j--) {
      const dt = t(c) - t(j);
      if (dt > SWING.prepWindowMs[0]) break;
      const hj = h(j);
      if (dt < SWING.prepWindowMs[1] || hj === null) continue;
      const hp = h(prep);
      if (hp === null || hj < hp) prep = j;
    }
    const hc = h(c);
    const hp = h(prep);
    if (hc === null || hp === null || hc - hp < SWING.minRise) continue;

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
