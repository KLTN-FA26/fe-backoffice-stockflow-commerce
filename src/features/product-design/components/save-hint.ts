/** The line under the save button: what a save would do now, or why there is nothing to save. Pure. */
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import type { ModelFileState } from "../selectors";

const TEXT = PRINT_CONFIG_SCREEN_LABELS.save;

export interface SaveHintArgs {
  saving: boolean;
  fileReady: boolean;
  result: { fileName: string } | null;
  defaultsOnly: boolean;
  fileState: ModelFileState | null;
  withoutFile: boolean;
}

export function saveHint(a: SaveHintArgs): string | null {
  if (a.saving) return null;
  if (a.fileReady && a.result) return TEXT.newFile(a.result.fileName);
  if (a.defaultsOnly) {
    return a.fileState?.kind === "no-file" ? TEXT.freeFieldsOnly : TEXT.defaultsOnly;
  }
  if (a.result === null) return a.withoutFile ? TEXT.nothingToSave : TEXT.fileNeeded;
  return null;
}
