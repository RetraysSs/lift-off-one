import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";

export interface StageHandle {
  video: HTMLVideoElement | null;
  canvas: HTMLCanvasElement | null;
}
export interface StageProps {
  /** Mirror video and overlay together (front camera in live mode only). */
  mirrored: boolean;
  /** Show native playback controls (uploaded or recorded clips). */
  controls?: boolean;
  /** Floating chrome drawn over the video (not mirrored). */
  children?: ReactNode;
}

/**
 * Video + pose overlay. Both elements stay mounted so hooks can attach streams and draw
 * through the forwarded handle; the canvas is resized to the video's pixel size by the
 * drawing loop so landmarks line up under `object-fit: contain`.
 */
export const Stage = forwardRef<StageHandle, StageProps>(function Stage(
  { mirrored, controls = false, children },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => ({
    get video() {
      return videoRef.current;
    },
    get canvas() {
      return canvasRef.current;
    },
  }));
  return (
    <div className="stage-frame">
      <div className={`stage-media ${mirrored ? "mirrored" : ""}`}>
        <video ref={videoRef} playsInline muted controls={controls} aria-label="Player video" />
        <canvas ref={canvasRef} width={720} height={1280} aria-label="Pose analysis overlay" />
      </div>
      {children}
    </div>
  );
});

/** Matches the overlay canvas to the video's intrinsic size. Returns the frame aspect. */
export function syncCanvas(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w && h && (canvas.width !== w || canvas.height !== h)) {
    canvas.width = w;
    canvas.height = h;
  }
  return w && h ? w / h : 16 / 9;
}
