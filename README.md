# Lift Off

**A mobile-first badminton form coach that runs entirely in the browser.** Point your phone's
camera at yourself and Lift Off tracks your body, scores your **ready stance** and **overhead
clears** (forehand and backhand), and tells you the one adjustment that matters most. Or upload
a practice or match video and get one overall report with snapshots of every swing. No
account, no server, and video never leaves the device.

**Live app**: https://lift-off-one.lovable.app · Developer detail:
[BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)

---

## At a glance

| | |
|---|---|
| **Problem** | Club players rarely get coaching feedback on basic form, and video review is slow. |
| **Solution** | A phone becomes a coach: real-time pose tracking plus rules calibrated on a coach's good/bad reference videos. |
| **Moves assessed** | Ready stance; overhead clear (forehand and backhand recognised automatically). |
| **Modes** | Live coaching · record a short clip · upload a match/practice video for an overall analysis. |
| **Privacy** | All analysis on-device. Nothing uploaded; history stored locally. |
| **Platform** | Web app (installable, phone-first); works on iPhone and Android browsers and desktop. |

## Features

- **Home**: bento layout with Practice, Tutorials, Analyse match/video and Reports, plus a
  first-visit guided tour (screentips) that can be replayed.
- **Practice (live)**: full-screen camera with a colour-coded skeleton (green = on target,
  red = adjust), a live score, an "in form" timer for the stance and a "Swing detected" flash
  with a score for each clear. Compact controls: switch camera, record, pause.
- **Record**: configurable countdown (off/3/5/10 s) and clip length; pause holds the
  countdown or recording; the clip becomes a report.
- **Analyse match or video**: one overall report covering every clear and the ready stance
  held between shots, with preparation/contact snapshots and the skeleton replayed over the
  video.
- **Tutorials**: one-rep clips of good form next to common mistakes for ready stance,
  forehand clear and backhand clear, with slow motion and the skeleton analysis overlaid.
- **Reports**: score trend chart, day streak, practice time, "focus areas" (pass rate per
  check, weakest first) and full session history.
- **Profile**: racket hand, default move, clip length, countdown, camera, setup tips.

## Technology

| Layer | What we use | Why |
|---|---|---|
| UI | **React 19**, **TypeScript**, **TanStack Start/Router**, **Tailwind CSS v4**, shadcn/Radix primitives, lucide icons | Typed, component-based, fast to iterate; single-route app shell |
| Pose estimation | **Google MediaPipe Pose Landmarker (lite)**, `@mediapipe/tasks-vision` 0.10.35, WebAssembly + WebGL (GPU, CPU fallback) | Detects 33 body landmarks per frame in real time on a phone, no server |
| Camera & recording | `getUserMedia`, `MediaRecorder`, Screen Wake Lock | Native browser APIs; nothing to install |
| Analysis engine | Our own TypeScript engine (`src/engine/`): geometry, checks, swing detection, scoring, reports | Framework-free, unit-tested, explainable rules |
| Drawing | HTML Canvas overlay | Skeleton synced to video, mirrored for the front camera |
| Charts | Recharts | Score trend in Reports |
| Storage | Browser `localStorage` | Private, offline history; no backend |
| Tooling | Bun, Vite 8, Vitest + Testing Library, ESLint, Prettier, FFmpeg (tutorial clips) | Fast builds and tests |
| Hosting | Lovable (Cloudflare edge), synced from GitHub | Zero-ops deployment |

## How Lift Off assesses form

```
camera / video ─▶ MediaPipe pose (33 landmarks) ─▶ geometry ─▶ checks ─▶ score + top tip
                                                     │
                                                     └▶ swing detection ─▶ per-swing verdict
```

1. **Pose tracking.** Each frame becomes 33 landmarks (x, y, visibility). Distances are
   normalised by the player's torso length, so results don't depend on distance from the
   camera or phone resolution.
2. **Posture checks.** Each check is a measurable rule with a pass/fail, a value, a target
   and a coaching tip. Joints the camera can't see are marked "not measured", never failed.
   - *Ready stance*: knees bent, feet 1.1–1.9× shoulder width, racket hand up, weight forward
     (side view).
   - *Overhead clear*: turned side-on, free arm raised, racket elbow high (preparation);
     full arm extension and reach high at contact.
