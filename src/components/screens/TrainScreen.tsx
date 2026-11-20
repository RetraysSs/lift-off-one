import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Pause,
  Play,
  RefreshCw,
  Square,
  Upload,
  Video,
  LoaderCircle,
  ScanLine,
  Sparkles,
} from "lucide-react";
import type { Frame, Mode, Move, ReportData } from "@/engine/types";
import { Stage, syncCanvas, type StageHandle } from "@/components/Stage";
import { StatPill } from "@/components/StatPill";
import { SetupGuide } from "@/components/SetupGuide";
import { ErrorAlert } from "@/components/ErrorAlert";
import { FeedbackPanel } from "@/components/FeedbackPanel";
import { SwingVerdict } from "@/components/SwingVerdict";
import { Progress } from "@/components/ui/progress";
import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
import { useCamera } from "@/hooks/useCamera";
import { useRecorder } from "@/hooks/useRecorder";
import { useLiveCoach } from "@/hooks/useLiveCoach";
import { analyseVideo, MAX_ANALYSIS_SECONDS, UnreadableVideoError } from "@/engine/video";
import { NoPlayerError } from "@/engine/report";
import { analyseFrame, combineAnalyses } from "@/engine/analysis";
import { buildLiveReport } from "@/engine/live";
import { drawPose } from "@/engine/draw";

import type { SessionSource, Settings } from "@/lib/storage";
import { clock, MOVE_LABEL } from "@/lib/format";

export interface TrainIntent {
  move: Move;
  mode: Mode;
  key: number;
}

export interface TrainScreenProps {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  intent: TrainIntent;
  onComplete: (report: ReportData, source: SessionSource, durationMs: number) => void;
  onExample: (move: Move) => void;
}

const isVideoFile = (file: File) =>
  file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(file.name);

