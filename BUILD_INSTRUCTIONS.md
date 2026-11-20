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
  - `swings.ts` overhead-swing detection from racket-wrist height (peak = contact, lowest point in
    the preceding window = preparation).
  - `report.ts` builds `ReportData` from a frame sequence; `live.ts` summarises a live session.
  - `video.ts` seeks through a file at `ANALYSIS_FPS`, runs detection, then captures snapshots.
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

## Flows

1. **Live**: Start camera → skeleton + live checks, score pill, in-form timer (stance) or swing
   count (clear). Pause stops analysis; the square button ends the session and saves a report.
2. **Record**: the round button records `settings.recordSeconds` after a countdown, then the clip
   is analysed like an upload and saved.
3. **Upload**: choose/drop a video (first 90 s analysed). The clip then plays back in the stage
   with the analysed skeleton overlaid.

## Development

`bun install`, `bun run dev`, `bunx vitest run`, `bun run build`. Engine tests use synthetic
poses in `src/test/fixtures.ts`; add a fixture when changing a threshold.
