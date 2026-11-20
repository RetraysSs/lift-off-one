import type { Analysis, CheckResult, Frame, Handedness, Landmark, Move, Swing } from "./types";
import { MIN_VISIBILITY, MIN_WRIST_VISIBILITY, THRESHOLDS as T } from "./config";
import {
  LM,
  angle,
  get,
  dist,
  freeSide,
  mid,
  pt,
  racketSide,
  torsoLength,
  torsoScale,
  visible,
} from "./pose";

const round = (n: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

/** The racket wrist at contact is usually motion-blurred; accept it at lower confidence. */
const wristSeen = (lm: Landmark[], i: number) => (lm[i]?.visibility ?? 0) >= MIN_WRIST_VISIBILITY;

const UNSEEN_TIP = "Keep your whole body in frame so this can be measured.";

function skip(
  base: Pick<CheckResult, "id" | "name" | "target">,
  tip = UNSEEN_TIP,
  joints: number[] = [],
): CheckResult {
  return { ...base, status: "skip", value: null, tip, joints, focusJoint: null };
}

export function scoreChecks(checks: CheckResult[]): number | null {
  const measured = checks.filter((c) => c.status !== "skip");
  if (measured.length === 0) return null;
  return Math.round((measured.filter((c) => c.status === "pass").length / measured.length) * 100);
}

const analysis = (checks: CheckResult[]): Analysis => ({ checks, score: scoreChecks(checks) });

/** Shoulder width ÷ torso length. Small when the player is side-on to the camera. */
export function sideOnRatio(lm: Landmark[], aspect: number): number | null {
  if (!visible(lm, LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip)) return null;
  const torso = torsoLength(lm, aspect);
  if (torso === 0) return null;
  return dist(pt(lm, LM.leftShoulder, aspect), pt(lm, LM.rightShoulder, aspect)) / torso;
}

// ---------- Ready stance ----------

function kneesBent(lm: Landmark[], aspect: number): CheckResult {
  const base = { id: "knees_bent", name: "Knees bent", target: `${T.kneeMin}–${T.kneeMax}°` };
  const sides = [
    { hip: LM.leftHip, knee: LM.leftKnee, ankle: LM.leftAnkle },
    { hip: LM.rightHip, knee: LM.rightKnee, ankle: LM.rightAnkle },
  ].filter((s) => visible(lm, s.hip, s.knee, s.ankle));
  if (sides.length === 0) return skip(base);
  const measured = sides.map((s) => ({
    ...s,
    deg: angle(pt(lm, s.hip, aspect), pt(lm, s.knee, aspect), pt(lm, s.ankle, aspect)),
  }));
  const value = round(measured.reduce((sum, s) => sum + s.deg, 0) / measured.length);
  const miss = (d: number) => Math.max(T.kneeMin - d, d - T.kneeMax, 0);
  const worst = measured.reduce((a, b) => (miss(b.deg) > miss(a.deg) ? b : a));
  const pass = value >= T.kneeMin && value <= T.kneeMax;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Good knee bend. You're ready to push off in any direction."
      : value > T.kneeMax
        ? "Bend your knees more. You're too upright to move quickly."
        : "Rise up a little. Sitting this low slows your first step.",
    joints: measured.flatMap((s) => [s.hip, s.knee, s.ankle]),
    focusJoint: pass ? null : worst.knee,
  };
}

function feetApart(lm: Landmark[], aspect: number): CheckResult {
  const base = {
    id: "feet_apart",
    name: "Feet shoulder-width apart",
    target: `${T.feetMin.toFixed(1)}–${T.feetMax.toFixed(1)}× shoulder width`,
  };
  const joints = [LM.leftAnkle, LM.rightAnkle, LM.leftShoulder, LM.rightShoulder];
  if (!visible(lm, ...joints)) return skip(base);
  const ratio = sideOnRatio(lm, aspect);
  if (ratio !== null && ratio < T.sideOnRatio)
    return skip(base, "Face the camera to measure how far apart your feet are.");
  const shoulders = dist(pt(lm, LM.leftShoulder, aspect), pt(lm, LM.rightShoulder, aspect));
  if (shoulders === 0) return skip(base);
  const value = round(
    dist(pt(lm, LM.leftAnkle, aspect), pt(lm, LM.rightAnkle, aspect)) / shoulders,
    1,
  );
  const pass = value >= T.feetMin && value <= T.feetMax;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Good base. Keep your feet comfortably apart."
      : value < T.feetMin
        ? "Widen your stance to about shoulder width or a little more."
        : "Bring your feet in a little. Too wide makes it hard to push off.",
    joints: [LM.leftAnkle, LM.rightAnkle, LM.leftKnee, LM.rightKnee],
    focusJoint: pass ? null : LM.leftAnkle,
  };
}

