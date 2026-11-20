// STUB — real implementation added later (see BUILD_INSTRUCTIONS.md)
import { useEffect, useState } from "react";
export function usePoseLandmarker() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const timer = setTimeout(() => setStatus("ready"), 1500);
    return () => clearTimeout(timer);
  }, []);
  return { status };
}
