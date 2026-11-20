import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Gauge, Play, ScanLine, Smartphone, X } from "lucide-react";
import type { Frame, Move } from "@/engine/types";
import { drawPose } from "@/engine/draw";
import { TUTORIALS, type Tutorial, type TutorialClip } from "@/lib/tutorials";
import { expandTrack, frameAt, type PoseTrack } from "@/lib/poseFile";
import { tutorialVerdict, type TutorialVerdict } from "@/lib/tutorialVerdict";

interface LoadedPose {
  frames: Frame[];
  verdict: TutorialVerdict;
}

// Pose tracks are small and fixed, so keep them for the session.
const poseCache = new Map<string, Promise<LoadedPose>>();
function loadPose(clip: TutorialClip, move: Move) {
  let pending = poseCache.get(clip.pose);
  if (!pending) {
    pending = fetch(clip.pose)
      .then((r) => {
        if (!r.ok) throw new Error(`Pose track ${clip.pose}: ${r.status}`);
        return r.json() as Promise<PoseTrack & { landmarks: number[] }>;
      })
      .then((track) => {
        const frames = expandTrack(track.landmarks, track);
        return { frames, verdict: tutorialVerdict(move, frames, track.aspect) };
      });
    pending.catch(() => poseCache.delete(clip.pose));
    poseCache.set(clip.pose, pending);
  }
  return pending;
}

/** Looping example clip with the engine's skeleton analysis drawn over it. */
function ClipPlayer({
  clip,
  move,
  slow,
  skeleton,
}: {
  clip: TutorialClip;
  move: Move;
  slow: boolean;
  skeleton: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [blocked, setBlocked] = useState(false);
  const [pose, setPose] = useState<LoadedPose | null>(null);
  const { src, poster } = clip;

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

  useEffect(() => {
    let live = true;
    setPose(null);
    loadPose(clip, move)
      .then((p) => live && setPose(p))
      .catch(() => undefined); // The video still works without the overlay.
    return () => {
      live = false;
    };
  }, [clip, move]);

  // Draw the pose for the frame on screen, every animation frame.
  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    if (!skeleton || !pose) {
      ctx.clearRect(0, 0, c.width, c.height);
      return;
    }
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const v = ref.current;
      if (!v) return;
      if (v.videoWidth && (c.width !== v.videoWidth || c.height !== v.videoHeight)) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      const f = frameAt(pose.frames, v.currentTime * 1000);
      if (f) drawPose(ctx, f.lm, pose.verdict.analysis);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [pose, skeleton]);

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
      <canvas ref={canvas} width={720} height={1280} aria-hidden="true" />
      {skeleton && pose && (
        <span
          className="absolute left-3 bottom-3 glass rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 pointer-events-none"
          role="status"
        >
          <ScanLine size={13} /> {pose.verdict.label}
        </span>
      )}
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
  const [skeleton, setSkeleton] = useState(true);
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
          <ClipPlayer clip={clip} move={tutorial.move} slow={slow} skeleton={skeleton} />
          <div className="absolute top-3 left-3 right-3 flex justify-between gap-2 pointer-events-none">
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                showingGood ? "bg-pass text-white" : "bg-fail text-white"
              }`}
            >
              {showingGood ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />}
              {showingGood ? "Good form" : "Common mistake"}
            </span>
            <div className="flex gap-2 pointer-events-auto">
              <button
                type="button"
                className={`glass rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 ${skeleton ? "!bg-primary !text-primary-foreground" : ""}`}
                aria-pressed={skeleton}
                onClick={() => setSkeleton((s) => !s)}
                title="Show the skeleton analysis"
              >
                <ScanLine size={13} /> Skeleton
              </button>
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