/**
 * The pose model tracks the hand, not the racket, so this only checks the racket hand is
 * held up at waist height or above rather than hanging down by the side.
 */
function racketUp(lm: Landmark[], handedness: Handedness, aspect: number): CheckResult {
  const side = racketSide(handedness);
  const base = { id: "racket_up", name: "Racket up", target: "hand at waist height or above" };
  const scale = torsoScale(lm, aspect);
  if (!visible(lm, side.wrist, LM.leftHip, LM.rightHip) || scale === null) return skip(base);
  const hipY = (get(lm, LM.leftHip).y + get(lm, LM.rightHip).y) / 2;
  const pass = (hipY - get(lm, side.wrist).y) / scale >= -T.racketBelowHip;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value: null,
    tip: pass
      ? "Keep your racket up and ready."
      : "Bring your racket hand up in front of you so you're ready to react.",
    joints: [side.shoulder, side.elbow, side.wrist],
    focusJoint: pass ? null : side.wrist,
  };
}

function weightForward(lm: Landmark[], aspect: number): CheckResult {
  const base = { id: "weight_forward", name: "Weight forward", target: "side-on view only" };
  const ratio = sideOnRatio(lm, aspect);
  const feet = [LM.leftHeel, LM.rightHeel, LM.leftFootIndex, LM.rightFootIndex];
  if (
    ratio === null ||
    ratio >= T.sideOnRatio ||
    !visible(lm, LM.leftAnkle, LM.rightAnkle, ...feet)
  )
    return skip(base, "Use a side-on view to check your weight distribution.");
  // Which way the toes point decides what "forward" means in the image.
  const toes = mid(pt(lm, LM.leftFootIndex, aspect), pt(lm, LM.rightFootIndex, aspect));
  const heels = mid(pt(lm, LM.leftHeel, aspect), pt(lm, LM.rightHeel, aspect));
  const dir = Math.sign(toes.x - heels.x) || 1;
  const shoulders = mid(pt(lm, LM.leftShoulder, aspect), pt(lm, LM.rightShoulder, aspect));
  const ankles = mid(pt(lm, LM.leftAnkle, aspect), pt(lm, LM.rightAnkle, aspect));
  const torso = torsoLength(lm, aspect) || 1;
  const value = round(((shoulders.x - ankles.x) * dir) / torso, 2);
  const pass = value >= T.weightForward;
  return {
    ...base,
    target: `lean ≥ ${T.weightForward}× torso`,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Nice. Your weight is on the balls of your feet."
      : "Lean slightly forward so your weight sits on the balls of your feet.",
    joints: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    focusJoint: pass ? null : LM.leftHip,
  };
}

export function analyseStance(lm: Landmark[], handedness: Handedness, aspect = 16 / 9): Analysis {
  return analysis([
    kneesBent(lm, aspect),
    feetApart(lm, aspect),
    racketUp(lm, handedness, aspect),
    weightForward(lm, aspect),
  ]);
}

// ---------- Overhead clear ----------
//
// Swing checks look at a window of frames rather than one moment: preparation happens
// over the second before contact, and contact is judged at its best within ±150 ms.
// Thresholds are calibrated on the coach's good/bad reference clips (see
// src/test/fixtures/reference-poses.json and the calibration tests).

export type Stroke = "forehand" | "backhand";

/** Windows (ms before/around contact) used to judge a swing. */
export const SWING_WINDOWS = { prepMs: 1000, elbowMs: 600, contactMs: 150 };

