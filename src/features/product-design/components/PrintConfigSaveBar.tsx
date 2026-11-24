import { Save } from "lucide-react";

import {
  PRINT_CONFIG_ACTION_LABELS,
  PRINT_CONFIG_SCREEN_LABELS,
} from "@/constants/labels-print-config";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;

/** `id` of the band's next-step sentence (`PrintConfigHeader` `hint`), which describes the save button. */
export const PRINT_CONFIG_SAVE_HINT_ID = "print-config-save-hint";

/**
 * The save in the page band: the submit button of the editor's form (the band is inside it; `form` names it as well).
 * What the save will do, or why there is nothing to save, is the band's status strip (`PrintConfigHeader` `hint`).
 */
export function PrintConfigSaveButton({
  formId,
  canSave,
  saving,
  hasHint = false,
}: {
  /** The `id` of the editor's `<form>`: the button submits it, as Enter in one of its fields does. */
  formId: string;
  canSave: boolean;
  saving: boolean;
  /** Whether the band shows a next-step sentence: it then describes the button for screen readers. */
  hasHint?: boolean;
}) {
  return (
    <Button
      type="submit"
      form={formId}
      disabled={!canSave}
      aria-describedby={hasHint ? PRINT_CONFIG_SAVE_HINT_ID : undefined}
      className="h-(--action-h) rounded-(--action-radius) px-(--action-px) text-[0.8125rem] font-medium"
    >
      <Save aria-hidden className="size-3.5" />
      {saving ? TEXT.save.saving : PRINT_CONFIG_ACTION_LABELS.save}
    </Button>
  );
}

/** Why the save cannot go through, under the page band: a blocked file or a bag that cannot be sized, or a failed save. */
export function PrintConfigSaveAlerts({
  blockedReason,
  error,
}: {
  /** Errors in the file, or a bag that cannot be sized: shown as a danger alert. */
  blockedReason: string | null;
  /** The mapped sentence of a failed save. */
  error: string | null;
}) {
  if (!blockedReason && !error) return null;
  return (
    <>
      {blockedReason && <Alert tone="danger">{blockedReason}</Alert>}
      {error && (
        <div role="alert">
          <Alert tone="danger" title={TEXT.save.failedTitle}>
            {error}
          </Alert>
        </div>
      )}
    </>
  );
}
