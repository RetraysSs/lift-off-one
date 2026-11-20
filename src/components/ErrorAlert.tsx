import { TriangleAlert, RotateCcw, X } from "lucide-react";

export function ErrorAlert({
  message,
  onRetry,
  onDismiss,
  className = "",
}: {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-2xl bg-card text-foreground border border-fail/30 shadow-lg p-3.5 flex gap-3 items-start fade-in ${className}`}
    >
      <TriangleAlert size={18} className="text-fail shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-violet"
          >
            <RotateCcw size={14} /> Try again
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-muted-foreground shrink-0"
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
