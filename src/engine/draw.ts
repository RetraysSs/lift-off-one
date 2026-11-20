import type { Analysis, Landmark } from "./types";
import { COLORS, MIN_VISIBILITY } from "./config";
import { BONES, DRAWN_JOINTS, get } from "./pose";

/** Colour per joint: fail wins over pass; joints no check touches stay neutral. */
export function jointColors(analysis: Analysis | null): Map<number, string> {
  const colors = new Map<number, string>();
  if (!analysis) return colors;
  for (const check of analysis.checks) {
    if (check.status === "skip") continue;
    for (const j of check.joints) {
      if (check.status === "fail") colors.set(j, COLORS.fail);
      else if (!colors.has(j)) colors.set(j, COLORS.pass);
    }
  }
  return colors;
}

/**
 * Draws the pose skeleton onto a canvas whose pixel size matches the video frame.
 * Bones are coloured by the checks that involve both of their joints.
 */
export function drawPose(
  ctx: CanvasRenderingContext2D,
  lm: Landmark[] | null,
  analysis: Analysis | null,
) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  if (!lm || lm.length < 33) return;
  const colors = jointColors(analysis);
  const scale = Math.max(2, Math.min(w, h) / 180);
  const seen = (i: number) => (lm[i]?.visibility ?? 1) >= MIN_VISIBILITY;
  const color = (a: number, b: number) => {
    const ca = colors.get(a);
    const cb = colors.get(b);
    if (ca === COLORS.fail || cb === COLORS.fail) return ca && cb ? COLORS.fail : (ca ?? cb)!;
    return ca && cb ? ca : COLORS.none;
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = scale * 1.6;
  for (const [a, b] of BONES) {
    if (!seen(a) || !seen(b)) continue;
    ctx.strokeStyle = color(a, b);
    ctx.beginPath();
    ctx.moveTo(get(lm, a).x * w, get(lm, a).y * h);
    ctx.lineTo(get(lm, b).x * w, get(lm, b).y * h);
    ctx.stroke();
  }

  for (const j of DRAWN_JOINTS) {
    if (!seen(j)) continue;
    ctx.beginPath();
    ctx.arc(get(lm, j).x * w, get(lm, j).y * h, scale * (j === 0 ? 2.6 : 1.7), 0, Math.PI * 2);
    ctx.fillStyle = colors.get(j) ?? COLORS.none;
    ctx.fill();
    ctx.lineWidth = scale * 0.6;
    ctx.strokeStyle = "rgba(15,20,18,0.85)";
    ctx.stroke();
  }

  const focus = analysis?.checks.find(
    (c) => c.status === "fail" && c.focusJoint !== null,
  )?.focusJoint;
  if (focus != null && seen(focus)) {
    const x = get(lm, focus).x * w;
    const y = get(lm, focus).y * h;
    ctx.strokeStyle = COLORS.fail;
    ctx.lineWidth = scale * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, scale * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(x, y, scale * 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

/** Grabs the current video frame with its overlay as a JPEG data URL for reports. */
export function captureSnapshot(
  video: HTMLVideoElement,
  lm: Landmark[] | null,
  analysis: Analysis | null,
  maxWidth = 480,
): string | undefined {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return undefined;
  const scale = Math.min(1, maxWidth / vw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vw * scale);
  canvas.height = Math.round(vh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const overlay = document.createElement("canvas");
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  const octx = overlay.getContext("2d");
  if (octx) {
    drawPose(octx, lm, analysis);
    ctx.drawImage(overlay, 0, 0);
  }
  try {
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}
