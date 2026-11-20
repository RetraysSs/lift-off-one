import { forwardRef, useImperativeHandle, useRef } from "react";
import { ScanLine } from "lucide-react";
import { MockSkeleton } from "@/components/MockSkeleton";
import { SetupGuide } from "@/components/SetupGuide";
import { Badge } from "@/components/ui/badge";
export interface StageHandle {
  video: HTMLVideoElement | null;
  canvas: HTMLCanvasElement | null;
}
export interface StageProps {
  mirrored: boolean;
  showSetup: boolean;
  onDismissSetup: () => void;
}
export const Stage = forwardRef<StageHandle, StageProps>(function Stage(
  { mirrored, showSetup, onDismissSetup },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useImperativeHandle(ref, () => ({ video: videoRef.current, canvas: canvasRef.current }));
  return (
    <div className="relative">
      <div className="stage-frame">
        <div className={`stage-media ${mirrored ? "-scale-x-100" : ""}`}>
          <video ref={videoRef} playsInline muted aria-label="Player video" />
          <canvas ref={canvasRef} width={800} height={450} aria-label="Pose analysis overlay" />
          <MockSkeleton />
        </div>
        <div className="absolute top-4 left-4 right-4 flex justify-between gap-2">
          <Badge variant="preview">
            <ScanLine size={13} /> Pose preview
          </Badge>
          <span className="text-stage-muted text-xs flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-pass" />
            {mirrored ? "Mirrored view" : "Video view"}
          </span>
        </div>
        <div
          className={`absolute top-[65%] ${mirrored ? "left-[21%]" : "right-[21%]"} text-fail text-xs font-medium border border-fail/40 rounded px-2 py-1 bg-stage-surface`}
        >
          Knees bent <span className="opacity-70">172°</span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-stage-muted text-[11px]">
          <span>FULL BODY TRACKING</span>
          <span>16:9</span>
        </div>
      </div>
      <SetupGuide visible={showSetup} onDismiss={onDismissSetup} />
    </div>
  );
});
