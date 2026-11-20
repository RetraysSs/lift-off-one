import type { Analysis, Frame, Handedness, Move, ReportData, Swing, SwingReport } from "./types";
import { analyseStance, analyseSwing, combineAnalyses, sideOnRatio } from "./analysis";
import { THRESHOLDS } from "./config";
import { LM, WHOLE_BODY, dist, get, mid, pt, torsoScale, visible } from "./pose";
import { LOW_SWING, detectSwings, diagnoseSwings, findSwings } from "./swings";

/** A frame that should be captured as a report snapshot, with the analysis drawn on it. */
export interface KeyFrame {
  frameIndex: number;
  analysis: Analysis;
  assign: (report: ReportData, dataUrl: string) => void;
}

export class NoPlayerError extends Error {
  constructor() {
    super("No player was found in this video. Keep your whole body in frame and try again.");
    this.name = "NoPlayerError";
  }
}

function frameAt(frames: Frame[], i: number): Frame {
  const f = frames[i];
  if (!f) throw new RangeError(`No frame at index ${i}`);
  return f;
}

const meanVisibility = (f: Frame) =>
  WHOLE_BODY.reduce<number>((sum, i) => sum + (f.lm[i]?.visibility ?? 0), 0) / WHOLE_BODY.length;

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

function setSnapshot(
  report: ReportData,
  n: number,
  key: "prepSnapshot" | "contactSnapshot",
  url: string,
) {
  const swing = report.swings[n];
  if (swing) swing[key] = url;
}

// ---------- Ready stance ----------

/**
 * Picks the frame that represents how the player stands once set: the 75th-percentile
 * score among whole-body frames. A clip usually includes stepping in and standing up,
 * and the median frame can land on one of those moments.
 */
const SETTLED_QUANTILE = 0.75;

function pickStanceFrame(
  frames: Frame[],
  candidates: number[],
  handedness: Handedness,
  aspect: number,
  quantile = SETTLED_QUANTILE,
) {
  const scored = candidates
    .filter((i) => visible(frameAt(frames, i).lm, ...WHOLE_BODY))
    .map((i) => ({ i, analysis: analyseStance(frameAt(frames, i).lm, handedness, aspect) }))
    .sort((a, b) => (a.analysis.score ?? -1) - (b.analysis.score ?? -1) || a.i - b.i);
  return scored[Math.floor((scored.length - 1) * quantile)] ?? null;
}

function stanceKeyFrame(pick: { i: number; analysis: Analysis }): KeyFrame {
  return {
    frameIndex: pick.i,
    analysis: pick.analysis,
    assign: (r, url) => (r.stanceSnapshot = url),
  };
}

/** How still the body must be, and for how long, to count as holding a ready stance. */
export const STANCE_HOLD = {
  /** Torso centre may move at most this many torso lengths within the window. */
  maxDrift: 0.2,
  /** ± window (ms) the player must stay still for. */
  windowMs: 250,
  /** Ignore this long before a swing's preparation and after its contact (ms). */
  swingMarginMs: [300, 700] as [number, number],
  /** Fewer held moments than this (ms of video) is not enough to judge a stance. */
  minHeldMs: 300,
};

function torsoCentre(f: Frame, aspect: number) {
  const lm = f.lm;
  if (!visible(lm, LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip)) return null;
  const scale = torsoScale(lm, aspect);
  if (scale === null) return null;
  const shoulders = mid(pt(lm, LM.leftShoulder, aspect), pt(lm, LM.rightShoulder, aspect));
  const hips = mid(pt(lm, LM.leftHip, aspect), pt(lm, LM.rightHip, aspect));
  return { centre: mid(shoulders, hips), scale };
}

/**
 * Frames where the player is holding a ready position: whole body in view, facing the
 * camera, standing still, racket hand below the shoulders and clear of any swing.
 */
