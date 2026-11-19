/**
 * The bag's flat sheet as the form would save it: the model and the print areas `buildSaveInput` derives from what
 * the screen holds, so the preview draws exactly what the save sends. Pure.
 */
import { bagSheet } from "../bag-sheet";
import { buildSaveInput } from "./save-input";

import type { BagSheet } from "../bag-sheet";
import type { BuildSaveArgs } from "./save-input";

/** `null` for a cup, a bag with nothing to draw it from, or a half-typed figure (not a number, or negative). */
export function sheetOfForm({
  source,
  stored,
  defaults,
}: Omit<BuildSaveArgs, "file">): BagSheet | null {
  const figures = [
    defaults.topFoldMm,
    defaults.glueFlapMm,
    defaults.bottomFoldMm,
    defaults.safeMarginMm,
    defaults.bleedMm,
  ];
  if (!figures.every((n) => Number.isFinite(n) && n >= 0)) return null;
  let input: ReturnType<typeof buildSaveInput>;
  try {
    input = buildSaveInput({ source, stored, defaults });
  } catch {
    return null; // the save reports why; the preview only has nothing to draw
  }
  const model = input?.config.model;
  if (model?.kind !== "parametric-bag") return null;
  const sheet = bagSheet(model, input?.config.printAreas ?? []);
  return sheet.printedHeightMm > 0 ? sheet : null;
}
