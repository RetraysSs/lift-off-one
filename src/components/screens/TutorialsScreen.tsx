import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Gauge, Play, Smartphone, X } from "lucide-react";
import type { Move } from "@/engine/types";
import { TUTORIALS, type Tutorial } from "@/lib/tutorials";

function ClipPlayer({ src, poster, slow }: { src: string; poster: string; slow: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = slow ? 0.5 : 1;
  }, [slow, src]);
  useEffect(() => {
    setBlocked(false);
    // Autoplay can be refused (e.g. iOS Low Power Mode); offer a play button instead.
    ref.current?.play().catch(() => setBlocked(true));
  }, [src]);
  return (
    <div className="tutorial-video">
      <video
        ref={ref}
        key={src}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        onLoadedMetadata={(e) => (e.currentTarget.playbackRate = slow ? 0.5 : 1)}
        aria-label="Technique example video"
      />
      {blocked && (
        <button
          type="button"
          className="absolute inset-0 grid place-items-center"
          onClick={() => {
            void ref.current?.play();
            setBlocked(false);
          }}
          aria-label="Play example"
        >
          <span className="size-16 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg">
            <Play size={26} fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}

export function TutorialsScreen({
  onBack,
  onPractise,
  initial = "stance",
}: {
  onBack: () => void;
  onPractise: (move: Move) => void;
  initial?: Tutorial["id"];
}) {
  const [id, setId] = useState<Tutorial["id"]>(initial);
  // 0 = good form, 1.. = mistake clips
  const [view, setView] = useState(0);
  const [slow, setSlow] = useState(false);
  const tutorial = TUTORIALS.find((t) => t.id === id) ?? TUTORIALS[0]!;
  const showingGood = view === 0;
  const clip = showingGood ? tutorial.good : (tutorial.mistakes[view - 1] ?? tutorial.good);

  return (
    <div className="fade-in">
      <header className="flex items-center gap-3 px-5 pt-5">
        <button
          type="button"
          className="round-btn size-10"
          onClick={onBack}
          aria-label="Back to home"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="display text-xl font-semibold">Tutorials</h1>
          <p className="text-xs text-muted-foreground">Good form next to common mistakes</p>
        </div>
      </header>

      <div className="px-5 pt-4 pb-7">
        <div className="seg" role="tablist" aria-label="Technique">
          {TUTORIALS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={id === t.id}
              aria-pressed={id === t.id}
              onClick={() => {
                setId(t.id);
                setView(0);
              }}
              className="!text-[13px]"
            >
              {t.id === "stance" ? "Stance" : t.id === "fh-clear" ? "FH clear" : "BH clear"}
            </button>
          ))}
        </div>

        <div className="relative mt-4">
          <ClipPlayer src={clip.src} poster={clip.poster} slow={slow} />
          <div className="absolute top-3 left-3 right-3 flex justify-between gap-2 pointer-events-none">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                showingGood ? "bg-pass text-white" : "bg-fail text-white"
              }`}
            >
              {showingGood ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
              {showingGood ? "Good form" : "Common mistake"}
            </span>
            <button
              type="button"
              className="glass rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 pointer-events-auto"
              aria-pressed={slow}
              onClick={() => setSlow((s) => !s)}
            >
              <Gauge size={13} /> {slow ? "0.5×" : "1×"}
            </button>
          </div>
        </div>

        <div className="seg mt-3" role="group" aria-label="Example">
          <button type="button" aria-pressed={showingGood} onClick={() => setView(0)}>
            Good form
          </button>
          {tutorial.mistakes.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={view === i + 1}
              onClick={() => setView(i + 1)}
            >
              {tutorial.mistakes.length > 1 ? `Mistake ${i + 1}` : "Mistake"}
            </button>
          ))}
        </div>

        <section className="tile p-4 mt-4">
          <h2 className="text-sm font-semibold">
            {showingGood
              ? `What good ${tutorial.title.toLowerCase()} looks like`
              : "What goes wrong"}
          </h2>
          <ul className="mt-3 space-y-2.5">
            {clip.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm leading-snug">
                <span
                  className={`size-5 rounded-full shrink-0 grid place-items-center mt-px ${
                    showingGood ? "bg-pass-soft text-pass" : "bg-fail-soft text-fail"
                  }`}
                  aria-hidden="true"
                >
                  {showingGood ? (
                    <Check size={12} strokeWidth={3} />
                  ) : (
                    <X size={12} strokeWidth={3} />
                  )}
                </span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex items-center gap-2">
            <Smartphone size={14} className="shrink-0" /> Filming yourself: {tutorial.camera}
          </p>
        </section>

        <button
          type="button"
          onClick={() => onPractise(tutorial.move)}
          className="mt-4 w-full h-12 rounded-full bg-primary text-primary-foreground font-semibold"
        >
          Practise {tutorial.move === "stance" ? "your ready stance" : "your clear"}
        </button>
      </div>
    </div>
  );
}
