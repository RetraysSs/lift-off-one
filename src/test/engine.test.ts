import { describe, expect, it } from "vitest";
import type { Analysis, CheckResult } from "@/engine/types";
import {
  analyseClearContact,
  analyseClearPrep,
  analyseStance,
  scoreChecks,
  sideOnRatio,
} from "@/engine/analysis";
import { angle } from "@/engine/pose";
import { detectSwings, diagnoseSwings, findSwings } from "@/engine/swings";
import { buildReport, NoPlayerError } from "@/engine/report";
import { buildLiveReport } from "@/engine/live";
import { jointColors } from "@/engine/draw";
import { COLORS } from "@/engine/config";
import {
  clearFrames,
  facingPose,
  occludedSwingFrames,
  pose,
  sidePose,
  swingFrames,
} from "./fixtures";

const byId = (a: Analysis, id: string): CheckResult => a.checks.find((c) => c.id === id)!;

describe("geometry", () => {
  it("measures interior angles in degrees", () => {
    expect(angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(angle({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180);
  });
});

describe("ready stance", () => {
  it("passes a good athletic stance facing the camera", () => {
    const a = analyseStance(facingPose(), "right", 1);
    expect(byId(a, "knees_bent")).toMatchObject({ status: "pass" });
    expect(byId(a, "knees_bent").value).toBeGreaterThanOrEqual(130);
    expect(byId(a, "knees_bent").value).toBeLessThanOrEqual(160);
    expect(byId(a, "feet_apart")).toMatchObject({ status: "pass", value: 1.5 });
    expect(byId(a, "racket_up").status).toBe("pass");
    // Facing the camera, weight distribution can't be judged.
    expect(byId(a, "weight_forward").status).toBe("skip");
    expect(a.score).toBe(100);
  });

  it("flags straight legs with the coaching tip and a focus knee", () => {
    const knees = byId(analyseStance(facingPose({ upright: true }), "right", 1), "knees_bent");
    expect(knees.status).toBe("fail");
    expect(knees.value).toBeGreaterThan(170);
    expect(knees.tip).toMatch(/Bend your knees/);
    expect([25, 26]).toContain(knees.focusJoint);
  });

  it("flags narrow feet and a dropped racket", () => {
    const a = analyseStance(facingPose({ feet: 0.08, racketUp: false }), "right", 1);
    expect(byId(a, "feet_apart").status).toBe("fail");
    expect(byId(a, "racket_up").status).toBe("fail");
    // In this fixture narrow feet also straighten the legs, so every measured check fails.
    expect(a.score).toBe(0);
  });

  it("uses the left arm for left-handed players", () => {
    // Left wrist (15) sits below the left elbow (13) in the fixture.
    expect(byId(analyseStance(facingPose(), "left", 1), "racket_up").status).toBe("fail");
  });

  it("skips checks it cannot see instead of failing them", () => {
    const a = analyseStance(pose({}), "right", 1);
    expect(a.checks.every((c) => c.status === "skip")).toBe(true);
    expect(a.score).toBeNull();
  });
});

describe("overhead clear", () => {
  it("detects a side-on body", () => {
    expect(sideOnRatio(sidePose(0.2), 1)!).toBeLessThan(0.4);
    expect(sideOnRatio(facingPose(), 1)!).toBeGreaterThan(0.4);
  });

  it("scores preparation checks", () => {
    const good = analyseClearPrep(sidePose(0.2), "right", 1);
    expect(good.checks.map((c) => c.status)).toEqual(["pass", "pass", "pass"]);
    const bad = analyseClearPrep(sidePose(0.2, { freeArmUp: false, elbowY: 0.45 }), "right", 1);
    expect(byId(bad, "free_arm_up").status).toBe("fail");
    expect(byId(bad, "elbow_high").status).toBe("fail");
  });

  it("checks extension and height at contact", () => {
    // Elbow just above the shoulder with the wrist far overhead: arm bent (~125°).
    const bent = analyseClearContact(sidePose(0.02, { elbowY: 0.28 }), "right", 1);
    expect(byId(bent, "contact_high").status).toBe("pass");
    expect(byId(bent, "full_extension").status).toBe("fail");
    const straight = analyseClearContact(
      pose({ 0: [0.5, 0.15], 12: [0.49, 0.3], 14: [0.48, 0.18], 16: [0.47, 0.05] }),
      "right",
      1,
    );
    expect(byId(straight, "full_extension")).toMatchObject({ status: "pass" });
  });
});

describe("swing detection", () => {
  it("finds each overhead swing once, with preparation before contact", () => {
    const frames = swingFrames([1000, 2600], 3500);
    const swings = detectSwings(frames, "right", 1);
    expect(swings).toHaveLength(2);
    for (const [i, s] of swings.entries()) {
      const contact = frames[s.contactIndex]!;
      expect(Math.abs(contact.t - [1000, 2600][i]!)).toBeLessThan(70);
      expect(s.prepIndex).toBeLessThan(s.contactIndex);
    }
  });

  it("still finds swings when side-on hides the far shoulder and hip", () => {
    // Far-side joints at 0.3 visibility and a blurred wrist at 0.4: typical of a
    // compressed side-on recording. Live and recorded analysis must agree here.
    for (const fps of [30, 15]) {
      const swings = detectSwings(occludedSwingFrames([1000, 2600], 3500, fps), "right", 1);
      expect(swings).toHaveLength(2);
    }
  });

  it("finds the same swings at the live and the file sampling rate", () => {
    for (const fps of [30, 15]) {
      const frames = occludedSwingFrames([800, 2100], 3000, fps);
      const contacts = detectSwings(frames, "right", 1).map((s) => frames[s.contactIndex]!.t);
      expect(contacts).toHaveLength(2);
      contacts.forEach((t, i) => expect(Math.abs(t - [800, 2100][i]!)).toBeLessThan(70));
    }
  });

  it("finds a swing whose racket hand leaves the top of the frame", () => {
    expect(
      detectSwings(clearFrames([1000, 2600], 3500, { peakY: -0.06 }), "right", 1),
    ).toHaveLength(2);
  });

  it("finds a shadow swing that only just clears the head", () => {
    // Wrist peaks just above the nose: a practice swing without full reach. The
    // contact-height check grades it; detection must still count it.
    expect(detectSwings(clearFrames([1000, 2600], 3500, { peakY: 0.14 }), "right", 1)).toHaveLength(
      2,
    );
  });

  it("finds swings when the racket-side shoulder is hidden", () => {
    const frames = clearFrames([1000, 2600], 3500, { hideRacketShoulder: true });
    expect(detectSwings(frames, "right", 1)).toHaveLength(2);
  });

  it("finds swings on the other arm when the arm labels are swapped, and says so", () => {
    const found = findSwings(clearFrames([1000, 2600], 3500, { swapArms: true }), "right", 1);
    expect(found.swings).toHaveLength(2);
    expect(found.handedness).toBe("left");
  });

  it("explains why no swing was found", () => {
    const still = diagnoseSwings(swingFrames([], 3000), "right", 1);
    expect(still.reason).toBe("not-high");
    const unseen = diagnoseSwings(
      swingFrames([], 3000).map((f) => ({ ...f, lm: f.lm.map((l) => ({ ...l, visibility: 0 })) })),
      "right",
      1,
    );
    expect(unseen.reason).toBe("not-tracked");
  });

  it("does not count raising the racket and holding it up as a swing", () => {
    // Wrist rises to above the head over 400 ms and stays there (with jitter): no follow-through.
    const frames = Array.from({ length: 90 }, (_, n) => {
      const t = (n * 1000) / 30;
      const y =
        t < 600
          ? 0.36
          : t < 1000
            ? 0.36 - ((t - 600) / 400) * 0.3
            : 0.06 + Math.sin(n * 2.3) * Math.cos(n * 0.7) * 0.006;
      return { t, lm: sidePose(y) };
    });
    expect(detectSwings(frames, "right", 1)).toEqual([]);
  });

  it("does not join frames from two different bodies into one swing", () => {
    // A camera cut (or the tracker hopping to someone else): before 900 ms the pose is a
    // much bigger body elsewhere in the frame, so its low wrist is not this swing's prep.
    const frames = clearFrames([1000], 2000).map((f) =>
      f.t < 900 ? { ...f, lm: f.lm.map((l) => ({ ...l, x: l.x * 2 - 0.6, y: l.y * 2 - 0.2 })) } : f,
    );
    expect(detectSwings(frames, "right", 1)).toEqual([]);
  });

  it("ignores a single-frame wrist glitch", () => {
    // Seen on real footage at 15 fps: one frame reads high, its neighbours are far below.
    const frames = Array.from({ length: 45 }, (_, n) => {
      const t = (n * 1000) / 15;
      return { t, lm: sidePose(n === 25 ? 0.12 : 0.4) };
    });
    expect(detectSwings(frames, "right", 1)).toEqual([]);
  });

  it("does not pair preparation and contact from a body that drifted between them", () => {
    // Seen on real footage: after a cut the tracker shrinks onto another player gradually,
    // in steps small enough to look continuous frame to frame.
    // Before 1.3 s the tracker is on a still, much bigger body; it shrinks onto the
    // swinging player in steps of under 1.4x, so no single step looks like a jump.
    const swing = clearFrames([1400], 2400, { fps: 15 });
    const scaleAt = (t: number) => (t < 1250 ? 2.5 : t < 1300 ? 1.9 : t < 1370 ? 1.38 : 1);
    const frames = swing.map((f) => {
      const s = scaleAt(f.t);
      const lm = f.t < 1300 ? sidePose(0.4) : f.lm;
      return {
        ...f,
        lm: lm.map((l) => ({ ...l, x: 0.5 + (l.x - 0.5) * s, y: 0.5 + (l.y - 0.5) * s })),
      };
    });
    expect(detectSwings(frames, "right", 1)).toEqual([]);
  });

  it("ignores a still player", () => {
    expect(detectSwings(swingFrames([], 3000), "right", 1)).toEqual([]);
  });
});

describe("reports", () => {
  it("builds a clear report with one entry per swing and snapshot key frames", () => {
    const { report, keyFrames } = buildReport(swingFrames([900, 2400], 3200), "clear", "right", 1);
    expect(report.swings.map((s) => s.index)).toEqual([1, 2]);
    expect(keyFrames).toHaveLength(4);
    keyFrames[1]!.assign(report, "data:image/jpeg;base64,x");
    expect(report.swings[0]!.contactSnapshot).toBe("data:image/jpeg;base64,x");
    expect(report.score).not.toBeNull();
  });

  it("reports no swings rather than inventing one", () => {
    const { report } = buildReport(swingFrames([], 2000), "clear", "right", 1);
    expect(report).toMatchObject({ swings: [], score: null });
    // ...and says why, so the player knows what to change.
    expect(report.notice).toMatch(/never went clearly above your head/);
  });

  it("scores swings found on the other arm and tells the player", () => {
    const frames = clearFrames([900, 2400], 3200, { swapArms: true });
    const { report } = buildReport(frames, "clear", "right", 1);
    expect(report.swings).toHaveLength(2);
    expect(report.notice).toMatch(/tracked on your left arm/);
    // Checks ran on the arm that swung, so extension was measured.
    expect(
      report.swings[0]!.contact.checks.find((c) => c.id === "full_extension")?.status,
    ).not.toBe("skip");
  });

  it("builds a stance report from the representative frame", () => {
    const frames = [0, 1, 2].map((i) => ({ t: i * 100, lm: facingPose({ upright: i === 0 }) }));
    const { report, keyFrames } = buildReport(frames, "stance", "right", 1);
    expect(report.stance).toBeDefined();
    expect(report.score).toBe(100);
    expect(keyFrames).toHaveLength(1);
  });

  it("throws when no player was found", () => {
    expect(() => buildReport([], "stance", "right")).toThrow(NoPlayerError);
  });

  it("summarises a live stance session", () => {
    const good = analyseStance(facingPose(), "right", 1);
    const bad = analyseStance(facingPose({ upright: true }), "right", 1);
    const report = buildLiveReport(
      "stance",
      [{ analysis: good }, { analysis: bad }, { analysis: good }],
      [],
    );
    expect(report?.score).toBe(Math.round((100 + 67 + 100) / 3));
    expect(buildLiveReport("stance", [], [])).toBeNull();
  });
});

describe("scoring and overlay colours", () => {
  it("scores only measured checks", () => {
    const a = analyseStance(facingPose({ upright: true }), "right", 1);
    expect(scoreChecks(a.checks)).toBe(67);
  });

  it("colours failing joints red even when another check passes them", () => {
    const colors = jointColors(analyseStance(facingPose({ upright: true }), "right", 1));
    expect(colors.get(25)).toBe(COLORS.fail);
    expect(colors.get(16)).toBe(COLORS.pass);
  });
});
