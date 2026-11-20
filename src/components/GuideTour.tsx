import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

export interface TourStep {
  /** `data-tour` value of the element to spotlight; omit for a centred card. */
  target?: string;
  title: string;
  body: string;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const PAD = 6;
const BUBBLE_GAP = 14;

/**
 * First-visit screentips: dims the app, spotlights one element at a time and explains
 * where it leads. Positions are measured relative to `container` (the app frame).
 */
export function GuideTour({
  steps,
  container,
  onDone,
}: {
  steps: TourStep[];
  container: RefObject<HTMLElement | null>;
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const next = useRef<HTMLButtonElement>(null);
  const step = steps[i] ?? steps[0]!;
  const last = i === steps.length - 1;

  const measure = useCallback(() => {
    const root = container.current;
    if (!root) return;
    const frameRect = root.getBoundingClientRect();
    setFrame({ w: frameRect.width, h: frameRect.height });
    const el = step.target ? root.querySelector(`[data-tour="${step.target}"]`) : null;
    if (!el) return setBox(null);
    const r = el.getBoundingClientRect();
    setBox({ x: r.left - frameRect.left, y: r.top - frameRect.top, w: r.width, h: r.height });
  }, [container, step.target]);

  useLayoutEffect(() => {
    const root = container.current;
    const el = step.target ? root?.querySelector(`[data-tour="${step.target}"]`) : null;
    el?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    measure();
  }, [container, step.target, measure]);

  useEffect(() => {
    next.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("resize", measure);
    document.addEventListener("scroll", measure, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", measure);
      document.removeEventListener("scroll", measure, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [measure, onDone, steps.length, i]);

  // Bubble goes below the spotlight when there is room, otherwise above it.
  const below = box ? frame.h - (box.y + box.h) > 210 : false;
  const bubbleStyle = box
    ? below
      ? { top: box.y + box.h + PAD + BUBBLE_GAP }
      : { bottom: frame.h - box.y + PAD + BUBBLE_GAP }
    : { top: "50%", transform: "translateY(-50%)" };

  return (
    <div
      className="absolute inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
    >
      {box ? (
        <div
          className="tour-spotlight"
          style={{
            left: box.x - PAD,
            top: box.y - PAD,
            width: box.w + PAD * 2,
            height: box.h + PAD * 2,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[oklch(0.15_0.02_280/0.62)]" />
      )}
      <div className="tour-bubble fade-in" style={bubbleStyle} key={i}>
        <p className="text-[11px] font-bold tracking-wide text-violet">
          {step.target ? `STEP ${i} OF ${steps.length - 1}` : "WELCOME"}
        </p>
        <h2 id="tour-title" className="display text-[17px] font-semibold mt-1">
          {step.title}
        </h2>
        <p id="tour-body" className="text-sm text-muted-foreground leading-snug mt-1.5">
          {step.body}
        </p>
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {steps.map((_, n) => (
              <span
                key={n}
                className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-violet" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {!last && (
              <button
                type="button"
                className="h-9 px-3 text-sm font-semibold text-muted-foreground"
                onClick={onDone}
              >
                Skip
              </button>
            )}
            <button
              ref={next}
              type="button"
              className="h-9 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
              onClick={() => (last ? onDone() : setI(i + 1))}
            >
              {last ? "Let’s go" : i === 0 ? "Show me" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
