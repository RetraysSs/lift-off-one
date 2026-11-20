import type { Analysis, CheckResult, Handedness, Landmark, Move } from "./types";
import { THRESHOLDS as T } from "./config";
import { LM, angle, get, dist, freeSide, mid, pt, racketSide, torsoLength, visible } from "./pose";

const round = (n: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

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

function racketUp(lm: Landmark[], handedness: Handedness): CheckResult {
  const side = racketSide(handedness);
  const base = { id: "racket_up", name: "Racket up", target: "wrist above elbow" };
  if (!visible(lm, side.wrist, side.elbow)) return skip(base);
  const pass = get(lm, side.wrist).y < get(lm, side.elbow).y;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value: null,
    tip: pass
      ? "Keep your racket up and ready."
      : "Lift your racket hand above your elbow so you're ready to react.",
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
    racketUp(lm, handedness),
    weightForward(lm, aspect),
  ]);
}

// ---------- Overhead clear ----------

function sideOn(lm: Landmark[], aspect: number): CheckResult {
  const base = { id: "side_on", name: "Side-on position", target: `< ${T.sideOnRatio}` };
  const ratio = sideOnRatio(lm, aspect);
  if (ratio === null) return skip(base);
  const value = round(ratio, 2);
  const pass = value < T.sideOnRatio;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Good position. Keep your shoulders side-on."
      : "Turn side-on so your free shoulder points toward the net.",
    joints: [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip],
    focusJoint: pass ? null : LM.leftShoulder,
  };
}

function freeArmUp(lm: Landmark[], handedness: Handedness): CheckResult {
  const side = freeSide(handedness);
  const base = { id: "free_arm_up", name: "Free arm raised", target: "wrist above shoulder" };
  if (!visible(lm, side.wrist, side.shoulder)) return skip(base);
  const pass = get(lm, side.wrist).y < get(lm, side.shoulder).y;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value: null,
    tip: pass
      ? "Good balance. Your free arm is tracking the shuttle."
      : "Raise your other arm to point at the shuttle for balance.",
    joints: [side.shoulder, side.elbow, side.wrist],
    focusJoint: pass ? null : side.wrist,
  };
}

function elbowHigh(lm: Landmark[], handedness: Handedness, aspect: number): CheckResult {
  const side = racketSide(handedness);
  const base = { id: "elbow_high", name: "Elbow high", target: "elbow at or above shoulder" };
  if (!visible(lm, side.elbow, side.shoulder, LM.leftHip, LM.rightHip)) return skip(base);
  const tolerance = T.elbowTolerance * torsoLength(lm, aspect);
  const pass = get(lm, side.elbow).y <= get(lm, side.shoulder).y + tolerance;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value: null,
    tip: pass
      ? "Good preparation. Keep your elbow high."
      : "Lift your racket elbow to shoulder height before you swing.",
    joints: [side.shoulder, side.elbow],
    focusJoint: pass ? null : side.elbow,
  };
}

function fullExtension(lm: Landmark[], handedness: Handedness, aspect: number): CheckResult {
  const side = racketSide(handedness);
  const base = { id: "full_extension", name: "Full arm extension", target: `> ${T.extension}°` };
  if (!visible(lm, side.shoulder, side.elbow, side.wrist)) return skip(base);
  const value = round(
    angle(pt(lm, side.shoulder, aspect), pt(lm, side.elbow, aspect), pt(lm, side.wrist, aspect)),
  );
  const pass = value > T.extension;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value,
    tip: pass
      ? "Great reach. You're hitting at full stretch."
      : "Reach up and hit at full stretch. Your arm is bent at contact.",
    joints: [side.shoulder, side.elbow, side.wrist],
    focusJoint: pass ? null : side.elbow,
  };
}

function contactHigh(lm: Landmark[], handedness: Handedness): CheckResult {
  const side = racketSide(handedness);
  const base = { id: "contact_high", name: "Contact above head", target: "wrist above head" };
  if (!visible(lm, side.wrist, LM.nose)) return skip(base);
  const pass = get(lm, side.wrist).y < get(lm, LM.nose).y;
  return {
    ...base,
    status: pass ? "pass" : "fail",
    value: null,
    tip: pass
      ? "Good contact point, high above your head."
      : "Meet the shuttle higher, above and slightly in front of your head.",
    joints: [side.elbow, side.wrist],
    focusJoint: pass ? null : side.wrist,
  };
}

/** Preparation checks for the overhead clear (also used as live feedback between swings). */
export function analyseClearPrep(
  lm: Landmark[],
  handedness: Handedness,
  aspect = 16 / 9,
): Analysis {
  return analysis([
    sideOn(lm, aspect),
    freeArmUp(lm, handedness),
    elbowHigh(lm, handedness, aspect),
  ]);
}

export function analyseClearContact(
  lm: Landmark[],
  handedness: Handedness,
  aspect = 16 / 9,
): Analysis {
  return analysis([fullExtension(lm, handedness, aspect), contactHigh(lm, handedness)]);
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
