import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomNav, type Tab } from "@/components/BottomNav";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { TrainScreen, type TrainIntent } from "@/components/screens/TrainScreen";
import { ProgressScreen } from "@/components/screens/ProgressScreen";
import { ProfileScreen } from "@/components/screens/ProfileScreen";
import { ReportSheet, type OpenReport } from "@/components/ReportSheet";
import { PracticeChooser } from "@/components/PracticeChooser";
import { GuideTour, type TourStep } from "@/components/GuideTour";
import { TutorialsScreen } from "@/components/screens/TutorialsScreen";
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

const EXAMPLES: Record<Move | "full", ReportData> = {
  clear: mockReport,
  stance: {
    move: "stance",
    score: mockStanceAnalysis.score,
    swings: [],
    stance: mockStanceAnalysis,
  },
  full: {
    move: "clear",
    scope: "full",
    score: Math.round(((mockStanceAnalysis.score ?? 0) + (mockReport.score ?? 0)) / 2),
    swings: mockReport.swings,
    stance: mockStanceAnalysis,
  },
};

type Screen = Tab | "tutorials";

const TOUR: TourStep[] = [
  {
    title: "Welcome to Lift Off",
    body: "Your badminton coach in your pocket. Here is a 30-second tour of where everything is.",
  },
  {
    target: "practice",
    title: "Start here: Practice",
    body: "Live coaching with your camera. Choose ready stance or overhead clear and get feedback as you move.",
  },
  {
    target: "tutorials",
    title: "Learn good form",
    body: "Short clips of good technique next to common mistakes. Watch these before you practise.",
  },
  {
    target: "analyse",
    title: "Analyse a match or video",
    body: "Upload a clip from your phone for a full report with snapshots of every swing.",
  },
  {
    target: "reports",
    title: "Your reports",
    body: "Every session is saved here with your scores, trends and what to work on next.",
  },
  {
    target: "nav",
    title: "Jump around any time",
    body: "Home, Reports, Practice and Profile are always one tap away down here.",
  },
];

function Index() {
  const [screen, setScreen] = useState<Screen>("home");
  const [intent, setIntent] = useState<TrainIntent>({ move: "stance", mode: "live", key: 0 });
  const [openReport, setOpenReport] = useState<OpenReport | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [touring, setTouring] = useState(false);
  // A live camera session fills the screen; the bottom nav steps aside.
  const [immersive, setImmersive] = useState(false);
  const { settings, update, loaded } = useSettings();
  const { sessions, add, remove, clear } = useSessions();
  const screenRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // Apply the saved default move once settings have loaded, and show the screentips
  // tour on a first visit.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (!loaded || appliedDefault.current) return;
    appliedDefault.current = true;
    setIntent((i) => ({ ...i, move: settings.defaultMove, key: i.key + 1 }));
    if (!settings.tourDone) setTouring(true);
  }, [loaded, settings.defaultMove, settings.tourDone]);

  const go = useCallback((next: Screen) => {
    setScreen(next);
    setChoosing(false);
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

  const endTour = useCallback(() => {
    setTouring(false);
    update({ tourDone: true });
  }, [update]);

  const replayTour = () => {
    // Also re-arm the live-session tips for the next time the camera starts.
    update({ trainTourDone: false });
    go("home");
    setTouring(true);
  };

  const openSession = (s: Session) =>
    setOpenReport({ report: s.report, date: s.date, source: s.source });
  const showExample = (move: Move | "full") =>
    setOpenReport({ report: EXAMPLES[move], date: Date.now(), source: "example" });

  return (
    <div className="app-surround">
      <div className="app" ref={appRef}>
        {screen === "train" ? (
          <TrainScreen
            settings={settings}
            onSettings={update}
            intent={intent}
            onComplete={onComplete}
            onExample={showExample}
            onImmersiveChange={setImmersive}
          />
        ) : (
          <main ref={screenRef} className="screen no-scrollbar">
            {screen === "home" && (
              <HomeScreen
                name={settings.name}
                sessions={sessions}
                onPractice={() => setChoosing(true)}
                onTutorials={() => go("tutorials")}
                onAnalyse={() => train(settings.defaultMove, "upload")}
                onReports={() => go("progress")}
                onOpen={openSession}
                onHelp={() => setTouring(true)}
              />
            )}
            {screen === "tutorials" && (
              <TutorialsScreen onBack={() => go("home")} onPractise={(move) => train(move)} />
            )}
            {screen === "progress" && (
              <ProgressScreen
                sessions={sessions}
                onOpen={openSession}
                onDelete={remove}
                onTrain={() => setChoosing(true)}
              />
            )}
            {screen === "profile" && (
              <ProfileScreen
                settings={settings}
                onChange={update}
                sessionCount={sessions.length}
                onClearHistory={clear}
                onReplayTour={replayTour}
              />
            )}
          </main>
        )}
        {!(screen === "train" && immersive) && (
          <BottomNav
            tab={screen === "tutorials" ? "home" : screen}
            onChange={(t) => (t === "train" && screen !== "train" ? setChoosing(true) : go(t))}
          />
        )}
        {choosing && (
          <PracticeChooser onChoose={(move) => train(move)} onClose={() => setChoosing(false)} />
        )}
        {openReport && (
          <ReportSheet
            open={openReport}
            onClose={() => setOpenReport(null)}
            onPracticeAgain={() => train(openReport.report.move)}
          />
        )}
        {touring && screen === "home" && !openReport && (
          <GuideTour steps={TOUR} container={appRef} onDone={endTour} />
        )}
      </div>
    </div>
  );
}
