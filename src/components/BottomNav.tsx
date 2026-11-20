import { House, ChartNoAxesColumn, Dumbbell, User } from "lucide-react";

export type Tab = "home" | "progress" | "train" | "profile";

const ITEMS: { tab: Tab; label: string; Icon: typeof House }[] = [
  { tab: "home", label: "Home", Icon: House },
  { tab: "progress", label: "Progress", Icon: ChartNoAxesColumn },
  { tab: "train", label: "Train", Icon: Dumbbell },
  { tab: "profile", label: "Profile", Icon: User },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ tab: t, label, Icon }) => (
        <button
          key={t}
          type="button"
          className="nav-btn"
          aria-current={tab === t ? "page" : undefined}
          aria-label={label}
          title={label}
          onClick={() => onChange(t)}
        >
          <Icon size={21} strokeWidth={1.9} />
        </button>
      ))}
    </nav>
  );
}
