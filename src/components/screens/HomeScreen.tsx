import { ArrowUpRight, Flame, Lightbulb, Sparkles, Upload } from "lucide-react";
import type { Move } from "@/engine/types";
import { checkStats, streakDays, summary, type Session } from "@/lib/storage";
import { SessionList } from "@/components/SessionList";
import { LogoMark } from "@/components/LogoMark";

function StanceIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="24" cy="8" r="4" />
      <path d="M24 13v14M15 18l9-3 9 3M14 18l-3 7M33 18l4-6M24 27l-7 6-2 9M24 27l7 6 2 9" />
    </svg>
  );
}
function ClearIcon() {
  return (
    <svg
      viewBox="0 0 48 48"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="21" cy="11" r="4" />
      <path d="M21 16v13M21 19l9-6 3-8M21 19l-8-3-3-6M21 29l-5 7-1 7M21 29l6 7 4 6" />
      <ellipse cx="35" cy="4.5" rx="3" ry="4" transform="rotate(25 35 4.5)" />
    </svg>
  );
}

export function HomeScreen({
  name,
  sessions,
  onTrain,
  onUpload,
  onExample,
  onOpen,
  onSeeAll,
}: {
  name: string;
  sessions: Session[];
  onTrain: (move: Move) => void;
  onUpload: () => void;
  onExample: () => void;
  onOpen: (session: Session) => void;
  onSeeAll: () => void;
}) {
  const stats = summary(sessions);
  const streak = streakDays(sessions);
  const focus = checkStats(sessions.slice(0, 20)).find((c) => c.fail > 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="screen-pad fade-in">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="display font-bold text-lg tracking-wide">LIFT OFF</span>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-sm font-semibold"
          title="Day streak"
        >
          <Flame size={15} className={streak ? "text-fail" : "text-muted-foreground"} />
          <span className="display">{streak}</span>
          <span className="sr-only">day streak</span>
        </div>
      </header>

      <section className="hero-card p-5 mt-6">
        <p className="text-stage-muted text-sm">
          {greeting}
          {name ? `, ${name}` : ""}
        </p>
        <h1 className="display text-[22px] font-semibold leading-snug mt-1.5 relative z-[1] max-w-72">
          A little adjustment. A better game.
        </h1>
        <div className="mt-5 flex gap-6 relative z-[1]">
          <div>
            <p className="stat-label text-stage-muted">Sessions</p>
            <p className="stat-value text-2xl mt-0.5">{stats.count}</p>
          </div>
          <div>
            <p className="stat-label text-stage-muted">Avg score</p>
            <p className="stat-value text-2xl mt-0.5">{stats.average ?? "–"}</p>
          </div>
          <div>
            <p className="stat-label text-stage-muted">Best</p>
            <p className="stat-value text-2xl mt-0.5">{stats.best ?? "–"}</p>
          </div>
        </div>
      </section>

      <h2 className="eyebrow mt-7 mb-3">Start practising</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          className="action-card bg-primary text-primary-foreground"
          onClick={() => onTrain("stance")}
        >
          <div className="flex justify-between items-start w-full">
            <StanceIcon />
            <ArrowUpRight size={20} />
          </div>
          <div>
            <p className="font-bold">Ready stance</p>
            <p className="text-xs opacity-75 mt-0.5">Live posture coach</p>
          </div>
        </button>
        <button
          type="button"
          className="action-card bg-lime text-foreground"
          onClick={() => onTrain("clear")}
        >
          <div className="flex justify-between items-start w-full">
            <ClearIcon />
            <ArrowUpRight size={20} />
          </div>
          <div>
            <p className="font-bold">Overhead clear</p>
            <p className="text-xs opacity-70 mt-0.5">Swing detection</p>
          </div>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <button
          type="button"
          className="tile p-4 flex items-center gap-3 text-left active:scale-[.98] transition"
          onClick={onUpload}
        >
          <span className="size-10 rounded-full bg-accent text-accent-foreground grid place-items-center shrink-0">
            <Upload size={18} />
          </span>
          <span className="text-sm font-semibold leading-tight">Analyse a video</span>
        </button>
        <button
          type="button"
          className="tile p-4 flex items-center gap-3 text-left active:scale-[.98] transition"
          onClick={onExample}
        >
          <span className="size-10 rounded-full bg-accent text-accent-foreground grid place-items-center shrink-0">
            <Sparkles size={18} />
          </span>
          <span className="text-sm font-semibold leading-tight">Example report</span>
        </button>
      </div>

      <section className="tip-card rounded-[22px] border p-4 mt-6">
        <p className="text-fail flex items-center gap-2 text-[11px] font-bold tracking-wide">
          <Lightbulb size={15} /> {focus ? "YOUR FOCUS" : "BEFORE YOU START"}
        </p>
        <p className="font-semibold mt-2 leading-snug">
          {focus
            ? focus.tip
            : "Prop your phone up 2–3 m away so your whole body is in frame, head to feet."}
        </p>
        {focus && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {focus.name}: on target {focus.rate}% of the time recently
          </p>
        )}
      </section>

      {sessions.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-7 mb-3">
            <h2 className="eyebrow">Recent sessions</h2>
            <button type="button" className="text-xs font-semibold text-violet" onClick={onSeeAll}>
              See all
            </button>
          </div>
          <SessionList sessions={sessions.slice(0, 3)} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}