3. **Swing detection.** A clear is found from the racket wrist's height over time: a rise from
   a loaded preparation to a peak above the head, then a follow-through down. Guards reject
   false swings: racket raised and held, one-frame glitches, camera cuts or the tracker
   jumping to another person. Backhands are recognised (back to camera) and judged without
   the free-arm rule. If the camera mixes up left and right arms, the other arm is checked.
4. **Time windows, not single frames.** Preparation is judged over the second before contact
   and contact at its best within ±150 ms, which matches how coaches watch a swing.
5. **Scoring.** Score = % of measured checks on target. The report leads with the first
   failing check as "Your next adjustment". If no swing is found, it says why (out of frame,
   never above the head, or no full swing).
6. **Overall video analysis.** Finds every clear (including attempts that stay below head
   height) and the ready stance held between shots, and averages the two parts.

### Calibrated on real coaching footage

Thresholds were tuned on a coach's labelled **good vs bad** reference videos (≈2,500 frames
of real pose data, kept as a regression test so changes can't make bad form score like good):

| Reference video | Before calibration | After |
|---|---|---|
| Forehand clear: good / bad | 27 / 20 | **93 / 20** |
| Backhand clear: good | 52 | **100** |
| Ready stance: good / bad | 33 / 0 | **100 / 67** |
| Overall analysis: good / bad forehand video | — | **97 / 27** |

Every forehand and backhand rep in the reference videos is detected, and no swings are
invented in the stance videos.

## Efficiency

- **Runs on the device.** No server round-trips, no per-use cost; it works anywhere the page
  has loaded. The pose model (lite variant) is downloaded once and cached by the browser.
- **Real-time.** Detection runs on every camera frame (~30 fps on GPU); the UI updates 4×
  a second to keep phones cool, and the skeleton is drawn on a canvas.
- **Fast analysis** (measured in a headless browser on a laptop):

  | Input | Time |
  |---|---|
  | 3 s recorded clip | ~2–4 s (often instant: reuses the poses already tracked live) |
  | 14 s phone video (30 fps sampling) | ~12–15 s |
  | 90 s match video (15 fps sampling) | ~60 s |

- **Small assets.** Tutorial videos were trimmed and re-encoded from **146 MB to 2.1 MB**
  (720p H.264, one rep each); their skeleton data is **16–28 KB** per clip, precomputed.
  Reports store no images, so history stays small.
- **Lean by design.** Only the 17 landmarks the rules use are kept for reference data; long
  videos are sampled at 15 fps and capped at 90 s.

## Quality

- **62 automated tests**: engine rules, swing detection edge cases from real footage (glitches,
  occlusion, camera cuts, swapped arms), calibration on the reference videos, recorder and
  camera hooks, and UI flows.
- Type-checked (strict TypeScript), linted, and verified in a real browser with a simulated
  camera.

## Known limits

- Best results with the phone **where the net would be, facing the player**, whole body in
  frame (as in the reference videos). Other angles can misjudge side-on and backhand.
- MediaPipe tracks the hand, not the racket, so racket-head position isn't measured.
- A backhand performed without turning (the classic mistake) is read as a forehand.
- Calibrated on one player in one room; more reference players would strengthen it.

## Roadmap

Tune with more players and courts · offline mode (cache model and WASM) · more strokes
(smash, net drop, footwork) · coach sharing.

---

## Development

Requires [Bun](https://bun.sh) (or Node.js + npm).

```sh
bun install
bun run dev        # local dev server
bun run test       # 62 tests
bun run build      # production build
```

Camera access needs https or localhost. See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
for architecture, calibration and how the tutorial assets are made.

## Built with Lovable

This project is connected to [Lovable](https://lovable.dev): changes pushed to `main` sync to
the [Lovable editor](https://lovable.dev/projects/be679396-a1eb-43a3-b05e-c2b4d8da2539) and
deploy to the live app.
