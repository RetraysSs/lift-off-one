import type { Analysis, CheckResult, ReportData } from "@/engine/types";

const check = (
  data: Pick<CheckResult, "id" | "name" | "status" | "value" | "target" | "tip">,
): CheckResult => ({ ...data, joints: [], focusJoint: null });

export const mockStanceAnalysis: Analysis = {
  score: 67,
  checks: [
    check({
      id: "knees_bent",
      name: "Knees bent",
      status: "fail",
      value: 172,
      target: "130–160°",
      tip: "Bend your knees more. You're too upright to move quickly.",
    }),
    check({
      id: "feet_apart",
      name: "Feet shoulder-width apart",
      status: "pass",
      value: 1.3,
      target: "1.0–1.6× shoulder width",
      tip: "Good base. Keep your feet comfortably apart.",
    }),
    check({
      id: "racket_up",
      name: "Racket up",
      status: "pass",
      value: null,
      target: "wrist above elbow",
      tip: "Keep your racket up and ready.",
    }),
    check({
      id: "weight_forward",
      name: "Weight forward",
      status: "skip",
      value: null,
      target: "side-on view only",
      tip: "Use a side-on view to check your weight distribution.",
    }),
  ],
};

export const mockClearAnalysis: Analysis = {
  score: 50,
  checks: [
    check({
      id: "side_on",
      name: "Side-on position",
      status: "pass",
      value: 0.31,
      target: "< 0.4",
      tip: "Good position. Keep your shoulders side-on.",
    }),
    check({
      id: "free_arm_up",
      name: "Free arm raised",
      status: "fail",
      value: null,
      target: "wrist above shoulder",
      tip: "Raise your other arm to point at the shuttle for balance.",
    }),
    check({
      id: "elbow_high",
      name: "Elbow high",
      status: "pass",
      value: null,
      target: "elbow above shoulder",
      tip: "Good preparation. Keep your elbow high.",
    }),
    check({
      id: "full_extension",
      name: "Full arm extension",
      status: "fail",
      value: 138,
      target: "> 160°",
      tip: "Reach up and hit at full stretch. Your arm is bent at contact.",
    }),
  ],
};

export const mockReport: ReportData = {
  move: "clear",
  score: 50,
  swings: [1, 2].map((index) => ({
    index,
    prepTimeMs: index * 1800,
    contactTimeMs: index * 1800 + 600,
    prep: mockClearAnalysis,
    contact: mockClearAnalysis,
    score: 50,
  })),
};
