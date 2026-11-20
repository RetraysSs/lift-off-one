# Lift Off — developer handoff

Lift Off is a mobile-first badminton form coach. It tracks the player's pose in the browser
with MediaPipe, scores the ready stance and the overhead clear, and keeps a local practice
history. There is no backend: video, landmarks and history never leave the device.

## What runs where

- **Pose model**: `@mediapipe/tasks-vision` (pinned to an exact version). The JS is bundled and
  imported lazily on the client; the WASM loads from jsDelivr and the `pose_landmarker_lite`
  model from Google's MediaPipe bucket (`src/engine/config.ts`). Keep `MEDIAPIPE_VERSION` equal
  to the installed package version or the WASM will not match.
- **Camera / recording**: `getUserMedia` and `MediaRecorder`. The camera needs https (or
  localhost).
- **Storage**: `localStorage` keys `liftoff.sessions.v1` and `liftoff.settings.v1`. Snapshots are
  stripped before saving to keep sessions small.

## Routing

TanStack Start with React 19. The whole app is the single route **`src/routes/index.tsx`**; tabs
(Home, Progress, Train, Profile) and the report overlay are client state in that route. Do not add
a second router or a `src/pages` directory.

## Layout of the code

- `src/engine/` — framework-free analysis. Keep `types.ts` contracts stable.
  - `pose.ts` landmark indices, geometry, visibility helpers.
  - `analysis.ts` stance checks (knees, feet, racket up, weight forward) and clear checks
    (side-on, free arm, elbow high, extension, contact height); `scoreChecks` = % of measured
    checks passing. Unseen joints produce `skip`, never `fail`.
  - `swings.ts` overhead-swing detection from racket-wrist height: contact is a peak at about head
    height or above, supported by a neighbouring high frame and followed by a downward
    follow-through; preparation is the lowest wrist point before it on the same body (no camera
    cut or tracker drift in between). Tolerates side-on occlusion, a blurred wrist and a hand
    leaving the top of the frame. `findSwings` falls back to the other arm when MediaPipe mixes
    up left/right; `diagnoseSwings` explains a no-swing result (`ReportData.notice`).
  - `report.ts` builds `ReportData` from a frame sequence; `live.ts` summarises a live session.
  - `video.ts` seeks through a file (30 fps for clips up to 30 s, otherwise `ANALYSIS_FPS`), runs
    detection, then captures snapshots.
    Handles MediaRecorder WebM files that report `Infinity` duration.
  - `detector.ts` MediaPipe wrapper (GPU, falls back to CPU) with monotonic timestamps.
  - `draw.ts` canvas skeleton coloured by check status, using `COLORS` from `config.ts`.
  - Thresholds live in `THRESHOLDS` / `SWING`; tune them there.
- `src/hooks/` — `usePoseLandmarker` (shared detector, retry), `useCamera` (stream lifecycle,
  facing mode, wake lock, readable errors), `useRecorder` (3-2-1 countdown, returns a `Blob`),
  `useLiveCoach` (per-frame loop, in-form timer, sampling, live swing detection with snapshots
  from `lib/frameRing.ts`), `useAppData` (sessions & settings).
- `src/components/` — UI. `Stage` keeps the `<video>` and `<canvas>` mounted and exposes them via
  `StageHandle`; mirroring applies to both, only for the front camera in live mode.
  `screens/TrainScreen.tsx` owns the live / record / upload flows.
- `src/mock/mockData.ts` — now only powers the "Example report".
- Visual tokens are in `src/styles.css` (lime surround, lavender primary, Orbitron display type).

## Screens

- **Home**: bento of Practice (opens the move chooser), Tutorials, Analyse match/video (Train in
  upload mode) and Reports. A first-visit screentips tour (`GuideTour`, steps in
  `routes/index.tsx`) spotlights each tile; `settings.tourDone` records completion and Profile /
  the Home **?** button replay it.
- **Tutorials**: good form next to common mistakes for ready stance, forehand and backhand clear
  (`lib/tutorials.ts`). Clips in `public/tutorials` are one-rep, 720p H.264 cuts of the coach's
  originals in `testvids/` (gitignored), about 150–340 KB each. Mistake notes describe what the
  engine measured on each clip. To re-cut: `ffmpeg -ss <start> -i <src> -t <len> -an
  -vf scale=720:-2,fps=30 -c:v libx264 -crf 27 -movflags +faststart <name>.mp4`.
- **Reports** (bottom nav), **Practice** (live / record / upload), **Profile**.

## Flows

1. **Live**: Start camera → skeleton + live checks, score pill, in-form timer (stance) or swing
   count (clear). Pause stops analysis; the square button ends the session and saves a report.
2. **Record**: the round button records `settings.recordSeconds` after a countdown. The report
   is built from the poses the live coach detected during the recording (`startCapture` /
   `stopCapture` in `useLiveCoach`, `reportFromFrames` in `engine/video.ts`), so it matches the
   swings shown live; the clip is only re-read for snapshots. If live coaching captured too few
   frames (e.g. paused) the clip is re-detected like an upload.
3. **Upload**: choose/drop a video (first 90 s analysed). The clip then plays back in the stage
   with the analysed skeleton overlaid.

## Calibration

Check thresholds (`THRESHOLDS` in `engine/config.ts`) are calibrated on real poses from the
coach's good/bad reference clips, stored in `src/test/fixtures/reference-poses.json` (17
landmarks at 30 fps). `src/test/calibration.test.ts` pins the outcome: good forehand ≥ 80 vs
bad ≤ 40, good backhand ≥ 80, good stance above bad, every rep found, and no swing reported
for the two clips whose racket never rises above the head. Change a threshold, run that test.

Swing checks judge windows, not single frames: preparation over the second before contact
(elbow over the last 0.6 s), contact at its best within ±150 ms. Backhands are recognised
by the player's back facing the camera and skip the free-arm check. All clear checks assume
the phone stands **where the net would be, facing the player**, as in the reference clips;
every setup hint in the app says so. Arm extension is the weakest signal from a front-on
camera (foreshortening), so it is the most lenient check.

To re-export poses after adding a clip: run the detector over every frame at 30 fps (as
`engine/video.ts` does) and keep x, y and visibility for the landmarks in the fixture.

## Development

`bun install`, `bun run dev`, `bunx vitest run`, `bun run build`. Engine tests use synthetic
poses in `src/test/fixtures.ts`; add a fixture when changing a threshold.
