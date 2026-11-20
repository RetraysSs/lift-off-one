export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
export interface Frame {
  t: number;
  lm: Landmark[];
}

export type CheckStatus = "pass" | "fail" | "skip";
export interface CheckResult {
  id: string;
  name: string;
  status: CheckStatus;
  value: number | null;
  target: string;
  tip: string;
  joints: number[];
  focusJoint: number | null;
}
export interface Analysis {
  checks: CheckResult[];
  score: number | null;
}

export type Handedness = "right" | "left";
export type Mode = "live" | "upload";
export type Move = "stance" | "clear";
export interface Swing {
  prepIndex: number;
  contactIndex: number;
}

export interface SwingReport {
  index: number;
  prepSnapshot?: string;
  contactSnapshot?: string;
  prepTimeMs: number;
  contactTimeMs: number;
  prep: Analysis;
  contact: Analysis;
  score: number | null;
  /** Forehand or backhand clear (optional for sessions saved before strokes were detected). */
  stroke?: "forehand" | "backhand";
  /** Overall analysis only: a clear attempt whose racket hand never got above the head. */
  low?: boolean;
}
export interface ReportData {
  move: Move;
  /**
   * "full": an overall analysis of a whole video (every clear plus the ready stance held
   * between shots). Absent or "move" for a report on one move.
   */
  scope?: "move" | "full";
  score: number | null;
  swings: SwingReport[];
  stance?: Analysis;
  stanceSnapshot?: string;
  /** Coaching note about the analysis itself, e.g. why no swing was detected. */
  notice?: string;
}
