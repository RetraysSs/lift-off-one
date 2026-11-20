import { useEffect, useRef } from "react";
import { ChevronRight, X } from "lucide-react";
import type { Move } from "@/engine/types";
import { ClearIcon, StanceIcon } from "@/components/MoveIcons";

const OPTIONS: { move: Move; title: string; body: string; camera: string }[] = [
  {
    move: "stance",
    title: "Ready stance",
    body: "Hold your base while it checks knees, feet and racket.",
    camera: "Face the camera",
  },
  {
    move: "clear",
    title: "Overhead clear",
    body: "Swing for real; each swing is detected and scored.",
    camera: "Phone where the net would be",
  },
];

/** Bottom sheet asking which move to practise. */
export function PracticeChooser({
  onChoose,
  onClose,
}: {
  onChoose: (move: Move) => void;
  onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="practice-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 fade-in"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-t-[30px] px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))] slide-up-sheet">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="practice-title" className="display text-lg font-semibold">
              What are you practising?
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">Live coaching with your camera</p>
          </div>
          <button
            type="button"
            className="round-btn size-10 shadow-none border border-border"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {OPTIONS.map((o, i) => (
            <button
              key={o.move}
              ref={i === 0 ? first : undefined}
              type="button"
              onClick={() => onChoose(o.move)}
              className={`w-full text-left rounded-[22px] p-4 flex items-center gap-4 active:scale-[.98] transition ${
                o.move === "stance"
                  ? "bg-primary text-primary-foreground"
                  : "bg-lime text-foreground"
              }`}
            >
              <span className="size-14 rounded-2xl bg-white/45 grid place-items-center shrink-0">
                {o.move === "stance" ? <StanceIcon /> : <ClearIcon />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold">{o.title}</span>
                <span className="block text-sm opacity-80 mt-0.5 leading-snug">{o.body}</span>
                <span className="inline-block text-[11px] font-semibold mt-2 rounded-full bg-white/55 px-2 py-0.5">
                  {o.camera}
                </span>
              </span>
              <ChevronRight size={20} className="shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
