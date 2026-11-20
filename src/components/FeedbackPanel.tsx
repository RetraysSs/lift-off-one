import { Check, X, Minus, Lightbulb, ArrowDown } from "lucide-react";
import type { Analysis, CheckResult } from "@/engine/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
export function measuredValue(check: CheckResult) {
  if (check.value === null)
    return check.status === "skip"
      ? "Not measured"
      : check.status === "pass"
        ? "On target"
        : "Needs adjustment";
  if (check.id === "feet_apart") return `${check.value}×`;
  return `${check.value}${check.target.includes("°") ? "°" : ""}`;
}
export function CheckList({ analysis }: { analysis: Analysis }) {
  return (
    <ul className="divide-y divide-border">
      {analysis.checks.map((check) => {
        const Icon = check.status === "pass" ? Check : check.status === "fail" ? X : Minus;
        return (
          <li key={check.id} className="py-4 flex gap-3">
            <span
              className={`status-${check.status} mt-0.5 shrink-0`}
              aria-label={check.status === "skip" ? "Not measured" : check.status}
            >
              <Icon size={19} strokeWidth={2.5} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{check.name}</p>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                <span className={check.status === "fail" ? "text-fail" : ""}>
                  {measuredValue(check)}
                </span>
                <span className="mx-1.5">·</span>target {check.target}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
export function Score({ value }: { value: number | null }) {
  return (
    <>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-2">Form score</p>
          <Badge variant="score">
            {value ?? "–"}
            <span className="text-lg font-normal text-muted-foreground ml-1.5">/ 100</span>
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground pb-2">
          {value === null ? "Not measured" : value >= 80 ? "Looking good" : "Room to improve"}
        </span>
      </div>
      <div className="score-track mt-4" aria-hidden="true">
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
export function FeedbackPanel({ analysis }: { analysis: Analysis | null }) {
  if (!analysis)
    return (
      <p className="text-muted-foreground text-sm py-6">Your coaching feedback will appear here.</p>
    );
  const topTip = analysis.checks.find((check) => check.status === "fail");
  return (
    <div className="fade-in">
      <Score value={analysis.score} />
      {topTip && (
        <Card className="tip-card mt-6 p-5">
          <div className="text-fail flex items-center gap-2 text-xs font-semibold mb-3">
            <Lightbulb size={16} /> YOUR NEXT ADJUSTMENT
          </div>
          <h3 className="font-display font-semibold text-[23px] leading-snug">{topTip.tip}</h3>
          <div className="mt-4 text-fail text-xs flex gap-1.5 items-center">
            <ArrowDown size={14} />
            {topTip.name} · {measuredValue(topTip)}
          </div>
        </Card>
      )}
      <div className="mt-7 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Posture checks</h3>
        <span className="text-xs text-muted-foreground">
          {analysis.checks.filter((c) => c.status === "pass").length} of{" "}
          {analysis.checks.filter((c) => c.status !== "skip").length} on target
        </span>
      </div>
      <CheckList analysis={analysis} />
    </div>
  );
}
