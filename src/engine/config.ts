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

export const THRESHOLDS = {
  /** Ready stance knee angle (hip–knee–ankle), degrees. */
  kneeMin: 130,
  kneeMax: 160,
  /** Ankle distance ÷ shoulder distance. */
  feetMin: 1.0,
  feetMax: 1.6,
  /** Shoulder width ÷ torso length below this means the player is side-on. */
  sideOnRatio: 0.4,
  /** Forward lean of shoulders over ankles, as a fraction of torso length. */
  weightForward: 0.04,
  /** Elbow angle at contact for full extension, degrees. */
  extension: 160,
  /** Elbow may sit this fraction of torso length below the shoulder and still count as high. */
  elbowTolerance: 0.08,
} as const;

/** Frames per second sampled when analysing a long video file. */
export const ANALYSIS_FPS = 15;
/**
 * Clips up to this length are sampled at `SHORT_CLIP_FPS`, the same rate the live coach sees,
 * so a fast overhead contact is not skipped between samples.
 */
export const SHORT_CLIP_SECONDS = 30;
export const SHORT_CLIP_FPS = 30;
