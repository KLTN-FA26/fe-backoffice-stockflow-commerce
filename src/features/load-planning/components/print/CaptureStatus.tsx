import { Loader2 } from "lucide-react";

import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import type { PrintImageState } from "./usePrintImages";

const L = LOAD_PLAN_PRINT_LABELS;

/** Tiến độ dựng ảnh 3D; lỗi (thường là không có WebGL) cho thử lại hoặc xem phiếu không ảnh. */
export function CaptureStatus({
  state,
  onRetry,
  onSkip,
}: {
  state: PrintImageState;
  onRetry: () => void;
  onSkip: () => void;
}) {
  if (state.status === "error") {
    return (
      <Alert tone="danger" title={L.captureFailed}>
        <div className="flex gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {L.retry}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onSkip}>
            {L.printWithoutImages}
          </Button>
        </div>
      </Alert>
    );
  }
  if (state.status !== "capturing") return null;
  return (
    <div role="status" className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-4">
      <p className="text-ink-primary flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {L.capturing(state.done, state.total)}
      </p>
      <progress
        className="h-2 w-full"
        max={state.total}
        value={state.done}
        aria-label={L.capturing(state.done, state.total)}
      />
      <p className="text-ink-tertiary text-xs">{L.capturingHint}</p>
    </div>
  );
}
