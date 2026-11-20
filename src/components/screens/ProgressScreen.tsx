import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";
import type { Move } from "@/engine/types";
import { checkStats, streakDays, summary, type Session } from "@/lib/storage";
import { SessionList } from "@/components/SessionList";
import { formatDate, formatDuration } from "@/lib/format";

type Filter = "all" | Move;

function StatTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="tile p-4">
      <p className="stat-label">{label}</p>
      <p className="stat-value text-2xl mt-1.5">
        {value}
        {unit && <span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span>}
      </p>
    </div>
  );
}

interface Point {
  n: number;
  score: number;
  date: number;
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-xl bg-card border border-border shadow-lg px-3 py-2 text-xs">
      <p className="text-muted-foreground">{formatDate(p.date)}</p>
      <p className="font-semibold mt-0.5">Score {p.score}</p>
    </div>
  );
}

export function ProgressScreen({
  sessions,
  onOpen,
  onDelete,
  onTrain,
}: {
  sessions: Session[];
  onOpen: (s: Session) => void;
  onDelete: (id: string) => void;
  onTrain: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(
    () => (filter === "all" ? sessions : sessions.filter((s) => s.move === filter)),
    [sessions, filter],
  );
  const stats = summary(shown);
  const trend: Point[] = useMemo(
    () =>
      shown
        .filter((s) => s.score !== null)
        .slice(0, 30)
        .reverse()
        .map((s, i) => ({ n: i + 1, score: s.score ?? 0, date: s.date })),
    [shown],
  );
  const focus = checkStats(shown);

  return (
    <div className="screen-pad fade-in">
      <h1 className="display text-xl font-semibold">Progress</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Every session is stored on this device only.
      </p>

      <div className="seg mt-5" role="group" aria-label="Filter by move">
        {(
          [
            ["all", "All"],
            ["stance", "Stance"],
            ["clear", "Clear"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {sessions.length === 0 ? (
        <div className="tile p-6 mt-5 text-center">
          <div className="mx-auto size-12 rounded-full bg-accent text-accent-foreground grid place-items-center">
            <Activity size={22} />
          </div>
          <p className="font-semibold mt-3">No sessions yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Finish a live session, record a clip or analyse a video to start tracking.
          </p>
          <button
            type="button"
            onClick={onTrain}
            className="mt-4 h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold"
          >
            Start training
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <StatTile label="Sessions" value={stats.count} />
            <StatTile label="Day streak" value={streakDays(shown)} unit="days" />
            <StatTile label="Avg score" value={stats.average ?? "–"} />
            <StatTile label="Practice" value={formatDuration(stats.practiceMs)} />
          </div>

          <section className="tile p-4 mt-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">Score trend</h2>
              <span className="text-xs text-muted-foreground">last {trend.length} scored</span>
            </div>
            {trend.length < 2 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Two scored sessions are needed to draw a trend.
              </p>
            ) : (
              <div
                className="h-44 mt-3 -ml-3"
                role="img"
                aria-label={`Score trend over ${trend.length} sessions, latest ${trend[trend.length - 1]?.score}`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis
                      dataKey="n"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 50, 100]}
                      width={36}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      content={<TrendTooltip />}
                      cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="var(--violet)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: "var(--violet)", stroke: "var(--card)", strokeWidth: 2 }}
                      activeDot={{
                        r: 6,
                        fill: "var(--violet)",
                        stroke: "var(--card)",
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          {focus.length > 0 && (
            <section className="tile p-4 mt-4">
              <h2 className="text-sm font-semibold">Focus areas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                How often each check is on target
              </p>
              <ul className="mt-3 space-y-3">
                {focus.map((c) => (
                  <li key={c.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="tabular-nums text-muted-foreground">{c.rate}%</span>
                    </div>
                    <div
                      className="h-2 rounded-full bg-muted mt-1.5 overflow-hidden"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(c.rate, 3)}%`,
                          background:
                            c.rate >= 70
                              ? "var(--pass)"
                              : c.rate >= 40
                                ? "var(--primary)"
                                : "var(--fail)",
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <h2 className="eyebrow mt-7 mb-3">History</h2>
          {shown.length ? (
            <SessionList sessions={shown} onOpen={onOpen} onDelete={onDelete} />
          ) : (
            <p className="text-sm text-muted-foreground">No sessions for this move yet.</p>
          )}
        </>
      )}
    </div>
  );
}
