/** Vertical score meter floating on the stage (modelled on the reference "kcal" pill). */
export function StatPill({ score, label = "Form" }: { score: number | null; label?: string }) {
  const bars = 6;
  const on = score === null ? 0 : Math.round((score / 100) * bars);
  return (
    <div className="flex flex-col items-end gap-2" aria-live="polite">
      <div className="text-right stage-title leading-tight">
        <p className="text-lg font-bold tabular-nums">{score ?? "–"}</p>
        <p className="text-[11px] font-medium opacity-90">{label} score</p>
      </div>
      <div
        className="stat-pill"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score ?? 0}
        aria-label={`${label} score`}
      >
        {Array.from({ length: bars }, (_, i) => {
          const lit = bars - i <= on;
          return (
            <span
              key={i}
              className={`bar ${lit ? "on" : ""} ${lit && score !== null && score < 50 ? "fail" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
