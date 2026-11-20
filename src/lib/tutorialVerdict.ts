import type { Analysis, Frame, Move } from "@/engine/types";
import { buildReport } from "@/engine/report";
import { combineAnalyses } from "@/engine/analysis";
import { racketSide } from "@/engine/pose";

export interface TutorialVerdict {
  /** Colours the skeleton: checks that pass are green, faults red. */
  analysis: Analysis;
  score: number | null;
  /** Short badge text, e.g. "Forehand · 100" or "No swing". */
  label: string;
}

/**
 * What the coach engine makes of a tutorial clip, so the overlay shows the same verdict
 * a player would get. The reference player is right-handed.
 */
export function tutorialVerdict(move: Move, frames: Frame[], aspect: number): TutorialVerdict {
  const { report } = buildReport(frames, move, "right", aspect);
  if (move === "stance") {
    const analysis = report.stance ?? { checks: [], score: null };
    return { analysis, score: analysis.score, label: `Stance · ${analysis.score ?? "–"}` };
  }
  const swing = report.swings[0];
  if (swing) {
    const analysis = combineAnalyses(swing.prep, swing.contact);
    const stroke = swing.stroke === "backhand" ? "Backhand" : "Forehand";
    return { analysis, score: swing.score, label: `${stroke} · ${swing.score ?? "–"}` };
  }
  // No swing: mark the racket arm, which never got up high enough.
  const arm = racketSide("right");
  const analysis: Analysis = {
    score: null,
    checks: [
      {
        id: "swing",
        name: "Overhead swing",
        status: "fail",
        value: null,
        target: "racket hand above the head",
        tip: report.notice ?? "No overhead swing detected.",
        joints: [arm.shoulder, arm.elbow, arm.wrist],
        focusJoint: arm.wrist,
      },
    ],
  };
  return { analysis, score: null, label: "No swing detected" };
}
