# Badminton Form Coach — developer handoff

## Prototype boundaries

This is a single-page, frontend-only shell. All scores, checks, skeletons, and reports are mock data. No camera permission is requested, no video is played or analysed, no frames are captured, and no model is downloaded. Uploading validates the MIME type and shows mock results after two seconds; the selected file is not sent anywhere. Camera controls change UI state only. Recording uses a 3–2–1 countdown followed by a fake five-second recording and returns `null`.

## Routing exception

This project uses TanStack Start with React 19. The requested `src/pages/Index.tsx` is implemented in **`src/routes/index.tsx`**, the template's required home route. Do not introduce a second router or a `src/pages` directory. All other requested component, hook, and engine paths are preserved.

## Integration points

- `src/engine/types.ts`: requested exact public types; preserve their contracts.
- `src/engine/config.ts`: stub status-color exports. Corresponding OKLCH tokens live in `src/styles.css`.
- `src/hooks/usePoseLandmarker.ts`: replace the fake 1.5-second loading delay with real loading and error state handling.
- `src/hooks/useCamera.ts`: replace state-only start/stop with capture and stream cleanup. Returns `{ cameraOn, start, stop, error }`.
- `src/hooks/useRecorder.ts`: replace the fake countdown/recording with recording of actual video. Returns `{ recording, countdown, record }`; `record` resolves a `Blob | null`.
- `src/components/Stage.tsx`: forwarded `StageHandle` exposes `{ video: HTMLVideoElement | null, canvas: HTMLCanvasElement | null }`. Both elements remain mounted; assign video streams and draw the overlay through these refs. Current canvas logical size is 800×450; synchronize the real canvas to the video dimensions. Mirroring applies to video, canvas and preview together only in live mode.
- `src/components/MockSkeleton.tsx`: inline SVG mock; remove when real canvas drawing is available.
- `src/mock/mockData.ts`: sample stance/clear analysis and two-swing report. Replace use of these fixtures in the page with real results.
- `Controls`, `SetupGuide`, `FeedbackPanel`, `SwingVerdict`, `Report`, and `ErrorAlert`: requested props are preserved and exported as named components. `Stage` additionally exports `StageHandle` and `StageProps`.

## State and future analysis

The index route owns `mode`, `move`, `handedness`, `showSetup`, `analysis`, `report`, `analysing`, and `error`. The move selector updates the feedback fixture. Upload mode supports file selection, dropping a video, or trying a sample. Stance produces a stance report; overhead clear produces the two-swing report. For real recording, feed the returned Blob into analysis instead of setting the sample-complete notice. The current handedness switch changes state but cannot affect mock analysis.

Wire camera/model/file failures to `ErrorAlert`. Retry must invoke the failing operation when real integrations exist. `Report` already supports `swings: []` for no-swing detection and optional image URLs/dataURLs for snapshots. The header help button shows the example whole-body warning. Setup text remains dismissible before camera start.

## Development

Install with `bun install`, run locally with `bun run dev`, and run tests with `bunx vitest run`. No backend, auth, analytics, MediaPipe or ML dependency has been added. Future developer additions should be explicitly scoped rather than automatically enabling a backend.
