/** The defaults as label / value rows for display (the figures the file cannot tell, to be confirmed). */
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { formatMm } from "./format-mm";

import type { ModelKind, PrintDefaultsValues } from "./print-defaults";

export interface ValueRow {
  readonly label: string;
  readonly value: string;
}

const ROWS = PRINT_CONFIG_SCREEN_LABELS.defaultRows;
const ADVANCED = PRINT_CONFIG_SCREEN_LABELS.advanced;

export function defaultRows(kind: ModelKind, d: PrintDefaultsValues): ValueRow[] {
  const margins = [
    { label: ROWS.safeMarginMm, value: formatMm(d.safeMarginMm) },
    { label: ROWS.bleedMm, value: formatMm(d.bleedMm) },
  ];
  if (kind === "parametric-cup") {
    return [
      { label: ROWS.seamMm, value: formatMm(d.seamMm) },
      { label: ROWS.rimMm, value: formatMm(d.rimMm) },
      { label: ROWS.cupMaterial, value: ADVANCED.cupMaterials[d.cupMaterial] },
      ...margins,
    ];
  }
  return [
    { label: ROWS.topFoldMm, value: formatMm(d.topFoldMm) },
    { label: ROWS.handle, value: ADVANCED.handles[d.handle] },
    { label: ROWS.bagMaterial, value: ADVANCED.bagMaterials[d.bagMaterial] },
    ...margins,
  ];
}
