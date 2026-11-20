import { Image as ImageIcon } from "lucide-react";
import type { Analysis } from "@/engine/types";
import { CheckList } from "@/components/FeedbackPanel";

export function Snapshot({ src, label }: { src?: string; label: string }) {
  return (
    <figure>
      <div className="snapshot">
        {src ? (
          <img src={src} alt={label} />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ImageIcon size={22} strokeWidth={1.3} />
            <span className="text-xs">{label}</span>
          </div>
        )}
      </div>
      {src && <figcaption className="text-[11px] text-muted-foreground mt-1.5">{label}</figcaption>}
    </figure>
  );
}

export function SwingVerdict({
  snapshot,
  analysis,
  title = "Last swing",
}: {
  snapshot?: string;
  analysis: Analysis | null;
  title?: string;
}) {
  return (
    <div className="tile p-4 mt-5 fade-in">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="display text-sm font-semibold text-violet">
          {analysis?.score ?? "–"} / 100
        </span>
      </div>
      <Snapshot {...(snapshot ? { src: snapshot } : {})} label="Contact moment" />
      {analysis && <CheckList analysis={analysis} />}
    </div>
  );
}
