import type { Analysis, Move, ReportData, SwingReport } from "./types";

export interface LiveSample {
  analysis: Analysis;
  snapshot?: string;
}

const mean = (xs: number[]) =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

/**
 * Summarises a live practice session. Stance: the session score is the average sampled
 * score and the shown analysis is the median sample. Clear: one entry per detected swing.
 * Returns null when nothing was measured.
 */
export function buildLiveReport(
  move: Move,
  samples: LiveSample[],
  swings: SwingReport[],
): ReportData | null {
  if (move === "clear") {
    if (swings.length === 0) return samples.length ? { move, score: null, swings: [] } : null;
    return {
      move,
      score: mean(swings.map((s) => s.score).filter((s): s is number => s !== null)),
      swings: swings.map((s, i) => ({ ...s, index: i + 1 })),
    };
  }
  const scored = samples.filter((s) => s.analysis.score !== null);
  if (scored.length === 0) return null;
  const sorted = [...scored].sort((a, b) => (a.analysis.score ?? 0) - (b.analysis.score ?? 0));
  const medianScore = sorted[Math.floor((sorted.length - 1) / 2)]?.analysis.score ?? 0;
  // Prefer a sample with a snapshot whose score is closest to the median.
  const withSnap = scored.filter((s) => s.snapshot);
  const pool = withSnap.length ? withSnap : scored;
  const rep = pool.reduce((best, s) =>
    Math.abs((s.analysis.score ?? 0) - medianScore) <
    Math.abs((best.analysis.score ?? 0) - medianScore)
      ? s
      : best,
  );
  return {
    move,
    score: mean(scored.map((s) => s.analysis.score ?? 0)),
    swings: [],
    stance: rep.analysis,
    ...(rep.snapshot ? { stanceSnapshot: rep.snapshot } : {}),
  };
}