const finite = (xs: (number | null)[]) =>
  xs.filter((x): x is number => x !== null && Number.isFinite(x));

/** Height of joint `i` above `shoulder`, in torso lengths (null if unseen). */
function heightAboveShoulder(
  lm: Landmark[],
  i: number,
  shoulder: number,
  aspect: number,
  minVis = MIN_WRIST_VISIBILITY,
) {
  const scale = torsoScale(lm, aspect);
  if (scale === null || !visible(lm, shoulder) || (lm[i]?.visibility ?? 0) < minVis) return null;
  return (get(lm, shoulder).y - get(lm, i).y) / scale;
}

/**
 * A backhand clear is hit with the back to the net. Filmed as in the reference clips,
 * the player's back faces the camera, which flips the image order of the shoulders.
 */
export function strokeOf(lm: Landmark[], aspect: number): Stroke {
  const scale = torsoScale(lm, aspect);
  if (scale === null || !visible(lm, LM.leftShoulder, LM.rightShoulder)) return "forehand";
  const signed = ((get(lm, LM.leftShoulder).x - get(lm, LM.rightShoulder).x) * aspect) / scale;
  return signed <= T.backhandShoulders ? "backhand" : "forehand";
}

/** The frame in a window where `score` is highest. */
function best(win: Landmark[][], score: (lm: Landmark[]) => number | null) {
  let top = -Infinity;
  let found = false;
  for (const lm of win) {
    const v = score(lm);
    if (v !== null && v > top) {
      top = v;
      found = true;
    }
  }
  return found ? { value: top } : null;
}

function sideOn(win: Landmark[][], aspect: number): CheckResult {
  const base = { id: "side_on", name: "Side-on position", target: `< ${T.sideOnRatio}` };
  const ratios = finite(win.map((lm) => sideOnRatio(lm, aspect)));
  if (ratios.length === 0) return skip(base);
  const value = round(Math.min(...ratios), 2);
  const pass = value < T.sideOnRatio;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Good position. You turned side-on to prepare."
      : "Turn side-on so your free shoulder points toward the net.",
    joints: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    focusJoint: pass ? null : LM.leftShoulder,
  };
}

function freeArmUp(
  win: Landmark[][],
  handedness: Handedness,
  aspect: number,
  stroke: Stroke,
): CheckResult {
  const side = freeSide(handedness);
  const base = { id: "free_arm_up", name: "Free arm raised", target: "wrist above shoulder" };
  if (stroke === "backhand")
    return skip(base, "Not needed on a backhand: your free arm stays low for balance.");
  const top = best(win, (lm) =>
    heightAboveShoulder(lm, side.wrist, side.shoulder, aspect, MIN_VISIBILITY),
  );
  if (!top) return skip(base);
  const pass = top.value > T.freeArmAbove;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value: null,
    tip: pass
      ? "Good balance. Your free arm pointed up at the shuttle."
      : "Raise your other arm to point at the shuttle for balance.",
    joints: [side.shoulder, side.elbow, side.wrist],
    focusJoint: pass ? null : side.wrist,
  };
}

function elbowHigh(win: Landmark[][], handedness: Handedness, aspect: number): CheckResult {
  const side = racketSide(handedness);
  const base = {
    id: "elbow_high",
    name: "Elbow high",
    target: `elbow ≥ ${T.elbowAbove}× torso above shoulder`,
  };
  const top = best(win, (lm) =>
    heightAboveShoulder(lm, side.elbow, side.shoulder, aspect, MIN_VISIBILITY),
  );
  if (!top) return skip(base);
  const pass = top.value >= T.elbowAbove;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value: null,
    tip: pass
      ? "Good preparation. Your elbow was up high."
      : "Lift your racket elbow above shoulder height before you swing.",
    joints: [side.shoulder, side.elbow],
    focusJoint: pass ? null : side.elbow,
  };
}