export function TrainScreen({
  settings,
  onSettings,
  intent,
  onComplete,
  onExample,
}: TrainScreenProps) {
  const [mode, setMode] = useState<Mode>(intent.mode);
  const [move, setMove] = useState<Move>(intent.move);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showGuide, setShowGuide] = useState(settings.showGuide);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [playback, setPlayback] = useState<{ frames: Frame[]; move: Move } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [dragging, setDragging] = useState(false);

  const stageRef = useRef<StageHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const model = usePoseLandmarker(true);
  const camera = useCamera();
  const recorder = useRecorder();
  const handedness = settings.handedness;
  const mirrored = mode === "live" && camera.facing === "user";
  const coach = useLiveCoach({
    stageRef,
    detector: model.detector,
    active: mode === "live" && camera.cameraOn && !paused && !analysing,
    move,
    handedness,
    mirrored,
  });

  // Requests from Home ("practise the clear", "analyse a video") override local state.
  useEffect(() => {
    setMove(intent.move);
    setMode(intent.mode);
  }, [intent.key, intent.move, intent.mode]);

  // Session clock.
  useEffect(() => {
    if (!camera.cameraOn) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [camera.cameraOn]);

  const clearFile = useCallback(() => {
    abortRef.current?.abort();
    const video = stageRef.current?.video;
    if (video && video.src) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    setFileUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPlayback(null);
  }, []);

  // Leaving a mode releases what it was using.
  useEffect(() => {
    if (mode === "upload") {
      camera.stop();
      setStartedAt(null);
      coach.reset();
    } else clearFile();
    setError(null);
    setNotice(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  // Uploaded clip plays in the stage with its analysed skeleton drawn over it.
  useEffect(() => {
    const video = stageRef.current?.video;
    if (!video || mode !== "upload" || !fileUrl) return;
    video.srcObject = null;
    video.src = fileUrl;
    video.load();
  }, [fileUrl, mode]);

  useEffect(() => {
    const video = stageRef.current?.video;
    const canvas = stageRef.current?.canvas;
    if (!playback || !video || !canvas || mode !== "upload") return;
    let raf = 0;
    const frames = playback.frames;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const aspect = syncCanvas(video, canvas);
      const t = video.currentTime * 1000;
      let lo = 0;
      let hi = frames.length - 1;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if ((frames[m]?.t ?? 0) < t) lo = m + 1;
        else hi = m;
      }
      const f = frames[lo];
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (!f || Math.abs(f.t - t) > 250) return ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawPose(ctx, f.lm, analyseFrame(playback.move, f.lm, handedness, aspect));
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playback, mode, handedness]);

  const runAnalysis = useCallback(
    async (blob: Blob, source: SessionSource, durationMs: number | null) => {
      if (!model.detector) {
        setError("The pose model is still loading. Try again in a moment.");
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setAnalysing(true);
      setProgress(0);
      setError(null);
      try {
        const result = await analyseVideo(blob, model.detector, {
          move,
          handedness,
          onProgress: setProgress,
          signal: controller.signal,
        });
        if (source === "upload") setPlayback({ frames: result.frames, move });
        const lastT = result.frames[result.frames.length - 1]?.t ?? 0;
        onComplete(result.report, source, durationMs ?? lastT);
      } catch (err) {
        if (controller.signal.aborted) return;
        const expected = err instanceof NoPlayerError || err instanceof UnreadableVideoError;
        if (!expected) console.error(err);
        setError(
          err instanceof Error && err.message
            ? err.message
            : "This video couldn’t be analysed. Try another clip.",
        );
      } finally {
        if (abortRef.current === controller) {
          setAnalysing(false);
          abortRef.current = null;
        }
      }
    },
    [model.detector, move, handedness, onComplete],
  );

  const handleFile = (file: File) => {
    if (!isVideoFile(file)) {
      setError("This file isn’t a readable video. Choose an MP4, MOV or WebM video.");
      return;
    }
    clearFile();
    setFileUrl(URL.createObjectURL(file));
    void runAnalysis(file, "upload", null);
  };

  const startCamera = async (facing = settings.facing) => {
    setNotice(null);
    const ok = await camera.start(stageRef.current?.video ?? null, facing);
    if (ok) {
      setPaused(false);
      setStartedAt((s) => s ?? Date.now());
      setNow(Date.now());
    }
  };

  const flipCamera = () => {
    const next = camera.facing === "user" ? "environment" : "user";
    onSettings({ facing: next });
    void startCamera(next);
  };

  const elapsedMs = startedAt ? now - startedAt : 0;

  const endSession = () => {
    recorder.cancel();
    const { samples, swings } = coach.collect();
    const report = buildLiveReport(move, samples, swings);
    camera.stop();
    setStartedAt(null);
    setPaused(false);
    coach.reset();
    if (report) onComplete(report, "live", elapsedMs);
    else setNotice("Nothing was measured yet. Step back so your whole body is in frame.");
  };

  const record = async () => {
    const blob = await recorder.record(camera.stream(), settings.recordSeconds * 1000);
    if (blob) await runAnalysis(blob, "record", settings.recordSeconds * 1000);
  };

  const changeMove = (next: Move) => {
    if (next === move) return;
    setMove(next);
    setPlayback(null);
  };

  const live = mode === "live";
  const busy = analysing || recorder.recording;
  const lastSwing = coach.swings[coach.swings.length - 1];
  const lastVerdict = lastSwing ? combineAnalyses(lastSwing.prep, lastSwing.contact) : null;
  const liveScore =
    move === "clear"
      ? (lastSwing?.score ?? coach.analysis?.score ?? null)
      : (coach.analysis?.score ?? null);
  const measured = coach.analysis?.checks.filter((c) => c.status !== "skip") ?? [];
  const passing = measured.filter((c) => c.status === "pass").length;

  const shownError =
    error ?? camera.error ?? recorder.error ?? (model.status === "error" ? model.error : null);
  const retry =
    camera.error && !error
      ? () => void startCamera()
      : model.status === "error" && !error
        ? model.retry
        : undefined;

  const bigTimer = recorder.recording
    ? recorder.countdown !== null
      ? `00:0${recorder.countdown}`
      : clock(recorder.remainingMs ?? 0)
    : !live
      ? analysing
        ? `${Math.round(progress * 100)}%`
        : "--:--"
      : move === "stance"
        ? clock(coach.inFormMs)
        : lastSwing?.score != null
          ? String(lastSwing.score).padStart(3, "0")
          : "---";
  const bigLabel = recorder.recording
    ? recorder.countdown !== null
      ? "Get ready"
      : "Recording"
    : !live
      ? analysing
        ? "Analysing"
        : "Video"
      : move === "stance"
        ? "In form"
        : "Last swing";

  return (
    <div className="train">
      <Stage ref={stageRef} mirrored={mirrored} controls={!live && !!fileUrl && !analysing}>
        {/* Top chrome */}
        <div className="absolute inset-x-0 top-0 p-4 pt-[calc(16px+env(safe-area-inset-top,0px))] flex justify-between gap-3 pointer-events-none">
          <div className="pointer-events-auto min-w-0">
            <h1 className="stage-title text-[22px] font-semibold leading-tight">
              {MOVE_LABEL[move]}
            </h1>
            <div className="flex flex-wrap gap-2 mt-3">
              {(["stance", "clear"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="chip glass"
                  aria-pressed={move === m}
                  disabled={busy}
                  onClick={() => changeMove(m)}
                >
                  {m === "stance" ? "Stance" : "Clear"}
                </button>
              ))}
              <button
                type="button"
                className="chip glass"
                disabled={busy}
                onClick={() => setMode(live ? "upload" : "live")}
                aria-label={live ? "Switch to video upload" : "Switch to live camera"}
              >
                {live ? <Upload size={14} /> : <Camera size={14} />}
                {live ? "Video" : "Live"}
              </button>
            </div>
          </div>
          {live && camera.cameraOn && (
            <button
              type="button"
              className="round-btn pointer-events-auto shrink-0"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Resume coaching" : "Pause coaching"}
              disabled={busy}
            >
              {paused ? (
                <Play size={18} fill="currentColor" />
              ) : (
                <Pause size={18} fill="currentColor" />
              )}
            </button>
          )}
        </div>

        {/* Score pill */}
        {live && camera.cameraOn && (
          <div className="absolute right-4 top-[30%] pointer-events-none">
            <StatPill
              score={paused ? null : liveScore}
              label={move === "clear" && lastSwing ? "Swing" : "Form"}
            />
          </div>
        )}

        {/* Centre states */}
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4 pointer-events-none">
          {live && !camera.cameraOn && !analysing && (
            <div className="pointer-events-auto flex flex-col items-center gap-4 text-center w-full">
              <button
                type="button"
                className="h-14 px-7 rounded-full bg-primary text-primary-foreground font-semibold flex items-center gap-2 shadow-lg disabled:opacity-60"
                onClick={() => void startCamera()}
                disabled={camera.starting}
              >
                {camera.starting ? (
                  <LoaderCircle className="animate-spin" size={19} />
                ) : (
                  <Camera size={19} />
                )}
                Start camera
              </button>
              <p className="text-stage-muted text-sm max-w-64">
                Live coaching runs on your device. Nothing is uploaded.
              </p>
            </div>
          )}
          {recorder.countdown !== null && (
            <div className="countdown" key={recorder.countdown}>
              {recorder.countdown}
            </div>
          )}
          {paused && camera.cameraOn && (
            <div className="glass rounded-full px-4 py-2 text-sm font-semibold">
              Coaching paused
            </div>
          )}
          {analysing && (
            <div className="glass rounded-3xl p-5 w-full max-w-72 text-center" role="status">
              <ScanLine className="mx-auto mb-3 text-primary" size={26} />
              <p className="display font-semibold">Analysing</p>
              <Progress value={Math.round(progress * 100)} className="mt-3 bg-white/15" />
              <p className="text-xs text-stage-muted mt-2">Finding your pose in every frame…</p>
            </div>
          )}
          {!live && !fileUrl && !analysing && (
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose or drop a video to analyse"
              className={`dropzone pointer-events-auto w-full max-w-80 p-6 text-center text-stage-foreground ${dragging ? "dragging" : ""}`}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <div className="mx-auto size-12 rounded-full bg-primary text-primary-foreground grid place-items-center mb-3">
                <Video size={22} />
              </div>
              <p className="font-semibold">Analyse a video</p>
              <p className="text-sm text-stage-muted mt-1">
                Film yourself {move === "clear" ? "side-on" : "facing the camera"}, whole body in
                frame. MP4, MOV or WebM.
              </p>
            </div>
          )}
        </div>

        {/* Bottom-of-stage messages */}
        <div className="absolute inset-x-4 bottom-12 flex flex-col gap-3">
          {recorder.recording && recorder.countdown === null && (
            <div className="self-center glass rounded-full px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2">
              <span className="rec-dot" /> REC
            </div>
          )}
          {live && camera.cameraOn && !paused && model.status === "ready" && (
            <SetupGuide
              visible={showGuide || (!coach.bodyVisible && elapsedMs > 2000)}
              move={move}
              {...(!coach.bodyVisible && elapsedMs > 2000
                ? { warning: "Step back, your whole body must be visible." }
                : {})}
              onDismiss={() => setShowGuide(false)}
            />
          )}
          {live && camera.cameraOn && model.status === "loading" && (
            <div className="glass rounded-2xl p-3 text-sm flex items-center gap-2" role="status">
              <LoaderCircle className="animate-spin" size={16} /> Loading the pose model…
            </div>
          )}
          {notice && <ErrorAlert message={notice} onDismiss={() => setNotice(null)} />}
          {shownError && (
            <ErrorAlert
              message={shownError}
              {...(retry ? { onRetry: retry } : {})}
              onDismiss={() => {
                setError(null);
                camera.clearError();
              }}
            />
          )}
        </div>
      </Stage>

      {/* Bottom sheet */}
      <section className="sheet" aria-label="Session">
        <button
          type="button"
          className="sheet-handle"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="sheet-details"
          aria-label={expanded ? "Hide coaching details" : "Show coaching details"}
        >
          <span />
        </button>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <p className="stat-label">{live ? "Elapsed" : "Source"}</p>
            <p className="stat-value text-lg mt-1">{live ? clock(elapsedMs) : "Video"}</p>
          </div>
          <div className="text-center">
            <p className="stat-label">{bigLabel}</p>
            <p className="big-timer mt-1" aria-live="off">
              {bigTimer}
            </p>
          </div>
          <div className="text-right">
            <p className="stat-label">{!live ? "Move" : move === "clear" ? "Swings" : "Checks"}</p>
            <p className="stat-value text-lg mt-1">
              {!live
                ? move === "clear"
                  ? "Clear"
                  : "Stance"
                : move === "clear"
                  ? coach.swings.length
                  : `${passing}/${measured.length || 4}`}
            </p>
          </div>
        </div>

        {live ? (
          <div className="flex items-center justify-between mt-4">
            <button
              type="button"
              className="round-btn"
              onClick={flipCamera}
              disabled={!camera.cameraOn || busy}
              aria-label="Switch camera"
            >
              <RefreshCw size={18} />
            </button>
            <button
              type="button"
              className="record-btn"
              data-recording={recorder.recording}
              onClick={() => (recorder.recording ? recorder.cancel() : void record())}
              disabled={!camera.cameraOn || analysing || model.status !== "ready"}
              aria-label={
                recorder.recording
                  ? "Cancel recording"
                  : `Record ${settings.recordSeconds} seconds and analyse`
              }
            >
              <span className="dot" />
            </button>
            <button
              type="button"
              className="round-btn"
              onClick={endSession}
              disabled={!camera.cameraOn || busy}
              aria-label="End session and see report"
            >
              <Square size={16} fill="currentColor" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-4">
            <button
              type="button"
              className="flex-1 h-12 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={() => inputRef.current?.click()}
              disabled={analysing || model.status !== "ready"}
            >
              {model.status === "loading" ? (
                <LoaderCircle size={17} className="animate-spin" />
              ) : (
                <Upload size={17} />
              )}
              {fileUrl ? "Choose another" : "Choose video"}
            </button>
            <button
              type="button"
              className="h-12 px-4 rounded-full border border-border font-semibold text-sm flex items-center gap-2"
              onClick={() => onExample(move)}
              disabled={analysing}
            >
              <Sparkles size={16} /> Example
            </button>
          </div>
        )}

        {expanded && (
          <div
            id="sheet-details"
            className="sheet-body no-scrollbar mt-4 border-t border-border pt-4"
          >
            {live ? (
              <>
                {move === "clear" && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Between swings: preparation checks. Each full swing is scored when detected.
                  </p>
                )}
                <FeedbackPanel analysis={coach.analysis} showScore={false} />
                {move === "clear" && lastSwing && (
                  <SwingVerdict
                    analysis={lastVerdict}
                    title={`Swing ${lastSwing.index}`}
                    {...(lastSwing.contactSnapshot ? { snapshot: lastSwing.contactSnapshot } : {})}
                  />
                )}
              </>
            ) : (
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                <li>Use a steady camera at hip height, 2–3 m away.</li>
                <li>
                  {move === "clear"
                    ? "Stand side-on so the camera sees your hitting arm."
                    : "Face the camera square-on."}
                </li>
                <li>
                  The first {MAX_ANALYSIS_SECONDS} seconds are analysed. Your video never leaves
                  this device.
                </li>
              </ul>
            )}
          </div>
        )}
      </section>

      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        aria-label="Upload a badminton video"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
