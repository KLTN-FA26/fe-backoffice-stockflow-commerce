"use client";

import { useMemo } from "react";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { compareWithNominal } from "../model3d/issues";
import { fileDifferences, missingFaces } from "./file-differences";
import { parseNominal } from "./nominal";
import { withDefaults } from "./save-input";

import type { ModelIssue } from "../model3d/issues";
import type { NominalText } from "./nominal";
import type { PrintDefaultsValues } from "./print-defaults";
import type { MeasuredFile } from "./use-glb-reading";

const TEXT = PRINT_CONFIG_SCREEN_LABELS;

/**
 * What the chosen file is checked against: the manufacturer's figures the person typed, the model that will be saved
 * (the defaults applied) and the faces a bag still lacks; and the sentence that says why the file blocks a save.
 */
export function useFileChecks(
  result: MeasuredFile | null,
  nominalText: NominalText,
  defaults: PrintDefaultsValues,
) {
  const { nominal, invalid } = useMemo(() => parseNominal(nominalText), [nominalText]);
  const nominalIssues: ModelIssue[] = useMemo(
    () => (result?.model ? compareWithNominal(result.model, nominal) : []),
    [result, nominal],
  );
  const issues: ModelIssue[] = result
    ? [
        ...result.issues,
        ...nominalIssues,
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
  return { invalid, issues, blockedReason };
}
