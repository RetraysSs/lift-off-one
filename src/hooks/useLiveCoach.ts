import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Analysis, Frame, Handedness, Move, SwingReport } from "@/engine/types";
import type { PoseDetector } from "@/engine/detector";
import type { StageHandle } from "@/components/Stage";
import { syncCanvas } from "@/components/Stage";
import {
  analyseClearContact,
  analyseClearPrep,
  analyseFrame,
  combineAnalyses,
} from "@/engine/analysis";
import { drawPose } from "@/engine/draw";
import { wholeBodyVisible } from "@/engine/pose";
import { detectSwings, SWING } from "@/engine/swings";
import type { LiveSample } from "@/engine/live";
import { FrameRing } from "@/lib/frameRing";

const PUBLISH_MS = 250;
const SAMPLE_MS = 500;
const SNAPSHOT_EVERY = 6; // every 3 s of samples
const BUFFER_MS = 2600;
const SWING_CHECK_MS = 150;

export interface LiveState {
  analysis: Analysis | null;
  bodyVisible: boolean;
  /** Current unbroken time with every measured check on target. */
  inFormMs: number;
  bestInFormMs: number;
  swings: SwingReport[];
}

const EMPTY: LiveState = {
  analysis: null,
  bodyVisible: false,
  inFormMs: 0,
  bestInFormMs: 0,
  swings: [],
};

/**
 * Runs pose detection on the live camera each video frame, draws the overlay and
 * accumulates the practice session (stance samples and detected swings).
 */
export function useLiveCoach({
  stageRef,
  detector,
  active,
  move,
  handedness,
  mirrored,
}: {
  stageRef: RefObject<StageHandle | null>;
  detector: PoseDetector | null;
  active: boolean;
  move: Move;
  handedness: Handedness;
  mirrored: boolean;
}) {
  const [state, setState] = useState<LiveState>(EMPTY);
  const samples = useRef<LiveSample[]>([]);
  const swings = useRef<SwingReport[]>([]);
  const inForm = useRef({ since: -1, best: 0 });
  const ring = useRef<FrameRing | null>(null);
  const sessionStart = useRef<number | null>(null);

  const reset = useCallback(() => {
    samples.current = [];
    swings.current = [];
    inForm.current = { since: -1, best: 0 };
    ring.current?.clear();
    sessionStart.current = null;
    setState(EMPTY);
  }, []);

  // A new move is a new session.
  useEffect(reset, [move, handedness, reset]);

  useEffect(() => {
    if (!active || !detector) return;
    ring.current ??= new FrameRing(60);
    const overlay = stageRef.current?.canvas;
    const buffer: Frame[] = [];
    sessionStart.current ??= performance.now();
    const start = sessionStart.current;
    inForm.current.since = -1;
    let raf = 0;
    let lastVideoTime = -1;
    let lastPublish = 0;
    let lastSample = 0;
    let lastSwingCheck = 0;
    let lastContact = -Infinity;
    let sampleCount = 0;
    let latest: Analysis | null = null;
    let body = false;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const video = stageRef.current?.video;
      const canvas = stageRef.current?.canvas;
      if (!video || !canvas || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      lastVideoTime = video.currentTime;
      const now = performance.now();
      const t = now - start;
      const aspect = syncCanvas(video, canvas);
      const lm = detector.detect(video, now);
      const analysis = lm ? analyseFrame(move, lm, handedness, aspect) : null;
      const ctx = canvas.getContext("2d");
      if (ctx) drawPose(ctx, lm, analysis);
      latest = analysis;
      body = wholeBodyVisible(lm);

      // Unbroken good-form timer.
      const measured = analysis?.checks.filter((c) => c.status !== "skip") ?? [];
      const good = body && measured.length >= 2 && measured.every((c) => c.status === "pass");
      const f = inForm.current;
      if (good) {
        if (f.since < 0) f.since = t;
        f.best = Math.max(f.best, t - f.since);
      } else f.since = -1;

      if (lm) {
        buffer.push({ t, lm });
        while (buffer.length && (buffer[0]?.t ?? t) < t - BUFFER_MS) buffer.shift();
      }

      if (lm && body && analysis && t - lastSample >= SAMPLE_MS) {
        lastSample = t;
        sampleCount++;
        const sample: LiveSample = { analysis };
        if (move === "stance" && sampleCount % SNAPSHOT_EVERY === 1) {
          ring.current?.push(video, t);
          const snap = ring.current?.snapshot(t, lm, analysis, mirrored);
          if (snap) sample.snapshot = snap;
        }
        samples.current.push(sample);
        if (samples.current.length > 2400) samples.current.splice(0, 1);
      }

      if (move === "clear") {
        ring.current?.push(video, t);
        if (t - lastSwingCheck >= SWING_CHECK_MS) {
          lastSwingCheck = t;
          for (const s of detectSwings(buffer, handedness, aspect)) {
            const contact = buffer[s.contactIndex];
            const prepFrame = buffer[s.prepIndex];
            if (!contact || !prepFrame) continue;
            // Wait until the peak window has passed so the contact is final.
            if (
              contact.t <= lastContact + SWING.minGapMs ||
              t - contact.t < SWING.peakWindowMs + 50
            )
              continue;
            lastContact = contact.t;
            const prep = analyseClearPrep(prepFrame.lm, handedness, aspect);
            const hit = analyseClearContact(contact.lm, handedness, aspect);
            const prepSnapshot = ring.current?.snapshot(prepFrame.t, prepFrame.lm, prep, mirrored);
            const contactSnapshot = ring.current?.snapshot(contact.t, contact.lm, hit, mirrored);
            swings.current = [
              ...swings.current,
              {
                index: swings.current.length + 1,
                prepTimeMs: Math.round(prepFrame.t),
                contactTimeMs: Math.round(contact.t),
                prep,
                contact: hit,
                score: combineAnalyses(prep, hit).score,
                ...(prepSnapshot ? { prepSnapshot } : {}),
                ...(contactSnapshot ? { contactSnapshot } : {}),
              },
            ];
            lastPublish = 0;
          }
        }
      }

      if (now - lastPublish >= PUBLISH_MS) {
        lastPublish = now;
        setState({
          analysis: latest,
          bodyVisible: body,
          inFormMs: f.since >= 0 ? t - f.since : 0,
          bestInFormMs: f.best,
          swings: swings.current,
        });
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      const canvas = overlay;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [active, detector, move, handedness, mirrored, stageRef]);

  /** Everything gathered since the last reset. */
  const collect = useCallback(
    () => ({ samples: samples.current, swings: swings.current, bestInFormMs: inForm.current.best }),
    [],
  );

  return { ...state, reset, collect };
}
