import type { Analysis, Frame, Handedness, Move, ReportData, SwingReport } from "./types";
import { analyseStance, analyseSwing, combineAnalyses } from "./analysis";
import { WHOLE_BODY, visible } from "./pose";
import { diagnoseSwings, findSwings } from "./swings";

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

function setSnapshot(
  report: ReportData,
  n: number,
  key: "prepSnapshot" | "contactSnapshot",
  url: string,
) {
  const swing = report.swings[n];
  if (swing) swing[key] = url;
}

/**
 * Picks the frame that represents how the player stands once set: the 75th-percentile
 * score among whole-body frames. A clip usually includes stepping in and standing up,
 * and the median frame can land on one of those moments.
 */
const SETTLED_QUANTILE = 0.75;

function pickStanceFrame(frames: Frame[], handedness: Handedness, aspect: number) {
  const scored = frames
    .map((f, i) => ({ i, f }))
    .filter(({ f }) => visible(f.lm, ...WHOLE_BODY))
    .map(({ i, f }) => ({ i, analysis: analyseStance(f.lm, handedness, aspect) }))
    .sort((a, b) => (a.analysis.score ?? -1) - (b.analysis.score ?? -1) || a.i - b.i);
  const median = scored[Math.floor((scored.length - 1) * SETTLED_QUANTILE)];
  if (median) return median;
  let best = 0;
  frames.forEach((f, i) => {
    if (meanVisibility(f) > meanVisibility(frameAt(frames, best))) best = i;
  });
  return { i: best, analysis: analyseStance(frameAt(frames, best).lm, handedness, aspect) };
}

/**
 * Turns a pose sequence into a report. Pure: snapshots are filled in afterwards by the
 * caller through the returned key frames.
 */
export function buildReport(
  frames: Frame[],
  move: Move,
  handedness: Handedness,
  aspect = 16 / 9,
): { report: ReportData; keyFrames: KeyFrame[] } {
  if (frames.length === 0) throw new NoPlayerError();

  if (move === "stance") {
    const pick = pickStanceFrame(frames, handedness, aspect);
    return {
      report: { move, score: pick.analysis.score, swings: [], stance: pick.analysis },
      keyFrames: [
        {
          frameIndex: pick.i,
          analysis: pick.analysis,
          assign: (r, url) => (r.stanceSnapshot = url),
        },
      ],
    };
  }

  const found = findSwings(frames, handedness, aspect);
  const { swings } = found;
  // Run the arm checks on whichever arm actually swung.
  const arm = found.handedness;
  const keyFrames: KeyFrame[] = [];
  const reports: SwingReport[] = swings.map((s, n) => {
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
    };
  });
  const scored = reports.map((r) => r.score).filter((s): s is number => s !== null);
  const score = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;
  const notice =
    reports.length === 0
      ? diagnoseSwings(frames, handedness, aspect).message
      : arm !== handedness
        ? swungOtherArmNotice(arm)
        : undefined;
  return { report: { move, score, swings: reports, ...(notice ? { notice } : {}) }, keyFrames };
}

/** Shown when swings were found on the arm opposite to the Racket hand setting. */
export function swungOtherArmNotice(arm: Handedness) {
  const Arm = arm === "right" ? "Right" : "Left";
  return `Your swings were tracked on your ${arm} arm, so it was used as your racket arm. If you play ${arm}-handed, set Racket hand to ${Arm} in Profile. If not, the camera mixed up your arms; turn a little more side-on.`;
}