function fullExtension(win: Landmark[][], handedness: Handedness, aspect: number): CheckResult {
  const side = racketSide(handedness);
  const base = { id: "full_extension", name: "Full arm extension", target: `≥ ${T.extension}°` };
  const top = best(win, (lm) =>
    visible(lm, side.shoulder, side.elbow) && wristSeen(lm, side.wrist)
      ? angle(pt(lm, side.shoulder, aspect), pt(lm, side.elbow, aspect), pt(lm, side.wrist, aspect))
      : null,
  );
  if (!top) return skip(base);
  const value = round(top.value);
  const pass = value >= T.extension;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Great reach. You hit at full stretch."
      : "Reach up and hit at full stretch. Your arm is bent at contact.",
    joints: [side.shoulder, side.elbow, side.wrist],
    focusJoint: pass ? null : side.elbow,
  };
}

function reachHigh(win: Landmark[][], handedness: Handedness, aspect: number): CheckResult {
  const side = racketSide(handedness);
  const base = {
    id: "contact_high",
    name: "Reach at contact",
    target: `wrist ≥ ${T.reach}× torso above shoulder`,
  };
  const top = best(win, (lm) => heightAboveShoulder(lm, side.wrist, side.shoulder, aspect));
  if (!top) return skip(base);
  const value = round(top.value, 2);
  const pass = value >= T.reach;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Good contact point, high above your head."
      : "Meet the shuttle higher, at full reach above your head.",
    joints: [side.elbow, side.wrist],
    focusJoint: pass ? null : side.wrist,
  };
}

/** Preparation checks over a window of frames (the second before contact). */
export function analyseClearPrepWindow(
  win: Landmark[][],
  handedness: Handedness,
  aspect = 16 / 9,
  stroke: Stroke = "forehand",
  elbowWin: Landmark[][] = win,
): Analysis {
  return analysis([
    sideOn(win, aspect),
    freeArmUp(win, handedness, aspect, stroke),
    elbowHigh(elbowWin, handedness, aspect),
  ]);
}

/** Contact checks over the frames around contact. */
export function analyseClearContactWindow(
  win: Landmark[][],
  handedness: Handedness,
  aspect = 16 / 9,
): Analysis {
  return analysis([fullExtension(win, handedness, aspect), reachHigh(win, handedness, aspect)]);
}

/** Preparation checks on a single frame: live feedback between swings. */
export function analyseClearPrep(
  lm: Landmark[],
  handedness: Handedness,
  aspect = 16 / 9,
): Analysis {
  return analyseClearPrepWindow([lm], handedness, aspect, strokeOf(lm, aspect));
}

/** Contact checks on a single frame. */
export function analyseClearContact(
  lm: Landmark[],
  handedness: Handedness,
  aspect = 16 / 9,
): Analysis {
  return analyseClearContactWindow([lm], handedness, aspect);
}

/**
 * Scores one detected swing: preparation over the second before contact (elbow over
 * the last 0.6 s), contact at its best within ±150 ms, stroke from the contact frame.
 */
export function analyseSwing(
  frames: Frame[],
  swing: Swing,
  handedness: Handedness,
  aspect = 16 / 9,
): { prep: Analysis; contact: Analysis; stroke: Stroke } {
  const contact = frames[swing.contactIndex];
  if (!contact) throw new RangeError("Swing contact is outside the frames");
  const within = (from: number, to: number) =>
    frames.filter((f) => f.t >= contact.t + from && f.t <= contact.t + to).map((f) => f.lm);
  const stroke = strokeOf(contact.lm, aspect);
  const prep = analyseClearPrepWindow(
    within(-SWING_WINDOWS.prepMs, 0),
    handedness,
    aspect,
    stroke,
    within(-SWING_WINDOWS.elbowMs, 0),
  );
  const near = within(-SWING_WINDOWS.contactMs, SWING_WINDOWS.contactMs);
  return { prep, contact: analyseClearContactWindow(near, handedness, aspect), stroke };
}

/** Prep and contact checks merged into one verdict for a whole swing. */
export function combineAnalyses(...parts: Analysis[]): Analysis {
  return analysis(parts.flatMap((p) => p.checks));
}

/** Per-frame live feedback for the selected move. */
export function analyseFrame(
  move: Move,
  lm: Landmark[],
  handedness: Handedness,
  aspect = 16 / 9,
): Analysis {
  return move === "stance"
    ? analyseStance(lm, handedness, aspect)
    : analyseClearPrep(lm, handedness, aspect);
}
