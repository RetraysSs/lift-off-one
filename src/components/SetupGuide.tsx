import { ScanLine, X, TriangleAlert } from "lucide-react";
import type { Move } from "@/engine/types";

export interface SetupGuideProps {
  visible: boolean;
  move?: Move;
  warning?: string;
  onDismiss: () => void;
}

export function SetupGuide({ visible, move, warning, onDismiss }: SetupGuideProps) {
  if (!visible) return null;
  return (
    <div className="setup-guide glass fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <ScanLine size={17} /> Find your position
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss setup guide"
          className="size-7 grid place-items-center rounded-full hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stage-muted">
        Prop your phone up 2–3 m away with your whole body in frame.{" "}
        {move === "clear"
          ? "For the overhead clear, put your phone where the net would be, facing you."
          : move === "stance"
            ? "Face the camera for the ready stance."
            : "Face the camera for the ready stance; for the clear, put your phone where the net would be."}
      </p>
      {warning && (
        <p className="mt-3 text-sm flex items-center gap-2 text-warning-soft">
          <TriangleAlert size={15} className="shrink-0" /> {warning}
        </p>
      )}
    </div>
  );
}
