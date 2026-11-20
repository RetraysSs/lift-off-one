import { Image as ImageIcon } from "lucide-react";
import type { Analysis } from "@/engine/types";
import { Card } from "@/components/ui/card";
import { CheckList } from "@/components/FeedbackPanel";
export function Snapshot({ src, label }: { src?: string; label: string }) {
  return (
    <div>
      <div className="snapshot">
        {src ? (
          <img src={src} alt={label} className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <ImageIcon size={22} strokeWidth={1.3} />
            <span className="text-xs">{label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
export function SwingVerdict({
  snapshot,
  analysis,
}: {
  snapshot?: string;
  analysis: Analysis | null;
}) {
  return (
    <Card className="mt-6 p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold">Contact moment</h3>
        <span className="text-xs text-muted-foreground">Swing verdict</span>
      </div>
      <Snapshot {...(snapshot ? { src: snapshot } : {})} label="Contact snapshot" />
      {analysis && <CheckList analysis={analysis} />}
    </Card>
  );
}
