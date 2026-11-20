import { ScanLine, X, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
export interface SetupGuideProps {
  visible: boolean;
  warning?: string;
  onDismiss: () => void;
}
export function SetupGuide({ visible, warning, onDismiss }: SetupGuideProps) {
  if (!visible) return null;
  return (
    <div className="setup-guide fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <ScanLine size={17} /> Find your position
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          aria-label="Dismiss setup guide"
          className="h-7 w-7"
        >
          <X />
        </Button>
      </div>
      <p className="setup-copy mt-2 text-sm leading-relaxed">
        Stand 2–3 m away with your whole body in frame. Face the camera for the ready stance, stand
        side-on for the overhead clear.
      </p>
      {warning && (
        <Alert variant="warning" className="mt-3">
          <TriangleAlert size={16} />
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
