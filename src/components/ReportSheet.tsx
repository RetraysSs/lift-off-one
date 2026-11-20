import { useEffect, useRef } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { ReportData } from "@/engine/types";
import type { SessionSource } from "@/lib/storage";
import { Report } from "@/components/Report";
import { formatDate, MOVE_LABEL, SOURCE_LABEL } from "@/lib/format";

export interface OpenReport {
  report: ReportData;
  date: number;
  source: SessionSource | "example";
}

export function ReportSheet({
  open,
  onClose,
  onPracticeAgain,
}: {
  open: OpenReport;
  onClose: () => void;
  onPracticeAgain: () => void;
}) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay-screen" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <header className="flex items-center gap-3 px-4 pb-3 pt-[calc(14px+env(safe-area-inset-top,0px))] border-b border-border bg-card">
        <button
          ref={back}
          type="button"
          className="round-btn size-10"
          onClick={onClose}
          aria-label="Close report"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <h2 id="report-title" className="display font-semibold text-[15px]">
            {MOVE_LABEL[open.report.move]}
          </h2>
          <p className="text-xs text-muted-foreground">
            {open.source === "example"
              ? "Example report · sample data"
              : `${SOURCE_LABEL[open.source]} · ${formatDate(open.date)}`}
          </p>
        </div>
      </header>
      <div className="screen screen-pad">
        <Report report={open.report} />
        <button
          type="button"
          onClick={onPracticeAgain}
          className="mt-6 w-full h-13 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 py-3.5"
        >
          <RotateCcw size={17} /> Practise {MOVE_LABEL[open.report.move].toLowerCase()}
        </button>
      </div>
    </div>
  );
}
