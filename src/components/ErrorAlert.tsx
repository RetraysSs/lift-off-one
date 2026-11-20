import { TriangleAlert, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Alert variant="destructive" className="my-4">
      <TriangleAlert size={18} />
      <AlertDescription>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{message}</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw /> Try again
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