export function stanceFrames(
  frames: Frame[],
  swings: Swing[],
  aspect: number,
  handedness: Handedness = "right",
): number[] {
  const busy = swings.map((s): [number, number] => [
    frameAt(frames, s.prepIndex).t - STANCE_HOLD.swingMarginMs[0],
    frameAt(frames, s.contactIndex).t + STANCE_HOLD.swingMarginMs[1],
  ]);
  const centres = frames.map((f) => torsoCentre(f, aspect));
  const wrist = handedness === "right" ? LM.rightWrist : LM.leftWrist;
  const shoulder = handedness === "right" ? LM.rightShoulder : LM.leftShoulder;
  const held: number[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frameAt(frames, i);
    const c = centres[i];
    if (!c || !visible(f.lm, ...WHOLE_BODY)) continue;
    if (busy.some(([a, b]) => f.t >= a && f.t <= b)) continue;
    if (get(f.lm, wrist).y < get(f.lm, shoulder).y) continue; // racket hand up: a shot
    // The stance checks are calibrated facing the camera; standing side-on (resting
    // between shots) would skip the feet check and pass too easily.
    const facing = sideOnRatio(f.lm, aspect);
    if (facing === null || facing < THRESHOLDS.sideOnRatio) continue;
    let still = true;
    for (let j = i - 1; j >= 0 && f.t - frameAt(frames, j).t <= STANCE_HOLD.windowMs; j--) {
      const cj = centres[j];
      if (cj && dist(cj.centre, c.centre) / c.scale > STANCE_HOLD.maxDrift) still = false;
    }
    for (
      let j = i + 1;
      j < frames.length && frameAt(frames, j).t - f.t <= STANCE_HOLD.windowMs;
      j++
    ) {
      const cj = centres[j];
      if (cj && dist(cj.centre, c.centre) / c.scale > STANCE_HOLD.maxDrift) still = false;
    }
    if (still) held.push(i);
  }
  return held;
}

/** Total time (ms) covered by a set of frame indices, assuming steady sampling. */
function coveredMs(frames: Frame[], indices: number[]) {
  if (frames.length < 2) return 0;
  const step = (frameAt(frames, frames.length - 1).t - frameAt(frames, 0).t) / (frames.length - 1);
  return indices.length * step;
}

// ---------- Overhead clears ----------

/** Low attempts this close to a real clear (ms before, after its contact) are its own
 * preparation or follow-through, not separate swings. */
const LOW_SWING_MARGIN_MS: [number, number] = [1200, 700];

function clearSection(frames: Frame[], handedness: Handedness, aspect: number, includeLow = false) {
  const found = findSwings(frames, handedness, aspect);
  // Run the arm checks on whichever arm actually swung.
  const arm = found.handedness;
  const contactT = (s: Swing) => frameAt(frames, s.contactIndex).t;
  let all = found.swings.map((s) => ({ s, low: false }));
  if (includeLow) {
    const real = found.swings.map(contactT);
    const low = detectSwings(frames, arm, aspect, LOW_SWING).filter((s) => {
      const t = contactT(s);
      return !real.some((r) => t >= r - LOW_SWING_MARGIN_MS[0] && t <= r + LOW_SWING_MARGIN_MS[1]);
    });
    all = [...all, ...low.map((s) => ({ s, low: true }))].sort(
      (a, b) => contactT(a.s) - contactT(b.s),
    );
  }
  const keyFrames: KeyFrame[] = [];
  const swings: SwingReport[] = all.map(({ s, low }, n) => {
    const prepFrame = frameAt(frames, s.prepIndex);
    const contactFrame = frameAt(frames, s.contactIndex);
    const { prep, contact, stroke } = analyseSwing(frames, s, arm, aspect);
    keyFrames.push(
      {
        frameIndex: s.prepIndex,
        analysis: prep,
        assign: (r, url) => setSnapshot(r, n, "prepSnapshot", url),
      },
      {
        frameIndex: s.contactIndex,
        analysis: contact,
        assign: (r, url) => setSnapshot(r, n, "contactSnapshot", url),
      },
    );
    return {
      index: n + 1,
      prepTimeMs: Math.round(prepFrame.t),
      contactTimeMs: Math.round(contactFrame.t),
      prep,
      contact,
      score: combineAnalyses(prep, contact).score,
      stroke,
      ...(low ? { low: true } : {}),
    };
  });
  const score = mean(swings.map((r) => r.score).filter((s): s is number => s !== null));
  return { found, arm, swings, keyFrames, score, all: all.map((x) => x.s) };
}

