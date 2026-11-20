import type { Analysis, Landmark } from "@/engine/types";
import { drawPose } from "@/engine/draw";

/**
 * Keeps small copies of the most recent live video frames so that swing snapshots can
 * be produced after the swing is detected (detection lags contact by a few hundred ms).
 */
export class FrameRing {
  private slots: { t: number; canvas: HTMLCanvasElement }[] = [];
  private next = 0;

  constructor(
    private size = 48,
    private maxWidth = 360,
  ) {}

  push(video: HTMLVideoElement, t: number) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(1, this.maxWidth / vw);
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);
    let slot = this.slots[this.next];
    if (!slot) {
      slot = { t, canvas: document.createElement("canvas") };
      this.slots[this.next] = slot;
    }
    if (slot.canvas.width !== w || slot.canvas.height !== h) {
      slot.canvas.width = w;
      slot.canvas.height = h;
    }
    slot.t = t;
    slot.canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    this.next = (this.next + 1) % this.size;
  }

  /** JPEG of the stored frame nearest to `t`, with the pose drawn on top. */
  snapshot(t: number, lm: Landmark[], analysis: Analysis, mirrored: boolean): string | undefined {
    let best: { t: number; canvas: HTMLCanvasElement } | undefined;
    for (const s of this.slots) if (!best || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
    if (!best || Math.abs(best.t - t) > 120) return undefined;
    const out = document.createElement("canvas");
    out.width = best.canvas.width;
    out.height = best.canvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return undefined;
    const overlay = document.createElement("canvas");
    overlay.width = out.width;
    overlay.height = out.height;
    const octx = overlay.getContext("2d");
    if (mirrored) {
      ctx.translate(out.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(best.canvas, 0, 0);
    if (octx) {
      drawPose(octx, lm, analysis);
      ctx.drawImage(overlay, 0, 0);
    }
    try {
      return out.toDataURL("image/jpeg", 0.72);
    } catch {
      return undefined;
    }
  }

  clear() {
    this.slots = [];
    this.next = 0;
  }
}
