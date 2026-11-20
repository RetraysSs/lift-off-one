// Engine-facing configuration. Visual tokens for the DOM live in src/styles.css;
// the canvas overlay cannot read CSS variables cheaply, so it uses these hex values.
export const COLORS = { pass: "#30a46c", fail: "#e5484d", none: "#9a9a9a" };

/** Pinned to the installed @mediapipe/tasks-vision version so the WASM matches the JS. */
export const MEDIAPIPE_VERSION = "0.10.35";
export const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
export const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** Landmarks below this visibility are treated as unseen. */
export const MIN_VISIBILITY = 0.5;
/**
 * The racket wrist moves fast at contact, so it is often motion-blurred and scored below
 * `MIN_VISIBILITY`. Swing detection and the contact checks accept it at this confidence.
 */
export const MIN_WRIST_VISIBILITY = 0.3;

/**
 * Calibrated on the coach's reference clips (testvids/, poses in
 * src/test/fixtures/reference-poses.json). Measured values, good vs bad:
 * - Stance knees (front view): 166–170° set in stance vs 175–178° standing up.
 * - Stance feet: 1.2–1.5× shoulders in a good stance vs mostly ≤ 1.0× in the bad clip.
 * - Clear free arm, peak in the second before contact: +0.4–0.6 vs −0.9 torso lengths.
 * - Clear elbow, peak in the 0.6 s before contact: 0.24–0.34 vs 0.07–0.19.
 * - Clear side-on, most turned in the second before contact: 0.28–0.31 vs 0.56–0.61.
 * - Clear reach at contact: 0.62–0.75 vs 0.50–0.64 (bad).
 * - Elbow angle does not separate them from a front-on camera (foreshortening), so the
 *   extension bar is set where good swings reach it at their best moment.
 * Run `bunx vitest run src/test/calibration.test.ts` after changing any value.
 */
export const THRESHOLDS = {
  /** Ready stance knee angle (hip–knee–ankle), degrees. Front views read ~10° straighter. */
  kneeMin: 110,
  kneeMax: 172,
  /** Ankle distance ÷ shoulder distance. */
  feetMin: 1.1,
  feetMax: 1.9,
  /** Racket hand may sit this far (torso lengths) below hip height and still count as up. */
  racketBelowHip: 0.15,
  /** Shoulder width ÷ torso length below this means the player is side-on. */
  sideOnRatio: 0.4,
  /** Forward lean of shoulders over ankles, as a fraction of torso length. */
  weightForward: 0.04,
  /** Best elbow angle around contact for full extension, degrees. */
  extension: 150,
  /** Racket elbow must rise this far (torso lengths) above the shoulder while preparing. */
  elbowAbove: 0.2,
  /** Free-arm wrist must rise above its shoulder by this much while preparing. */
  freeArmAbove: 0,
  /** Racket wrist height above the shoulder at contact, torso lengths. */
  reach: 0.6,
  /**
   * Signed shoulder order (left − right, ÷ torso) at or below this means the player's back
   * faces the camera: a backhand clear in the reference setup.
   */
  backhandShoulders: -0.25,
} as const;

/** Frames per second sampled when analysing a long video file. */
export const ANALYSIS_FPS = 15;
/**
 * Clips up to this length are sampled at `SHORT_CLIP_FPS`, the same rate the live coach sees,
 * so a fast overhead contact is not skipped between samples.
 */
export const SHORT_CLIP_SECONDS = 30;
export const SHORT_CLIP_FPS = 30;
