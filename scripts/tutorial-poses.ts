/**
 * Cuts each tutorial clip's pose track out of the reference poses, using the same trim
 * window as its video, and writes public/tutorials/<name>.pose.json for the overlay.
 *
 *   bun run tutorial-poses
 *
 * Times are re-based to the start of the trimmed clip. Re-run after changing a trim in
 * src/lib/tutorials.ts (and re-cut the mp4 with the same window).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { TUTORIALS } from "../src/lib/tutorials";
import type { PoseTrack } from "../src/lib/poseFile";

const root = path.resolve(import.meta.dir, "..");
const reference = JSON.parse(
  readFileSync(path.join(root, "src/test/fixtures/reference-poses.json"), "utf8"),
) as { landmarks: number[] } & Record<string, PoseTrack>;

for (const clip of TUTORIALS.flatMap((t) => [t.good, ...t.mistakes])) {
  const source = reference[clip.name];
  if (!source) throw new Error(`No reference poses for ${clip.name}`);
  const [start, length] = clip.trim;
  const from = start * 1000;
  const to = (start + length) * 1000;
  const frames = source.frames
    .filter(([t]) => t >= from - 1 && t <= to + 1)
    .map(([t, lm]) => [Math.round(t - from), lm] as PoseTrack["frames"][number]);
  const out = { landmarks: reference.landmarks, aspect: source.aspect, frames };
  const file = path.join(root, "public", clip.pose);
  writeFileSync(file, JSON.stringify(out));
  console.log(`${clip.pose}: ${frames.length} frames`);
}
