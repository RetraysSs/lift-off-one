import type { Move } from "@/engine/types";

/**
 * Reference clips in public/tutorials, trimmed to one repetition from the coach's
 * originals (testvids/). Mistake notes describe what the pose engine measured on each
 * "bad" clip, so they match the feedback players will get.
 */
export interface TutorialClip {
  src: string;
  poster: string;
  /** What to look for, in order of importance. */
  points: string[];
}

export interface Tutorial {
  id: "stance" | "fh-clear" | "bh-clear";
  title: string;
  /** Which practice mode coaches this. */
  move: Move;
  /** How to set up the camera when practising it. */
  camera: string;
  good: TutorialClip;
  mistakes: TutorialClip[];
}

const clip = (name: string, points: string[]): TutorialClip => ({
  src: `/tutorials/${name}.mp4`,
  poster: `/tutorials/${name}.jpg`,
  points,
});

export const TUTORIALS: Tutorial[] = [
  {
    id: "stance",
    title: "Ready stance",
    move: "stance",
    camera: "Face the camera, whole body in frame.",
    good: clip("stance-good", [
      "Feet a little wider than your shoulders.",
      "Knees soft and bent, ready to push off.",
      "Racket held in front of you, ready to react.",
      "Weight on the balls of your feet.",
    ]),
    mistakes: [
      clip("stance-bad", [
        "Feet too close together (about 0.7× shoulder width).",
        "Legs straight, so the first step is slow.",
        "Racket hanging down by the side instead of up and ready.",
      ]),
    ],
  },
  {
    id: "fh-clear",
    title: "Forehand clear",
    move: "clear",
    camera: "Phone where the net would be, facing you.",
    good: clip("fh-clear-good", [
      "Turn side-on with your racket shoulder back.",
      "Point your free arm up at the shuttle.",
      "Racket back, elbow high.",
      "Reach up and hit at full stretch, then follow through down.",
    ]),
    mistakes: [
      clip("fh-clear-bad", [
        "Square to the net instead of side-on.",
        "Free arm stays down, so there is no balance or aim.",
        "Arm bent at contact (about 120–145°), losing height and power.",
      ]),
      clip("fh-clear-bad-2", [
        "Racket hand never gets above the head.",
        "Short arm swing with no full reach.",
      ]),
    ],
  },
  {
    id: "bh-clear",
    title: "Backhand clear",
    move: "clear",
    camera: "Phone where the net would be: it sees your back.",
    good: clip("bh-clear-good", [
      "Turn your back to the net.",
      "Lead with the elbow, racket arm rising.",
      "Snap out to full reach high above you (arm straight, about 160°+).",
    ]),
    mistakes: [
      clip("bh-clear-bad", [
        "Racket hand stays below head height.",
        "Pushing the shot instead of reaching up through it.",
      ]),
    ],
  },
];
