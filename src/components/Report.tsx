import { RotateCcw, ScanLine, TriangleAlert } from "lucide-react";
import type { ReportData } from "@/engine/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Score, CheckList, measuredValue } from "@/components/FeedbackPanel";
import { Snapshot } from "@/components/SwingVerdict";
export function Report({
  report,
  analysing,
  onReset,
}: {
  report: ReportData | null;
  analysing: boolean;
  onReset: () => void;
}) {
  if (analysing)
    return (
      <div className="py-16 text-center" role="status">
        <ScanLine className="mx-auto text-primary mb-4" size={30} />
        <h3 className="font-display font-semibold text-lg">Analysing…</h3>
        <Progress value={65} className="max-w-48 mx-auto mt-4" />
        <p className="text-sm text-muted-foreground mt-3">
          Checking your posture and swing moments
        </p>
      </div>
    );
  if (!report)
    return (
      <div className="py-12 text-center">
        <div className="mx-auto size-12 bg-accent text-primary rounded-lg flex items-center justify-center mb-4">
          <ScanLine size={24} />
        </div>
        <h3 className="font-display font-semibold text-lg">Your video report</h3>
        <p className="text-sm text-muted-foreground mt-2">No video selected</p>
      </div>
    );
  return (
    <div className="fade-in">
      <Score value={report.score} />
      {report.move === "stance" && report.stance && (
        <div className="mt-6">
          <h3 className="font-semibold text-sm mb-3">Ready stance</h3>
          <Snapshot
            {...(report.stanceSnapshot ? { src: report.stanceSnapshot } : {})}
            label="Stance snapshot"
          />
          <CheckList analysis={report.stance} />
        </div>
      )}
      {report.move === "clear" &&
        (report.swings.length === 0 ? (
          <Alert className="mt-6" variant="warning">
            <TriangleAlert size={16} />
            <AlertDescription>
              No swing detected. Try recording side-on with your whole body in frame.
            </AlertDescription>
          </Alert>
        ) : (
          report.swings.map((swing) => (
            <Card key={swing.index} className="p-4 mt-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-sm">Swing {swing.index}</h3>
                <span className="text-sm text-primary font-semibold">
                  {swing.score ?? "–"} / 100
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Snapshot
                  {...(swing.prepSnapshot ? { src: swing.prepSnapshot } : {})}
                  label="Preparation"
                />
                <Snapshot
                  {...(swing.contactSnapshot ? { src: swing.contactSnapshot } : {})}
                  label="Contact"
                />
              </div>
              <ul className="mt-4 space-y-4">
                {swing.contact.checks
                  .filter((c) => c.status === "fail")
                  .map((check) => (
                    <li key={check.id}>
                      <p className="text-sm font-medium leading-relaxed">{check.tip}</p>
                      <p className="text-fail text-xs mt-1">
                        {measuredValue(check)} · target {check.target}
                      </p>
                    </li>
                  ))}
              </ul>
            </Card>
          ))
        ))}
      <Button variant="outline" className="mt-6 w-full" onClick={onReset}>
        <RotateCcw /> Analyse another video
      </Button>
    </div>
  );
}
