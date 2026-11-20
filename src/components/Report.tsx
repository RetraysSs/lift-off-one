import { ChevronDown, Info, TriangleAlert } from "lucide-react";
import type { Analysis, ReportData, SwingReport } from "@/engine/types";
import { combineAnalyses } from "@/engine/analysis";
import { Score, CheckList, TipCard, measuredValue } from "@/components/FeedbackPanel";
import { Snapshot } from "@/components/SwingVerdict";

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

const average = (swings: SwingReport[]) => {
  const s = swings.map((w) => w.score).filter((x): x is number => x !== null);
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
};

function Notice({
  tone,
  title,
  children,
}: {
  tone: "info" | "warn";
  title?: string;
  children: string;
}) {
  return (
    <div
      className={`mt-4 rounded-2xl p-4 flex gap-3 text-sm ${
        tone === "warn" ? "bg-warning-soft text-warning" : "bg-accent text-accent-foreground"
      }`}
    >
      {tone === "warn" ? (
        <TriangleAlert size={18} className="shrink-0" />
      ) : (
        <Info size={18} className="shrink-0" />
      )}
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <p className={title ? "mt-1" : ""}>{children}</p>
      </div>
    </div>
  );
}

function StanceSection({ report }: { report: ReportData }) {
  if (!report.stance) return null;
  return (
    <section className="tile p-4 mt-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-sm">Ready stance</h3>
        {report.scope === "full" && (
          <span className="display text-sm text-violet font-semibold">
            {report.stance.score ?? "–"} / 100
          </span>
        )}
      </div>
      <Snapshot
        {...(report.stanceSnapshot ? { src: report.stanceSnapshot } : {})}
        label="Stance snapshot"
      />
      <CheckList analysis={report.stance} />
    </section>
  );
}

function SwingCard({ swing }: { swing: SwingReport }) {
  const verdict = combineAnalyses(swing.prep, swing.contact);
  const fails = verdict.checks.filter((c) => c.status === "fail");
  return (
    <section className="tile p-4 mt-4">
      <div className="flex justify-between items-center mb-3 gap-2">
        <h3 className="font-semibold text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
          Swing {swing.index}
          {swing.stroke && (
            <span className="rounded-full bg-accent text-accent-foreground px-2 py-0.5 text-[11px] font-semibold">
              {swing.stroke === "backhand" ? "Backhand" : "Forehand"}
            </span>
          )}
          {swing.low && (
            <span className="rounded-full bg-fail-soft text-fail px-2 py-0.5 text-[11px] font-semibold">
              Below head height
            </span>
          )}
          <span className="text-muted-foreground font-normal text-xs">
            at {seconds(swing.contactTimeMs)}
          </span>
        </h3>
        <span className="display text-sm text-violet font-semibold shrink-0">
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
        <p className="mt-4 text-sm text-pass font-medium">Every measured check on target.</p>
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
}

/** Overall score split into its parts, for a full video analysis. */
function PartTiles({ report }: { report: ReportData }) {
  const clears = average(report.swings);
  const low = report.swings.filter((s) => s.low).length;
  const tile = (title: string, value: number | null, detail: string) => (
    <div className="tile p-3.5">
      <p className="stat-label">{title}</p>
      <p className="stat-value text-2xl mt-1">{value ?? "–"}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 mt-3">
      {tile(
        "Ready stance",
        report.stance?.score ?? null,
        report.stance ? "held between shots" : "not found",
      )}
      {tile(
        "Clears",
        clears,
        report.swings.length
          ? `${report.swings.length} swing${report.swings.length === 1 ? "" : "s"}${low ? `, ${low} low` : ""}`
          : "none found",
      )}
    </div>
  );
}

export function Report({ report }: { report: ReportData }) {
  const full = report.scope === "full";
  // The top tip comes from the clears first (in order), then the stance.
  const analyses: Analysis[] = [
    ...report.swings.flatMap((s) => [s.prep, s.contact]),
    ...(report.stance && (full || report.move === "stance") ? [report.stance] : []),
  ];
  const all = analyses.length ? combineAnalyses(...analyses) : null;
  const topTip = all?.checks.find((c) => c.status === "fail");
  const showStance = full || report.move === "stance";
  const showClears = full ? report.swings.length > 0 : report.move === "clear";

  return (
    <div className="fade-in">
      <div className="tile p-5">
        <Score
          value={report.score}
          label={
            full
              ? "Overall score"
              : report.move === "clear"
                ? "Average swing score"
                : "Stance score"
          }
        />
      </div>
      {full && <PartTiles report={report} />}
      {topTip && (
        <div className="mt-4">
          <TipCard check={topTip} />
        </div>
      )}

      {showStance && <StanceSection report={report} />}
      {full && !report.stance && report.score !== null && (
        <Notice tone="info" title="No ready stance found">
          Hold your ready position still for a moment between shots, facing the camera, so it can be
          scored.
        </Notice>
      )}

      {showClears && report.swings.length > 0 && report.notice && (
        <Notice tone="info">{report.notice}</Notice>
      )}
      {full && report.swings.length > 0 && <h2 className="eyebrow mt-6">Overhead clears</h2>}
      {showClears &&
        (report.swings.length === 0 ? (
          <Notice tone="warn" title="No swing detected">
            {report.notice ??
              "Put your phone where the net would be, facing you, with your whole body in frame, and swing your racket arm fully above your head."}
          </Notice>
        ) : (
          report.swings.map((swing) => <SwingCard key={swing.index} swing={swing} />)
        ))}
      {full && report.swings.length === 0 && report.score !== null && (
        <Notice tone="info" title="No overhead clears found">
          This video was scored on the ready stance only.
        </Notice>
      )}
      {full && report.score === null && report.notice && (
        <Notice tone="warn" title="Nothing to score">
          {report.notice}
        </Notice>
      )}
    </div>
  );
}
