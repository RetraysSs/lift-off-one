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
}
export interface ReportData {
  move: Move;
  score: number | null;
  swings: SwingReport[];
  stance?: Analysis;
  stanceSnapshot?: string;
  /** Coaching note about the analysis itself, e.g. why no swing was detected. */
  notice?: string;
}
