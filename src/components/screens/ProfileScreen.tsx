import { useState, type ReactNode } from "react";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { LogoMark } from "@/components/LogoMark";
import type { Settings } from "@/lib/storage";

function Row({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-semibold block">
          {label}
        </label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          className="px-3 !h-8 !text-[13px]"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function ProfileScreen({
  settings,
  onChange,
  sessionCount,
  onClearHistory,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  sessionCount: number;
  onClearHistory: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="screen-pad fade-in">
      <h1 className="display text-xl font-semibold">Profile</h1>

      <div className="tile p-4 mt-5 flex items-center gap-3">
        <LogoMark size={48} />
        <div className="flex-1 min-w-0">
          <label htmlFor="name" className="eyebrow">
            Player name
          </label>
          <input
            id="name"
            value={settings.name}
            maxLength={30}
            placeholder="Add your name"
            autoComplete="given-name"
            onChange={(e) => onChange({ name: e.target.value })}
            className="block w-full bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground/70 mt-0.5"
          />
        </div>
      </div>

      <h2 className="eyebrow mt-6 mb-2">Coaching</h2>
      <div className="tile divide-y divide-border">
        <Row label="Racket hand" hint="Checks your hitting arm">
          <Seg
            label="Racket hand"
            value={settings.handedness}
            options={[
              ["right", "Right"],
              ["left", "Left"],
            ]}
            onChange={(handedness) => onChange({ handedness })}
          />
        </Row>
        <Row label="Default move">
          <Seg
            label="Default move"
            value={settings.defaultMove}
            options={[
              ["stance", "Stance"],
              ["clear", "Clear"],
            ]}
            onChange={(defaultMove) => onChange({ defaultMove })}
          />
        </Row>
        <Row label="Clip length" hint="Recorded after a 3-2-1 countdown">
          <Seg
            label="Clip length"
            value={settings.recordSeconds}
            options={[
              [3, "3s"],
              [5, "5s"],
              [8, "8s"],
              [12, "12s"],
            ]}
            onChange={(recordSeconds) => onChange({ recordSeconds })}
          />
        </Row>
        <Row label="Camera">
          <Seg
            label="Camera"
            value={settings.facing}
            options={[
              ["user", "Front"],
              ["environment", "Back"],
            ]}
            onChange={(facing) => onChange({ facing })}
          />
        </Row>
        <Row label="Setup tips" hint="Show positioning help on the camera" htmlFor="guide">
          <Switch
            id="guide"
            checked={settings.showGuide}
            onCheckedChange={(showGuide) => onChange({ showGuide })}
          />
        </Row>
      </div>

      <h2 className="eyebrow mt-6 mb-2">Data</h2>
      <div className="tile p-4">
        <p className="text-sm flex gap-2.5">
          <ShieldCheck size={18} className="text-pass shrink-0" />
          <span>
            Video is analysed on this device and never uploaded. The pose model is downloaded once
            from Google’s MediaPipe servers.
          </span>
        </p>
        {confirming ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="flex-1 h-10 rounded-full bg-destructive text-destructive-foreground text-sm font-semibold"
              onClick={() => {
                onClearHistory();
                setConfirming(false);
              }}
            >
              Delete {sessionCount} sessions
            </button>
            <button
              type="button"
              className="h-10 px-4 rounded-full border border-border text-sm font-semibold"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-4 h-10 px-4 rounded-full border border-border text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
            disabled={sessionCount === 0}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={15} /> Clear practice history
          </button>
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground mt-8">
        Lift Off · Practise with purpose. Play with confidence.
      </p>
    </div>
  );
}
