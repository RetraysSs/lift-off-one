import type { Move } from "@/engine/types";
import type { SessionSource } from "@/lib/storage";

export const MOVE_LABEL: Record<Move, string> = {
  stance: "Ready stance",
  clear: "Overhead clear",
};

export const SOURCE_LABEL: Record<SessionSource, string> = {
  live: "Live session",
  record: "Recorded clip",
  upload: "Uploaded video",
};

/** mm:ss, clamped at zero. */
export function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatDate(t: number, now = Date.now()) {
  const d = new Date(t);
  const today = new Date(now);
  const yesterday = new Date(now - 864e5);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + `, ${time}`;
}

export function formatDuration(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return `${Math.round(ms / 1000)} s`;
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

/** Title for a report or saved session: the move, or "Video analysis" for a full one. */
export function reportTitle(report: { move: Move; scope?: "move" | "full" }) {
  return report.scope === "full" ? "Video analysis" : MOVE_LABEL[report.move];
}
