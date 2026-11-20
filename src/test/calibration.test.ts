import { describe, expect, it } from "vitest";
import type { Frame, ReportData } from "@/engine/types";
import { buildFullReport, buildReport } from "@/engine/report";
import reference from "./fixtures/reference-poses.json";

/**
 * Real poses from the coach's reference clips (good vs bad technique). These pin the
 * calibration in engine/config.ts: good technique must clearly outscore bad.
 */
type Clip = { aspect: number; frames: [number, [number, number, number][]][] };
const data = reference as unknown as Record<string, Clip> & { landmarks: number[] };

function load(id: string): { frames: Frame[]; aspect: number } {
  const clip = data[id] as Clip;
  const frames = clip.frames.map(([t, kept]) => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    data.landmarks.forEach((i, k) => {
      const [x, y, visibility] = kept[k]!;
      lm[i] = { x, y, z: 0, visibility };
    });
    return { t, lm };
  });
  return { frames, aspect: clip.aspect };
}

const report = (id: string, move: "stance" | "clear"): ReportData => {
  const { frames, aspect } = load(id);
  return buildReport(frames, move, "right", aspect).report;
};

const failed = (r: ReportData, id: string) =>
  r.swings.filter((s) =>
    [...s.prep.checks, ...s.contact.checks].some((c) => c.id === id && c.status === "fail"),
  ).length;

describe("calibration on the reference clips", () => {
  const fhGood = report("fh-clear-good", "clear");
  const fhBad = report("fh-clear-bad", "clear");
  const bhGood = report("bh-clear-good", "clear");

  it("finds every forehand and backhand rep", () => {
    expect(fhGood.swings).toHaveLength(6);
    expect(fhBad.swings).toHaveLength(3);
    expect(bhGood.swings).toHaveLength(5);
  });

  it("tells forehands from backhands", () => {
    expect(fhGood.swings.every((s) => s.stroke === "forehand")).toBe(true);
    expect(fhBad.swings.every((s) => s.stroke === "forehand")).toBe(true);
    expect(bhGood.swings.every((s) => s.stroke === "backhand")).toBe(true);
  });

  it("scores good forehands well above bad ones", () => {
    expect(fhGood.score).toBeGreaterThanOrEqual(80);
    expect(fhBad.score).toBeLessThanOrEqual(40);
    expect(fhGood.score! - fhBad.score!).toBeGreaterThanOrEqual(40);
  });

  it("flags the faults the bad forehand clip shows, and not on the good one", () => {
    // Bad clip: square to the net, free arm down, elbow low (see lib/tutorials.ts).
    for (const id of ["side_on", "free_arm_up", "elbow_high"]) {
      expect(failed(fhBad, id), id).toBe(fhBad.swings.length);
      expect(failed(fhGood, id), id).toBe(0);
    }
  });

  it("scores good backhands well, without asking for a raised free arm", () => {
    expect(bhGood.score).toBeGreaterThanOrEqual(80);
    for (const s of bhGood.swings)
      expect(s.prep.checks.find((c) => c.id === "free_arm_up")?.status).toBe("skip");
  });

  it("reports no swing when the racket never gets above the head", () => {
    for (const id of ["fh-clear-bad-2", "bh-clear-bad"]) {
      const r = report(id, "clear");
      expect(r.swings, id).toHaveLength(0);
      expect(r.notice, id).toMatch(/never went clearly above your head/);
    }
  });

  it("scores the good ready stance above the bad one", () => {
    const good = report("stance-good", "stance");
    const bad = report("stance-bad", "stance");
    expect(good.score).toBeGreaterThanOrEqual(80);
    expect(bad.score).toBeLessThan(good.score!);
    expect(bad.stance?.checks.find((c) => c.id === "feet_apart")?.status).toBe("fail");
  });
});

describe("overall video analysis on the reference clips", () => {
  const full = (id: string) => {
    const { frames, aspect } = load(id);
    return buildFullReport(frames, "right", aspect).report;
  };
  const clearScore = (r: ReportData) => {
    const s = r.swings.map((w) => w.score ?? 0);
    return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null;
  };

  it("scores a good ready stance video on its stance, with no swings invented", () => {
    const good = full("stance-good");
    const bad = full("stance-bad");
    expect(good.scope).toBe("full");
    expect(good.swings).toHaveLength(0);
    expect(bad.swings).toHaveLength(0);
    expect(good.stance?.score).toBeGreaterThanOrEqual(80);
    expect(good.score!).toBeGreaterThan(bad.score!);
  });

  it("finds clears and the ready stance between them in the same video", () => {
    const fh = full("fh-clear-good");
    expect(fh.swings).toHaveLength(6);
    expect(fh.swings.some((s) => s.low)).toBe(false);
    expect(fh.stance).toBeDefined();
    expect(fh.score).toBeGreaterThanOrEqual(80);
    expect(full("bh-clear-good").swings).toHaveLength(5);
  });

  it("counts clear attempts that stay below head height instead of ignoring them", () => {
    const good = clearScore(full("fh-clear-good"))!;
    for (const id of ["fh-clear-bad-2", "bh-clear-bad"]) {
      const r = full(id);
      expect(r.swings.length, id).toBeGreaterThan(0);
      expect(
        r.swings.every((s) => s.low),
        id,
      ).toBe(true);
      expect(clearScore(r)!, id).toBeLessThan(good);
      expect(r.score!, id).toBeLessThan(full("fh-clear-good").score!);
    }
  });

  it("ranks bad clear technique well below good overall", () => {
    expect(full("fh-clear-bad").score).toBeLessThanOrEqual(40);
  });
});
