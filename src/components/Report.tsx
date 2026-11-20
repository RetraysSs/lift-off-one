import { ChevronDown, TriangleAlert } from "lucide-react";
import type { ReportData } from "@/engine/types";
import { combineAnalyses } from "@/engine/analysis";
import { Score, CheckList, TipCard, measuredValue } from "@/components/FeedbackPanel";
import { Snapshot } from "@/components/SwingVerdict";

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function Report({ report }: { report: ReportData }) {
  const all =
    report.move === "stance"
      ? report.stance
      : report.swings.length
        ? combineAnalyses(...report.swings.flatMap((s) => [s.prep, s.contact]))
        : null;
  const topTip = all?.checks.find((c) => c.status === "fail");
  return (
    <div className="fade-in">
      <div className="tile p-5">
        <Score
          value={report.score}
          label={report.move === "clear" ? "Average swing score" : "Stance score"}
        />
      </div>
      {topTip && (
        <div className="mt-4">
          <TipCard check={topTip} />
        </div>
      )}

      {report.move === "stance" && report.stance && (
        <section className="tile p-4 mt-4">
          <h3 className="font-semibold text-sm mb-3">Ready stance</h3>
          <Snapshot
            {...(report.stanceSnapshot ? { src: report.stanceSnapshot } : {})}
            label="Stance snapshot"
          />
          <CheckList analysis={report.stance} />
        </section>
      )}

      {report.move === "clear" &&
        (report.swings.length === 0 ? (
          <div className="mt-4 rounded-2xl bg-warning-soft text-warning p-4 flex gap-3 text-sm">
            <TriangleAlert size={18} className="shrink-0" />
            <p>
              No swing detected. Stand side-on with your whole body in frame and swing your racket
              arm fully above your head.
            </p>
          </div>
        ) : (
          report.swings.map((swing) => {
            const verdict = combineAnalyses(swing.prep, swing.contact);
            const fails = verdict.checks.filter((c) => c.status === "fail");
            return (
              <section key={swing.index} className="tile p-4 mt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-sm">
                    Swing {swing.index}
                    <span className="text-muted-foreground font-normal ml-2 text-xs">
                      at {seconds(swing.contactTimeMs)}
                    </span>
                  </h3>
                  <span className="display text-sm text-violet font-semibold">
                    {swing.score ?? "–"} / 100
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Snapshot
                    {...(swing.prepSnapshot ? { src: swing.prepSnapshot } : {})}
                    label="Preparation"
                  />
                  <Snapshot
                    {...(swing.contactSnapshot ? { src: swing.contactSnapshot } : {})}
                    label="Contact"
                  />
                </div>
                {fails.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {fails.map((check) => (
                      <li key={check.id}>
                        <p className="text-sm font-medium leading-relaxed">{check.tip}</p>
                        <p className="text-fail text-xs mt-0.5">
                          {check.name}: {measuredValue(check)} · target {check.target}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-pass font-medium">
                    Every measured check on target.
                  </p>
                )}
                <details className="group mt-3">
                  <summary className="text-xs font-semibold text-violet cursor-pointer list-none flex items-center gap-1">
                    All checks
                    <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="eyebrow mt-3">Preparation</p>
                  <CheckList analysis={swing.prep} />
                  <p className="eyebrow mt-2">Contact</p>
                  <CheckList analysis={swing.contact} />
                </details>
              </section>
            );
          })
        ))}
    </div>
  );
}
