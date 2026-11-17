import {
  PRINT_CONFIG_ACTION_LABELS,
  PRINT_CONFIG_SCREEN_LABELS,
} from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;

/** Why saving is not possible now, in words (a blocked file, or nothing changed). */
export function PrintConfigSaveBar({
  canSave,
  saving,
  blockedReason,
  hint,
  error,
  onSave,
}: {
  canSave: boolean;
  saving: boolean;
  /** Errors in the file, or a bag that cannot be sized: shown as a danger alert. */
  blockedReason: string | null;
  /** What the save will do (new file, defaults only) or why there is nothing to save. */
  hint: string | null;
  /** The mapped sentence of a failed save. */
  error: string | null;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      {blockedReason && <Alert tone="danger">{blockedReason}</Alert>}
      {error && (
        <div role="alert">
          <Alert tone="danger" title={TEXT.save.failedTitle}>
            {error}
          </Alert>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={!canSave} onClick={onSave}>
          {saving ? TEXT.save.saving : PRINT_CONFIG_ACTION_LABELS.save}
        </Button>
        {hint && <p className="text-ink-tertiary text-xs">{hint}</p>}
      </div>
    </div>
  );
}
