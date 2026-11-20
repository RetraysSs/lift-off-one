import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCamera } from "@/hooks/useCamera";
import { usePoseLandmarker } from "@/hooks/usePoseLandmarker";
import { useRecorder } from "@/hooks/useRecorder";
import { mockStanceAnalysis, mockClearAnalysis, mockReport } from "@/mock/mockData";

afterEach(() => vi.useRealTimers());
describe("Prototype contracts", () => {
  it("becomes ready only after the fake 1.5 second loading period", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePoseLandmarker());
    act(() => vi.advanceTimersByTime(1499));
    expect(result.current.status).toBe("loading");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.status).toBe("ready");
  });
  it("starts and stops a mock camera without requesting permission", async () => {
    const requestCamera = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: requestCamera },
    });
    const { result } = renderHook(() => useCamera());
    expect(result.current.cameraOn).toBe(false);
    await act(() => result.current.start());
    expect(result.current.cameraOn).toBe(true);
    act(() => result.current.stop());
    expect(result.current.cameraOn).toBe(false);
    expect(requestCamera).not.toHaveBeenCalled();
  });
  it("counts down 3–2–1 then records a fake five seconds and returns no video", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useRecorder());
    let pending: Promise<Blob | null> | undefined;
    act(() => {
      pending = result.current.record();
    });
    expect(result.current.countdown).toBe(3);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.countdown).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.countdown).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.countdown).toBe(null);
    expect(result.current.recording).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(4999));
    expect(result.current.recording).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.recording).toBe(false);
    expect(await pending).toBe(null);
  });
  it("uses the specified stance score and knee target", () => {
    expect(mockStanceAnalysis.score).toBe(67);
    expect(mockStanceAnalysis.checks.find((check) => check.id === "knees_bent")).toMatchObject({
      status: "fail",
      value: 172,
      target: "130–160°",
    });
  });
  it("uses the specified clear score and extension target", () => {
    expect(mockClearAnalysis.score).toBe(50);
    expect(mockClearAnalysis.checks.find((check) => check.id === "full_extension")).toMatchObject({
      status: "fail",
      value: 138,
      target: "> 160°",
    });
  });
  it("includes exactly two sample overhead-clear swings", () => {
    expect(mockReport.move).toBe("clear");
    expect(mockReport.swings.map((swing) => swing.index)).toEqual([1, 2]);
  });
});
