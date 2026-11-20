import { Check, X, Minus, Lightbulb, ArrowDown } from "lucide-react";
import type { Analysis, CheckResult } from "@/engine/types";

export function measuredValue(check: CheckResult) {
  if (check.value === null)
    return check.status === "skip"
      ? "Not measured"
      : check.status === "pass"
        ? "On target"
        : "Needs adjustment";
  if (check.target.includes("×")) return `${check.value}×`;
  return `${check.value}${check.target.includes("°") ? "°" : ""}`;
}

const STATUS_LABEL = { pass: "On target", fail: "Adjust", skip: "Not measured" } as const;

export function CheckList({ analysis }: { analysis: Analysis }) {
  return (
    <ul className="divide-y divide-border">
      {analysis.checks.map((check) => {
        const Icon = check.status === "pass" ? Check : check.status === "fail" ? X : Minus;
        return (
          <li key={check.id} className="py-3.5 flex gap-3">
            <span
              className={`status-${check.status} mt-0.5 shrink-0 size-7 rounded-full grid place-items-center ${
                check.status === "pass"
                  ? "bg-pass-soft"
                  : check.status === "fail"
                    ? "bg-fail-soft"
                    : "bg-muted"
              }`}
              aria-label={STATUS_LABEL[check.status]}
              role="img"
            >
              <Icon size={15} strokeWidth={2.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{check.name}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                <span className={check.status === "fail" ? "text-fail font-medium" : ""}>
                  {measuredValue(check)}
                </span>
                <span className="mx-1.5">·</span>target {check.target}
              </p>
              {check.status === "skip" && (
                <p className="text-xs text-muted-foreground mt-1">{check.tip}</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Score({ value, label = "Form score" }: { value: number | null; label?: string }) {
  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1.5">{label}</p>
          <p className="display text-4xl font-bold">
            {value ?? "–"}
            <span className="text-base font-normal text-muted-foreground ml-1.5">/ 100</span>
          </p>
        </div>
        <span className="text-xs text-muted-foreground pb-1.5">
          {value === null ? "Not measured" : value >= 80 ? "Looking good" : "Room to improve"}
        </span>
      </div>
      <div className="score-track mt-3" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span
            key={index}
            className={value !== null && index < Math.round(value / 10) ? "filled" : ""}
          />
        ))}
      </div>
    </>
  );
}

export function TipCard({ check }: { check: CheckResult }) {
  return (
    <div className="tip-card rounded-2xl border p-4">
      <div className="text-fail flex items-center gap-2 text-[11px] font-bold tracking-wide mb-2">
        <Lightbulb size={15} /> YOUR NEXT ADJUSTMENT
      </div>
      <p className="font-semibold text-[17px] leading-snug">{check.tip}</p>
      <div className="mt-2.5 text-fail text-xs flex gap-1.5 items-center">
        <ArrowDown size={13} />
        {check.name} · {measuredValue(check)}
      </div>
    </div>
  );
}

export function FeedbackPanel({
  analysis,
  showScore = true,
}: {
  analysis: Analysis | null;
  showScore?: boolean;
}) {
  if (!analysis)
    return (
      <p className="text-muted-foreground text-sm py-4">
        Step into frame to see your posture checks.
      </p>
    );
  const topTip = analysis.checks.find((check) => check.status === "fail");
  const measured = analysis.checks.filter((c) => c.status !== "skip").length;
  return (
    <div className="fade-in">
      {showScore && <Score value={analysis.score} />}
      {topTip && (
        <div className={showScore ? "mt-5" : ""}>
          <TipCard check={topTip} />
        </div>
      )}
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Posture checks</h3>
        <span className="text-xs text-muted-foreground">
          {analysis.checks.filter((c) => c.status === "pass").length} of {measured} on target
        </span>
      </div>
      <CheckList analysis={analysis} />
    </div>
  );
}
