import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { useRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeScreen } from "@/components/screens/HomeScreen";
import { TutorialsScreen } from "@/components/screens/TutorialsScreen";
import { PracticeChooser } from "@/components/PracticeChooser";
import { GuideTour, type TourStep } from "@/components/GuideTour";
import { TUTORIALS } from "@/lib/tutorials";
import { expandTrack } from "@/lib/poseFile";
import { tutorialVerdict } from "@/lib/tutorialVerdict";

// jsdom has no media playback.
HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
Element.prototype.scrollIntoView = vi.fn();

describe("tutorials", () => {
  it("ships every clip and poster it references", () => {
    const files = TUTORIALS.flatMap((t) => [t.good, ...t.mistakes]).flatMap((c) => [
      c.src,
      c.poster,
    ]);
    for (const f of files) expect(existsSync(path.join("public", f)), f).toBe(true);
  });

  it("switches between good form and a mistake, and leads into practice", () => {
    const onPractise = vi.fn();
    render(<TutorialsScreen onBack={() => {}} onPractise={onPractise} />);
    expect(screen.getByText("Good form", { selector: "span" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mistake" }));
    expect(screen.getByText("Common mistake")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Forehand clear" }));
    expect(screen.getByRole("button", { name: "Mistake 2" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Practise your clear/ }));
    expect(onPractise).toHaveBeenCalledWith("clear");
  });
});

describe("home", () => {
  it("offers practice, tutorials, analysis and reports, each going to the right place", () => {
    const handlers = {
      onPractice: vi.fn(),
      onTutorials: vi.fn(),
      onAnalyse: vi.fn(),
      onReports: vi.fn(),
    };
    render(<HomeScreen name="" sessions={[]} onOpen={() => {}} onHelp={() => {}} {...handlers} />);
    fireEvent.click(screen.getByRole("button", { name: /Practice/ }));
    fireEvent.click(screen.getByRole("button", { name: /Tutorials/ }));
    fireEvent.click(screen.getByRole("button", { name: /Analyse match or video/ }));
    fireEvent.click(screen.getByRole("button", { name: /Reports/ }));
    for (const fn of Object.values(handlers)) expect(fn).toHaveBeenCalledTimes(1);
    // New players are told where to begin.
    expect(screen.getByText("START HERE")).toBeInTheDocument();
  });

  it("lets the player choose which move to practise", () => {
    const onChoose = vi.fn();
    render(<PracticeChooser onChoose={onChoose} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Overhead clear/ }));
    expect(onChoose).toHaveBeenCalledWith("clear");
  });
});

describe("screentips tour", () => {
  const steps: TourStep[] = [
    { title: "Welcome", body: "Intro" },
    { target: "practice", title: "Start here", body: "Practice tile" },
    { target: "reports", title: "Reports", body: "Reports tile" },
  ];
  function Harness({ onDone }: { onDone: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    return (
      <div ref={ref}>
        <button data-tour="practice">Practice</button>
        <button data-tour="reports">Reports</button>
        <GuideTour steps={steps} container={ref} onDone={onDone} />
      </div>
    );
  }

  it("walks through each step and finishes", () => {
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    expect(screen.getByRole("dialog", { name: "Welcome" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    expect(screen.getByText("STEP 1 OF 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Reports" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Let’s go" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("can be skipped", () => {
    const onDone = vi.fn();
    render(<Harness onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("tutorial skeleton analysis", () => {
  const verdictFor = (clip: (typeof TUTORIALS)[number]["good"], move: "stance" | "clear") => {
    const track = JSON.parse(readFileSync(path.join("public", clip.pose), "utf8"));
    return tutorialVerdict(move, expandTrack(track.landmarks, track), track.aspect);
  };

  it("has a pose track matching each clip's length", () => {
    for (const clip of TUTORIALS.flatMap((t) => [t.good, ...t.mistakes])) {
      const track = JSON.parse(readFileSync(path.join("public", clip.pose), "utf8"));
      const last = track.frames[track.frames.length - 1][0];
      expect(Math.abs(last - clip.trim[1] * 1000), clip.name).toBeLessThan(80);
    }
  });

  it("shows good form in green and flags each mistake", () => {
    for (const t of TUTORIALS) {
      const good = verdictFor(t.good, t.move);
      expect(good.score, t.id).toBeGreaterThanOrEqual(80);
      for (const m of t.mistakes) {
        const bad = verdictFor(m, t.move);
        expect(
          bad.analysis.checks.some((c) => c.status === "fail"),
          m.name,
        ).toBe(true);
        expect(bad.score ?? 0, m.name).toBeLessThan(good.score!);
      }
    }
    expect(verdictFor(TUTORIALS[2]!.good, "clear").label).toMatch(/^Backhand/);
  });
});
