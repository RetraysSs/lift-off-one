import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { TrainScreen, type TrainIntent } from "@/components/screens/TrainScreen";
import { ProgressScreen } from "@/components/screens/ProgressScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { ReportSheet, type OpenReport } from "@/components/ReportSheet";
import { useSessions, useSettings } from "@/hooks/useAppData";
import { newSession, type Session, type SessionSource } from "@/lib/storage";
import { mockReport, mockStanceAnalysis } from "@/mock/mockData";
import type { Move, ReportData } from "@/engine/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Lift Off — Badminton form coach" },
      {
        name: "description",
        content:
          "Lift Off coaches your badminton ready stance and overhead clear with live pose tracking, swing detection and progress reports. Runs on your phone; video never leaves your device.",
      },
      { property: "og:title", content: "Lift Off — Badminton form coach" },
      {
        property: "og:description",
        content:
          "A little adjustment. A better game. Live posture and swing coaching on your phone.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const EXAMPLES: Record<Move, ReportData> = {
  clear: mockReport,
  stance: {
    move: "stance",
    score: mockStanceAnalysis.score,
    swings: [],
    stance: mockStanceAnalysis,
  },
};

function Index() {
  const [tab, setTab] = useState<Tab>("home");
  const [intent, setIntent] = useState<TrainIntent>({ move: "stance", mode: "live", key: 0 });
  const [openReport, setOpenReport] = useState<OpenReport | null>(null);
  const { settings, update, loaded } = useSettings();
  const { sessions, add, remove, clear } = useSessions();
  const screenRef = useRef<HTMLDivElement>(null);

  // Apply the saved default move once settings have loaded.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (!loaded || appliedDefault.current) return;
    appliedDefault.current = true;
    setIntent((i) => ({ ...i, move: settings.defaultMove, key: i.key + 1 }));
  }, [loaded, settings.defaultMove]);

  const go = useCallback((next: Tab) => {
    setTab(next);
    screenRef.current?.scrollTo({ top: 0 });
  }, []);

  const train = (move: Move, mode: TrainIntent["mode"] = "live") => {
    setIntent((i) => ({ move, mode, key: i.key + 1 }));
    setOpenReport(null);
    go("train");
  };

  const onComplete = useCallback(
    (report: ReportData, source: SessionSource, durationMs: number) => {
      const session = newSession(report, source, durationMs);
      add(session);
      setOpenReport({ report, date: session.date, source });
    },
    [add],
  );

  const openSession = (s: Session) =>
    setOpenReport({ report: s.report, date: s.date, source: s.source });
  const showExample = (move: Move) =>
    setOpenReport({ report: EXAMPLES[move], date: Date.now(), source: "example" });

  return (
    <div className="app-surround">
      <div className="app">
        {tab === "train" ? (
          <TrainScreen
            settings={settings}
            onSettings={update}
            intent={intent}
            onComplete={onComplete}
            onExample={showExample}
          />
        ) : (
          <main ref={screenRef} className="screen no-scrollbar">
            {tab === "home" && (
              <HomeScreen
                name={settings.name}
                sessions={sessions}
                onTrain={(move) => train(move)}
                onUpload={() => train(settings.defaultMove, "upload")}
                onExample={() => showExample(settings.defaultMove)}
                onOpen={openSession}
                onSeeAll={() => go("progress")}
              />
            )}
            {tab === "progress" && (
              <ProgressScreen
                sessions={sessions}
                onOpen={openSession}
                onDelete={remove}
                onTrain={() => train(settings.defaultMove)}
              />
            )}
            {tab === "profile" && (
              <ProfileScreen
                settings={settings}
                onChange={update}
                sessionCount={sessions.length}
                onClearHistory={clear}
              />
            )}
          </main>
        )}
        <BottomNav tab={tab} onChange={go} />
        {openReport && (
          <ReportSheet
            open={openReport}
            onClose={() => setOpenReport(null)}
            onPracticeAgain={() => train(openReport.report.move)}
          />
        )}
      </div>
    </div>
  );
}
