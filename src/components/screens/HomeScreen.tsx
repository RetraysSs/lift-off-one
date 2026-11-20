import {
  ArrowUpRight,
  ChartNoAxesColumn,
  CircleHelp,
  Flame,
  Lightbulb,
  PlayCircle,
  Upload,
} from "lucide-react";
import { checkStats, streakDays, summary, type Session } from "@/lib/storage";
import { TUTORIALS } from "@/lib/tutorials";
import { SessionList } from "@/components/SessionList";
import { LogoMark } from "@/components/LogoMark";
import { ClearIcon, StanceIcon } from "@/components/MoveIcons";

export function HomeScreen({
  name,
  sessions,
  onPractice,
  onTutorials,
  onAnalyse,
  onReports,
  onOpen,
  onHelp,
}: {
  name: string;
  sessions: Session[];
  onPractice: () => void;
  onTutorials: () => void;
  onAnalyse: () => void;
  onReports: () => void;
  onOpen: (session: Session) => void;
  onHelp: () => void;
}) {
  const stats = summary(sessions);
  const streak = streakDays(sessions);
  const focus = checkStats(sessions.slice(0, 20)).find((c) => c.fail > 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const newPlayer = sessions.length === 0;

  return (
    <div className="screen-pad fade-in">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="display font-bold text-lg tracking-wide">LIFT OFF</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full bg-card border border-border px-3 h-9 text-sm font-semibold"
            title="Day streak"
          >
            <Flame size={15} className={streak ? "text-fail" : "text-muted-foreground"} />
            <span className="display">{streak}</span>
            <span className="sr-only">day streak</span>
          </div>
          <button
            type="button"
            onClick={onHelp}
            className="size-9 rounded-full bg-card border border-border grid place-items-center"
            aria-label="Show screentips"
            title="Show screentips"
          >
            <CircleHelp size={17} />
          </button>
        </div>
      </header>

      <div className="mt-6">
        <p className="text-sm text-muted-foreground">
          {greeting}
          {name ? `, ${name}` : ""}
        </p>
        <h1 className="display text-[22px] font-semibold leading-snug mt-1">
          {newPlayer ? "Where would you like to start?" : "Ready for another session?"}
        </h1>
      </div>

      <div className="bento mt-5">
        {/* Practice */}
        <button
          type="button"
          data-tour="practice"
          onClick={onPractice}
          className="bento-tile col-span-2 bg-primary text-primary-foreground min-h-[168px]"
        >
          <div className="flex justify-between items-start w-full">
            {newPlayer ? (
              <span className="rounded-full bg-white/60 px-2.5 py-1 text-[11px] font-bold tracking-wide">
                START HERE
              </span>
            ) : (
              <span className="text-sm font-semibold opacity-80">Live coaching</span>
            )}
            <ArrowUpRight size={22} />
          </div>
          <div className="flex items-end justify-between w-full gap-3">
            <div>
              <p className="display text-2xl font-bold">Practice</p>
              <p className="text-sm opacity-80 mt-1">Stance or clear, with your camera</p>
            </div>
            <div className="flex -space-x-3 shrink-0" aria-hidden="true">
              <span className="size-14 rounded-full bg-white/55 grid place-items-center border-2 border-primary">
                <StanceIcon size={34} />
              </span>
              <span className="size-14 rounded-full bg-lime grid place-items-center border-2 border-primary">
                <ClearIcon size={34} />
              </span>
            </div>
          </div>
        </button>

        {/* Tutorials */}
        <button
          type="button"
          data-tour="tutorials"
          onClick={onTutorials}
          className="bento-tile col-span-2 bg-lime text-foreground !flex-row !items-center"
        >
          <div className="flex-1 min-w-0">
            <span className="size-10 rounded-full bg-white/60 grid place-items-center">
              <PlayCircle size={20} />
            </span>
            <p className="display text-lg font-bold mt-3">Tutorials</p>
            <p className="text-sm opacity-75 mt-0.5 leading-snug">Good form vs common mistakes</p>
          </div>
          <div className="flex -space-x-5 shrink-0" aria-hidden="true">
            {TUTORIALS.map((t, i) => (
              <img
                key={t.id}
                src={t.good.poster}
                alt=""
                loading="lazy"
                className="w-[54px] h-[96px] object-cover rounded-xl border-2 border-lime shadow-md"
                style={{ transform: `rotate(${(i - 1) * 6}deg)` }}
              />
            ))}
          </div>
        </button>

        {/* Analyse */}
        <button
          type="button"
          data-tour="analyse"
          onClick={onAnalyse}
          className="bento-tile bg-stage text-stage-foreground min-h-[150px]"
        >
          <span className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Upload size={18} />
          </span>
          <div>
            <p className="font-bold leading-tight">Analyse match or video</p>
            <p className="text-xs text-stage-muted mt-1 leading-snug">
              Stance and clears in one report
            </p>
          </div>
        </button>

        {/* Reports */}
        <button
          type="button"
          data-tour="reports"
          onClick={onReports}
          className="bento-tile bg-card border border-border min-h-[150px]"
        >
          <div className="flex justify-between items-start w-full">
            <span className="size-10 rounded-full bg-accent text-accent-foreground grid place-items-center">
              <ChartNoAxesColumn size={18} />
            </span>
            {stats.average !== null && (
              <span className="display text-xl font-bold" title="Average score">
                {stats.average}
              </span>
            )}
          </div>
          <div>
            <p className="font-bold leading-tight">Reports</p>
            <p className="text-xs text-muted-foreground mt-1 leading-snug">
              {stats.count
                ? `${stats.count} session${stats.count === 1 ? "" : "s"} · ${streak} day streak`
                : "Your sessions appear here"}
            </p>
          </div>
        </button>
      </div>

      {focus && (
        <section className="tip-card rounded-[22px] border p-4 mt-5">
          <p className="text-fail flex items-center gap-2 text-[11px] font-bold tracking-wide">
            <Lightbulb size={15} /> YOUR FOCUS
          </p>
          <p className="font-semibold mt-2 leading-snug">{focus.tip}</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            {focus.name}: on target {focus.rate}% of the time recently
          </p>
        </section>
      )}

      {sessions.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-6 mb-3">
            <h2 className="eyebrow">Recent sessions</h2>
            <button type="button" className="text-xs font-semibold text-violet" onClick={onReports}>
              See all
            </button>
          </div>
          <SessionList sessions={sessions.slice(0, 3)} onOpen={onOpen} />
        </>
      )}
    </div>
  );
}
