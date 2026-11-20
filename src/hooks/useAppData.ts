import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_SETTINGS,
  loadSessions,
  loadSettings,
  saveSessions,
  saveSettings,
  type Session,
  type Settings,
} from "@/lib/storage";

/** Local-only practice history. Loaded after mount so SSR markup stays deterministic. */
export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => setSessions(loadSessions()), []);
  const add = useCallback((session: Session) => {
    setSessions((prev) => {
      const next = [session, ...prev];
      saveSessions(next);
      return next;
    });
  }, []);
  const remove = useCallback((id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    saveSessions([]);
    setSessions([]);
  }, []);
  return { sessions, add, remove, clear };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);
  return { settings, update, loaded };
}
