import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCamera } from "@/hooks/useCamera";
import { useRecorder } from "@/hooks/useRecorder";
import { checkStats, newSession, streakDays, stripSnapshots, summary } from "@/lib/storage";
import { mockClearAnalysis, mockReport, mockStanceAnalysis } from "@/mock/mockData";
import { clock } from "@/lib/format";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("camera", () => {
  it("attaches the stream and stops every track on stop", async () => {
    const stopTrack = vi.fn();
    const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const video = document.createElement("video");
    video.play = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.start(video, "user");
    });
    expect(result.current.cameraOn).toBe(true);
    expect(video.srcObject).toBe(stream);
    act(() => result.current.stop());
    expect(result.current.cameraOn).toBe(false);
    expect(stopTrack).toHaveBeenCalled();
  });

  it("explains a blocked permission", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError")),
      },
    });
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.start(document.createElement("video"));
    });
    expect(result.current.cameraOn).toBe(false);
    expect(result.current.error).toMatch(/Allow camera access/);
  });
});

describe("recorder", () => {
  it("counts down 3–2–1, records for the set time and returns the clip", async () => {
    vi.useFakeTimers();
    class FakeRecorder {
      static isTypeSupported = (t: string) => t === "video/webm";
      state = "inactive";
      mimeType = "video/webm";
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["clip"], { type: "video/webm" }) });
        this.onstop?.();
      }
    }
    vi.stubGlobal("MediaRecorder", FakeRecorder);
    const { result } = renderHook(() => useRecorder());
    const onStart = vi.fn();
    let pending: Promise<Blob | null> | undefined;
    act(() => {
      pending = result.current.record({} as MediaStream, 2000, { onStart });
    });
    expect(result.current.countdown).toBe(3);
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(result.current.countdown).toBe(2);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(result.current.countdown).toBe(null);
    expect(result.current.recording).toBe(true);
    // onStart marks time 0 of the clip, after the countdown, so live frames line up with it.
    expect(onStart).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    const blob = await pending;
    expect(blob?.type).toBe("video/webm");
    expect(result.current.recording).toBe(false);
  });

  it("reports when recording is unsupported", async () => {
    vi.stubGlobal("MediaRecorder", undefined);
    const { result } = renderHook(() => useRecorder());
    let blob: Blob | null = new Blob();
    await act(async () => {
      blob = await result.current.record({} as MediaStream);
    });
    expect(blob).toBeNull();
    expect(result.current.error).toMatch(/isn’t supported/);
  });
});

describe("practice history", () => {
  const day = 864e5;
  const now = new Date(2026, 10, 20, 12).getTime();

  it("strips snapshots before saving", () => {
    const withImages = {
      ...mockReport,
      swings: mockReport.swings.map((s) => ({
        ...s,
        prepSnapshot: "data:x",
        contactSnapshot: "data:y",
      })),
    };
    const session = newSession(withImages, "upload", 5000, now);
    expect(JSON.stringify(session)).not.toContain("data:");
    expect(stripSnapshots({ ...mockReport, stanceSnapshot: "data:z" })).not.toHaveProperty(
      "stanceSnapshot",
    );
  });

  it("counts consecutive practice days", () => {
    const report = { move: "stance" as const, score: 50, swings: [], stance: mockStanceAnalysis };
    const sessions = [0, 1, 2, 4].map((d) => newSession(report, "live", 1000, now - d * day));
    expect(streakDays(sessions, now)).toBe(3);
    expect(streakDays(sessions, now + day)).toBe(3);
    expect(streakDays(sessions, now + 2 * day)).toBe(0);
  });

  it("ranks the weakest checks first and summarises scores", () => {
    const sessions = [
      newSession(
        { move: "stance", score: 67, swings: [], stance: mockStanceAnalysis },
        "live",
        60000,
        now,
      ),
      newSession(mockReport, "upload", 4000, now),
    ];
    const stats = checkStats(sessions);
    expect(stats[0]!.rate).toBe(0);
    expect(stats.find((s) => s.id === "side_on")?.rate).toBe(100);
    expect(mockClearAnalysis.checks).toHaveLength(4);
    expect(summary(sessions)).toMatchObject({ count: 2, average: 59, best: 67, practiceMs: 64000 });
  });

  it("formats clocks as mm:ss", () => {
    expect(clock(270_000)).toBe("04:30");
    expect(clock(-5)).toBe("00:00");
  });
});
