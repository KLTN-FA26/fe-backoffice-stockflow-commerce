"use client";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { fileDifferences, missingFaces } from "./file-differences";
import { withDefaults } from "./save-input";

import type { ModelIssue } from "../model3d/issues";
import type { PrintDefaultsValues } from "./print-defaults";
import type { MeasuredFile } from "./use-glb-reading";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;

/**
 * What the chosen file is checked against: the model that will be saved (the defaults applied) and the faces a bag
 * still lacks; and the sentence that says why the file blocks a save.
 */
export function useFileChecks(
  result: MeasuredFile | null,
  defaults: PrintDefaultsValues,
) {
  const issues: ModelIssue[] = result
    ? [
        ...result.issues,
        ...missingFaces(result.model, result.parts),
        ...(result.model
          ? fileDifferences(withDefaults(result.model, defaults), result.parts)
          : []),
      ]
    : [];
  const blockedReason = !result
    ? null
    : issues.some((issue) => issue.level === "error")
      ? TEXT.issues.blockedByErrors
      : result.model === null
        ? TEXT.issues.bagIncomplete
        : null;
  return { issues, blockedReason };
}
