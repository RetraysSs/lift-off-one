// STUB — real implementation added later (see BUILD_INSTRUCTIONS.md)
import { useState } from "react";
export function useCamera() {
  const [cameraOn, setCameraOn] = useState(false);
  return {
    cameraOn,
    start: async () => {
      setCameraOn(true);
    },
    stop: () => setCameraOn(false),
    error: null as string | null,
  };
}
