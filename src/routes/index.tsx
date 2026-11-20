import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Activity, Check, CircleHelp, Camera, ScanLine } from "lucide-react";
import { Controls } from "@/components/Controls";
import { Stage, type StageHandle } from "@/components/Stage";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { SwingVerdict } from "@/components/SwingVerdict";
import { Report } from "@/components/Report";
import { ErrorAlert } from "@/components/ErrorAlert";
import { SetupGuide } from "@/components/SetupGuide";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
import { useCamera } from "@/hooks/useCamera";
import { useRecorder } from "@/hooks/useRecorder";
import { mockStanceAnalysis, mockClearAnalysis, mockReport } from "@/mock/mockData";
import type { Analysis, Mode, Move, Handedness, ReportData } from "@/engine/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Badminton Form Coach — Your practice partner" },
      {
        name: "description",
        content:
          "Practice your badminton ready stance and overhead clear with posture feedback, coaching tips, and swing reports. UI prototype with sample analysis.",
      },
      { property: "og:title", content: "Badminton Form Coach — Your practice partner" },
      {
        property: "og:description",
        content:
          "Better form, one adjustment at a time. A badminton coaching prototype with posture checks and sample swing reports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [mode, setMode] = useState<Mode>("live");
  const [move, setMove] = useState<Move>("stance");
  const [handedness, setHandedness] = useState<Handedness>("right");
  const [showSetup, setShowSetup] = useState(true);
  const [analysis, setAnalysis] = useState<Analysis | null>(mockStanceAnalysis);
  const [report, setReport] = useState<ReportData | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const { status } = usePoseLandmarker();
  const camera = useCamera();
  const { recording, countdown, record } = useRecorder();
  const stageRef = useRef<StageHandle>(null);
  const analysisTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (analysisTimer.current) clearTimeout(analysisTimer.current);
    },
    [],
  );

  const changeMove = (next: Move) => {
    setMove(next);
    setAnalysis(next === "stance" ? mockStanceAnalysis : mockClearAnalysis);
    setReport(null);
    setRecorded(false);
    setError(null);
  };
  const startAnalysis = (file?: File) => {
    if (file && !file.type.startsWith("video/")) {
      setError("This file isn’t a readable video. Choose an MP4, MOV or WebM video.");
      return;
    }
    setError(null);
    setReport(null);
    setAnalysing(true);
    setShowSetup(false);
    setFileName(file ? file.name : "Sample practice video");
    if (analysisTimer.current) clearTimeout(analysisTimer.current);
    analysisTimer.current = setTimeout(() => {
      setReport(
        move === "clear"
          ? mockReport
          : { move: "stance", score: 67, swings: [], stance: mockStanceAnalysis },
      );
      setAnalysing(false);
    }, 2000);
  };
  const onRecord = async () => {
    setRecorded(false);
    await record();
    setRecorded(true);
  };
  const disabled = status !== "ready" || analysing || recording;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="app-shell min-h-24 flex items-center justify-between gap-3 py-5">
          <div className="flex items-center gap-3.5">
            <div className="brand-mark">
              <svg width="27" height="27" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M12 20L5 6L12 8L16 3L20 8L27 6L20 20M12 20H20L19 25Q16 29 13 25Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path d="M12 8L14 20M20 8L18 20M16 3V20" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </div>
            <div>
              <h1 className="header-title font-display text-xl font-bold">Badminton Form Coach</h1>
              <p className="brand-tagline text-sm text-muted-foreground mt-1">
                Swing in front of your camera. Get the tips a coach would give you.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Open setup help"
            title="Setup help"
            onClick={() => setHelp(!help)}
          >
            <CircleHelp size={20} />
          </Button>
        </div>
      </header>
      <main className="app-shell pt-9 pb-12">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-7">
          <div>
            <div className="eyebrow text-primary mb-2 flex items-center gap-1.5">
              <Activity size={13} /> YOUR PRACTICE PARTNER
            </div>
            <h2 className="font-display text-[28px] font-semibold">
              A little adjustment. A better game.
            </h2>
          </div>
          <div role="status" aria-live="polite">
            {status === "loading" ? (
              <div className="w-44">
                <p className="text-xs text-muted-foreground mb-2">Loading pose model…</p>
                <Progress value={60} />
              </div>
            ) : status === "ready" ? (
              <Badge variant="ready" className="py-1.5 px-3">
                <Check size={13} />
                Model ready
              </Badge>
            ) : (
              <Badge variant="destructive">Model unavailable</Badge>
            )}
          </div>
        </div>
        {help && (
          <div className="setup-help mb-6">
            <SetupGuide
              visible
              warning="Step back, your whole body must be visible."
              onDismiss={() => setHelp(false)}
            />
          </div>
        )}
        <Controls
          mode={mode}
          onModeChange={(next) => {
            setMode(next);
            setError(null);
            setRecorded(false);
            camera.stop();
          }}
          move={move}
          onMoveChange={changeMove}
          handedness={handedness}
          onHandednessChange={setHandedness}
          cameraOn={camera.cameraOn}
          onStartCamera={() => {
            if (camera.cameraOn) camera.stop();
            else {
              void camera.start();
              setShowSetup(false);
            }
          }}
          onRecord={() => void onRecord()}
          onUpload={startAnalysis}
          onSample={() => startAnalysis()}
          disabled={disabled}
        />
        {(error || camera.error) && (
          <ErrorAlert
            message={error || camera.error || "Something went wrong."}
            onRetry={() => setError(null)}
          />
        )}
        <div className="workspace mt-7">
          <section aria-label="Practice stage">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Camera size={16} className="text-muted-foreground" />
                {mode === "live" ? "Your practice space" : "Video preview"}
              </h3>
              <span className="text-xs text-muted-foreground">
                {move === "stance" ? "Ready stance" : "Overhead clear"}
              </span>
            </div>
            <div className="relative">
              <Stage
                ref={stageRef}
                mirrored={mode === "live"}
                showSetup={showSetup}
                onDismissSetup={() => setShowSetup(false)}
              />
              {recording && (
                <div
                  role="status"
                  aria-live="polite"
                  className="absolute inset-0 pointer-events-none flex items-center justify-center"
                >
                  <Badge variant="preview" className="text-3xl px-5 py-3">
                    {countdown ?? "Recording…"}
                  </Badge>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <div className="flex gap-4 text-xs text-muted-foreground">
                {[
                  ["bg-pass", "Good posture"],
                  ["bg-fail", "Adjust posture"],
                  ["bg-neutral", "Not measured"],
                ].map(([color, label]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${color}`} />
                    {label}
                  </span>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowSetup(!showSetup)}
              >
                <ScanLine /> Setup guide
              </Button>
            </div>
            {recorded && (
              <Alert className="mt-4">
                <Check size={16} />
                <AlertDescription>
                  Practice capture complete. Your sample feedback is ready.
                </AlertDescription>
              </Alert>
            )}
            {fileName && mode === "upload" && (
              <p className="text-xs text-muted-foreground mt-4 break-all">{fileName}</p>
            )}
            <div className="mt-7 border-t border-border pt-6 grid grid-cols-[36px_1fr] gap-3">
              <span className="text-primary flex justify-center pt-1">
                <Activity size={21} />
              </span>
              <div>
                <h3 className="font-semibold text-sm">Small changes, stronger foundations.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1.5 max-w-lg">
                  Find your balance. Keep your racket ready. Build the habits that make every shot
                  feel more natural.
                </p>
              </div>
            </div>
          </section>
          <aside aria-label="Coaching feedback">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
              <h3 className="font-display font-semibold text-base">
                {mode === "upload" ? "Practice report" : "Your coaching feedback"}
              </h3>
              <Badge variant="outline" className="text-muted-foreground font-normal">
                Sample data
              </Badge>
            </div>
            {mode === "live" ? (
              <>
                <FeedbackPanel analysis={analysis} />
                {move === "clear" && <SwingVerdict analysis={analysis} />}
              </>
            ) : (
              <Report
                report={report}
                analysing={analysing}
                onReset={() => {
                  setReport(null);
                  setFileName(null);
                  setError(null);
                  setShowSetup(true);
                }}
              />
            )}
          </aside>
        </div>
      </main>
      <footer className="app-shell">
        <div className="border-t border-border py-5 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <span>Badminton Form Coach</span>
          <span>Practice with purpose. Play with confidence.</span>
        </div>
      </footer>
    </div>
  );
}
