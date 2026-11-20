import type { Handedness, Move, ReportData } from "@/engine/types";
import type { Facing } from "@/hooks/useCamera";

export type SessionSource = "live" | "record" | "upload";

export interface Session {
  id: string;
  date: number;
  move: Move;
  source: SessionSource;
  score: number | null;
  durationMs: number;
  /** Report without snapshot images, to keep local storage small. */
  report: ReportData;
}

export interface Settings {
  name: string;
  handedness: Handedness;
  defaultMove: Move;
  recordSeconds: number;
  /** Countdown before a clip records, seconds (0 = start straight away). */
  countdownSeconds: number;
  facing: Facing;
  showGuide: boolean;
  /** First-visit screentips tour has been completed or skipped. */
  tourDone: boolean;
  /** Live-session screentips (shown the first time the camera starts) have been seen. */
  trainTourDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  handedness: "right",
  defaultMove: "stance",
  recordSeconds: 5,
  countdownSeconds: 3,
  facing: "user",
  showGuide: true,
  tourDone: false,
  trainTourDone: false,
};

export const SESSIONS_KEY = "liftoff.sessions.v1";
export const SETTINGS_KEY = "liftoff.settings.v1";
export const MAX_SESSIONS = 200;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): the app keeps working in memory.
  }
}

export function stripSnapshots(report: ReportData): ReportData {
  const { stanceSnapshot: _s, ...rest } = report;
  return {
    ...rest,
    swings: report.swings.map(({ prepSnapshot: _p, contactSnapshot: _c, ...swing }) => swing),
  };
}

export const loadSessions = () => {
  const sessions = read<Session[]>(SESSIONS_KEY, []);
  return Array.isArray(sessions) ? sessions : [];
};
export const saveSessions = (sessions: Session[]) =>
  write(SESSIONS_KEY, sessions.slice(0, MAX_SESSIONS));

export const loadSettings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  ...read<Partial<Settings>>(SETTINGS_KEY, {}),
});
export const saveSettings = (settings: Settings) => write(SETTINGS_KEY, settings);

export function newSession(
  report: ReportData,
  source: SessionSource,
  durationMs: number,
  now = Date.now(),
): Session {
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    date: now,
    move: report.move,
    source,
    score: report.score,
    durationMs,
    report: stripSnapshots(report),
  };
}

// ---------- Derived progress stats ----------

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** Consecutive days with at least one session, ending today or yesterday. */
export function streakDays(sessions: Session[], now = Date.now()): number {
  const days = new Set(sessions.map((s) => dayKey(s.date)));
  const day = 24 * 60 * 60 * 1000;
  let cursor = now;
  if (!days.has(dayKey(cursor))) cursor -= day;
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor -= day;
  }
  return streak;
}

export interface CheckStat {
  id: string;
  name: string;
  tip: string;
  pass: number;
  fail: number;
  rate: number;
}

/** Pass rate per check across every analysed moment, weakest first. */
export function checkStats(sessions: Session[]): CheckStat[] {
  const stats = new Map<string, CheckStat>();
  for (const s of sessions) {
    const analyses = [
      ...(s.report.stance ? [s.report.stance] : []),
      ...s.report.swings.flatMap((w) => [w.prep, w.contact]),
    ];
    for (const a of analyses)
      for (const c of a.checks) {
        if (c.status === "skip") continue;
        const stat = stats.get(c.id) ?? {
          id: c.id,
          name: c.name,
          tip: "",
          pass: 0,
          fail: 0,
          rate: 0,
        };
        if (c.status === "pass") stat.pass++;
        else {
          stat.fail++;
          stat.tip = c.tip;
        }
        stats.set(c.id, stat);
      }
  }
  return [...stats.values()]
    .map((s) => ({ ...s, rate: Math.round((s.pass / (s.pass + s.fail)) * 100) }))
    .sort((a, b) => a.rate - b.rate || b.fail - a.fail);
}

export function summary(sessions: Session[]) {
  const scored = sessions.map((s) => s.score).filter((s): s is number => s !== null);
  return {
    count: sessions.length,
    average: scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null,
    best: scored.length ? Math.max(...scored) : null,
    practiceMs: sessions.reduce((a, s) => a + s.durationMs, 0),
  };
}
