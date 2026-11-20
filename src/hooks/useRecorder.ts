// STUB — real implementation added later (see BUILD_INSTRUCTIONS.md)
import { useEffect, useRef, useState } from "react";
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const active = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const record = async (): Promise<Blob | null> => {
    if (active.current) return null;
    active.current = true;
    setRecording(true);
    for (const count of [3, 2, 1]) {
      if (!mounted.current) {
        active.current = false;
        return null;
      }
      setCountdown(count);
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
    if (mounted.current) setCountdown(null);
    await new Promise<void>((resolve) => setTimeout(resolve, 5000));
    if (mounted.current) setRecording(false);
    active.current = false;
    return null;
  };
  return { recording, countdown, record };
}