/**
 * Turns a pose sequence into a report for one move. Pure: snapshots are filled in
 * afterwards by the caller through the returned key frames.
 */
export function buildReport(
  frames: Frame[],
  move: Move,
  handedness: Handedness,
  aspect = 16 / 9,
): { report: ReportData; keyFrames: KeyFrame[] } {
  if (frames.length === 0) throw new NoPlayerError();

  if (move === "stance") {
    const all = frames.map((_, i) => i);
    let pick = pickStanceFrame(frames, all, handedness, aspect);
    if (!pick) {
      let best = 0;
      frames.forEach((f, i) => {
        if (meanVisibility(f) > meanVisibility(frameAt(frames, best))) best = i;
      });
      pick = { i: best, analysis: analyseStance(frameAt(frames, best).lm, handedness, aspect) };
    }
    return {
      report: { move, score: pick.analysis.score, swings: [], stance: pick.analysis },
      keyFrames: [stanceKeyFrame(pick)],
    };
  }

  const clears = clearSection(frames, handedness, aspect);
  const notice =
    clears.swings.length === 0
      ? diagnoseSwings(frames, handedness, aspect).message
      : clears.arm !== handedness
        ? swungOtherArmNotice(clears.arm)
        : undefined;
  return {
    report: { move, score: clears.score, swings: clears.swings, ...(notice ? { notice } : {}) },
    keyFrames: clears.keyFrames,
  };
}

/**
 * Overall analysis of a practice or match video: every overhead clear, plus the ready
 * stance the player holds between shots. The overall score averages the two parts that
 * were found. Throws NoPlayerError only if there is no pose at all.
 */
export function buildFullReport(
  frames: Frame[],
  handedness: Handedness,
  aspect = 16 / 9,
): { report: ReportData; keyFrames: KeyFrame[] } {
  if (frames.length === 0) throw new NoPlayerError();
  const clears = clearSection(frames, handedness, aspect, true);
  const held = stanceFrames(frames, clears.all, aspect, clears.arm);
  const pick =
    coveredMs(frames, held) >= STANCE_HOLD.minHeldMs
      ? // Upper quartile, as for stance clips: standing still upright also counts as
        // "held", so the median can land on a moment that is not a ready stance.
        pickStanceFrame(frames, held, handedness, aspect)
      : null;
  const keyFrames = [...clears.keyFrames, ...(pick ? [stanceKeyFrame(pick)] : [])];
  const parts = [pick?.analysis.score ?? null, clears.score].filter((s): s is number => s !== null);
  const notice =
    clears.swings.length > 0 && clears.arm !== handedness
      ? swungOtherArmNotice(clears.arm)
      : undefined;
  if (!pick && clears.swings.length === 0) {
    // Nothing to score: explain using the clear diagnosis (it covers being out of frame).
    const why = diagnoseSwings(frames, handedness, aspect);
    return {
      report: {
        move: "clear",
        scope: "full",
        score: null,
        swings: [],
        notice:
          why.reason === "not-tracked"
            ? why.message
            : "No ready stance or overhead clear was found. Film with your whole body in frame, and hold your ready position for a moment between shots.",
      },
      keyFrames,
    };
  }
  return {
    report: {
      move: clears.swings.length ? "clear" : "stance",
      scope: "full",
      score: mean(parts),
      swings: clears.swings,
      ...(pick ? { stance: pick.analysis } : {}),
      ...(notice ? { notice } : {}),
    },
    keyFrames,
  };
}

/** Shown when swings were found on the arm opposite to the Racket hand setting. */
export function swungOtherArmNotice(arm: Handedness) {
  const Arm = arm === "right" ? "Right" : "Left";
  return `Your swings were tracked on your ${arm} arm, so it was used as your racket arm. If you play ${arm}-handed, set Racket hand to ${Arm} in Profile. If not, the camera mixed up your arms; turn a little more side-on.`;
}
