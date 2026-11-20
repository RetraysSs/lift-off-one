import { useRef, useState } from "react";
import { Camera, Upload, Circle, ChevronDown, Play, Video } from "lucide-react";
import type { Mode, Move, Handedness } from "@/engine/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export interface ControlsProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  move: Move;
  onMoveChange: (move: Move) => void;
  handedness: Handedness;
  onHandednessChange: (handedness: Handedness) => void;
  cameraOn: boolean;
  onStartCamera: () => void;
  onRecord: () => void;
  onUpload: (file: File) => void;
  onSample: () => void;
  disabled: boolean;
}
export function Controls({
  mode,
  onModeChange,
  move,
  onMoveChange,
  handedness,
  onHandednessChange,
  cameraOn,
  onStartCamera,
  onRecord,
  onUpload,
  onSample,
  disabled,
}: ControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <Tabs
      value={mode}
      onValueChange={(value) => {
        if (value === "live" || value === "upload") onModeChange(value);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-border pb-5 mb-6">
        <TabsList className="h-11">
          <TabsTrigger value="live" disabled={disabled} className="h-9 gap-2 px-5">
            <Camera size={16} /> Live
          </TabsTrigger>
          <TabsTrigger value="upload" disabled={disabled} className="h-9 gap-2 px-5">
            <Upload size={16} /> Upload
          </TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-3">
            <label htmlFor="move" className="text-sm text-muted-foreground">
              Move
            </label>
            <Select
              value={move}
              onValueChange={(value) => {
                if (value === "stance" || value === "clear") onMoveChange(value);
              }}
              disabled={disabled}
            >
              <SelectTrigger id="move" className="w-[175px] h-10 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stance">Ready stance</SelectItem>
                <SelectItem value="clear">Overhead clear</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2.5">
            <Switch
              id="handedness"
              checked={handedness === "left"}
              onCheckedChange={(checked) => onHandednessChange(checked ? "left" : "right")}
              disabled={disabled}
            />
            <label htmlFor="handedness" className="text-sm cursor-pointer">
              Left-handed
            </label>
          </div>
        </div>
      </div>
      <TabsContent value="live">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStartCamera} disabled={disabled}>
            <Camera />
            {cameraOn ? "Stop camera" : "Start camera"}
          </Button>
          <Button size="lg" variant="outline" onClick={onRecord} disabled={disabled || !cameraOn}>
            <Circle className="text-fail" /> Record 5 s
          </Button>
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${cameraOn ? "bg-pass" : "bg-neutral"}`} />
            {cameraOn ? "Camera on · preview" : "Camera off"}
          </span>
        </div>
      </TabsContent>
      <TabsContent value="upload">
        <div className="flex flex-wrap gap-3 items-center">
          <Button size="lg" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <Upload /> Choose video
          </Button>
          <Button size="lg" variant="outline" onClick={onSample} disabled={disabled}>
            <Play /> Try a sample
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">Video stays on your device</span>
        </div>
      </TabsContent>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="sr-only"
        aria-label="Upload a badminton video"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
      />
      {mode === "upload" && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="Drop or choose a video"
          aria-disabled={disabled}
          className={`dropzone mt-4 p-5 flex items-center gap-4 ${dragging ? "dragging" : ""}`}
          onClick={() => {
            if (!disabled) inputRef.current?.click();
          }}
          onKeyDown={(event) => {
            if (!disabled && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file && !disabled) onUpload(file);
          }}
        >
          <div className="rounded-md bg-accent p-3 text-primary">
            <Video size={20} />
          </div>
          <div>
            <p className="font-medium text-sm">Drop your badminton video here</p>
            <p className="text-muted-foreground text-xs mt-1">
              MP4, MOV, WebM or another video format
            </p>
          </div>
          <ChevronDown size={18} className="ml-auto text-muted-foreground" />
        </div>
      )}
    </Tabs>
  );
}
