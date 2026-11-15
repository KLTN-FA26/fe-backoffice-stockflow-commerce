/**
 * The file against the model that will be saved. `measureModel` reads each part on its own; where a bag stands, or a
 * cup's band, is only judged against the template the figures and the defaults give (`templateDifferences`). A
 * difference of more than 1 mm means the artwork would be drawn off its place in the 3D view, so it is an error.
 */
import { MODEL3D_MISMATCH_MESSAGES as TEXT } from "@/constants/labels-model3d";

import { templateDifferences } from "../model3d/compare-template";
import { bandVRangeOf } from "../model3d/cup-sector";
import { BAG_CODES } from "../model3d/measure-types";
import { modelIssue } from "../model3d/issues";

import type { ModelIssue } from "../model3d/issues";
import type { BagModel, CupModel } from "../model3d/model-types";
import type { PrintPart } from "./use-glb-reading";

export function fileDifferences(
  model: CupModel | BagModel,
  parts: readonly PrintPart[],
): ModelIssue[] {
  const isCup = model.kind === "parametric-cup";
  const vRange = isCup ? bandVRangeOf(model) : ([0, 0] as const);
  const hint = isCup ? TEXT.hint.cup : TEXT.hint.bag;
  return parts.flatMap(({ printAreaCode, meshName, shape }) =>
    templateDifferences({ code: printAreaCode, surface: { vRange }, shape }, model).map(
      (difference) =>
        // `INVALID_GEOMETRY`: the closest code of `issues.ts` (an error about the shape of a print mesh).
        modelIssue("INVALID_GEOMETRY", TEXT.mismatch(difference, hint), meshName),
    ),
  );
}

/** A bag whose file has some faces missing: the four faces are required (the save schema says so too). */
export function missingFaces(
  model: CupModel | BagModel | null,
  parts: readonly PrintPart[],
): ModelIssue[] {
  if (model?.kind !== "parametric-bag") return [];
  const present = new Set(parts.map((part) => part.printAreaCode));
  const missing = BAG_CODES.filter((code) => !present.has(code)).map((code) => `print:${code}`);
  return missing.length > 0 ? [modelIssue("INVALID_GEOMETRY", TEXT.missingFaces(missing))] : [];
}
