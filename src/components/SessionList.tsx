import { ChevronRight, Trash2 } from "lucide-react";
import type { Session } from "@/lib/storage";
import { formatDate, reportTitle, SOURCE_LABEL } from "@/lib/format";

export function SessionList({
  sessions,
  onOpen,
  onDelete,
}: {
  sessions: Session[];
  onOpen: (session: Session) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <ul className="tile divide-y divide-border overflow-hidden">
      {sessions.map((s) => (
        <li key={s.id} className="flex items-center">
          <button
            type="button"
            className="flex-1 min-w-0 flex items-center gap-3 p-3.5 text-left active:bg-muted"
            onClick={() => onOpen(s)}
          >
            <span
              className={`display size-11 shrink-0 rounded-full grid place-items-center text-sm font-bold ${
                s.score === null
                  ? "bg-muted text-muted-foreground"
                  : s.score >= 75
                    ? "bg-primary text-primary-foreground"
                    : "bg-accent text-accent-foreground"
              }`}
              aria-label={s.score === null ? "No score" : `Score ${s.score}`}
            >
              {s.score ?? "–"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold truncate">{reportTitle(s.report)}</span>
              <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                {SOURCE_LABEL[s.source]} · {formatDate(s.date)}
                {s.report.swings.length ? ` · ${s.report.swings.length} swings` : ""}
              </span>
            </span>
            <ChevronRight size={17} className="text-muted-foreground shrink-0" />
          </button>
          {onDelete && (
            <button
              type="button"
              className="p-3.5 text-muted-foreground hover:text-fail"
              onClick={() => onDelete(s.id)}
              aria-label={`Delete ${reportTitle(s.report)} session from ${formatDate(s.date)}`}
            >
              <Trash2 size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
