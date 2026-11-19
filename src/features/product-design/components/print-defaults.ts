/**
 * The defaults of a print configuration that the `.glb` cannot tell: seam, rim, material, margins, top fold, handle,
 * and a bag's glue flap and bottom fold. Prefilled from the constants (or the stored configuration), edited under
 * "Nâng cao", validated here.
 */
import { z } from "zod";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import {
  BAG_SHEET_LIMITS,
  PRINT_CONFIG_LIMITS,
  PRINT_TEMPLATE_DEFAULTS,
} from "@/constants/numbers";

import { defaultBottomFoldMm } from "../bag-sheet";
import { DEFAULT_MODEL_DEFAULTS } from "../model3d/measure-types";
import { bagModelSchema, cupModelSchema } from "../model3d/model-types";
import { formatMm } from "./format-mm";

import type { BagModel, CupModel } from "../model3d/model-types";
import type { PrintConfigDto } from "../types";

export type ModelKind = "parametric-cup" | "parametric-bag";

const V = PRINT_CONFIG_SCREEN_LABELS.advanced.validation;
const figure = z.number({ error: V.number }).min(0, { error: V.notNegative });

/** The fold is added on top of the face height (see `withDefaults`), so it has no upper limit of its own. */
export const printDefaultsSchema = z.object({
  safeMarginMm: figure,
  bleedMm: figure.max(PRINT_CONFIG_LIMITS.bleedMaxMm, {
    error: V.bleedMax(PRINT_CONFIG_LIMITS.bleedMaxMm),
  }),
  seamMm: figure,
  rimMm: figure,
  cupMaterial: cupModelSchema.shape.material,
  bagMaterial: bagModelSchema.shape.material,
  handle: bagModelSchema.shape.handle,
  topFoldMm: figure,
  // BE `PrintConfigRules.requireBag` (origin/develop 3672ffb7): `0 ≤ glueFlapMm ≤ 100`.
  glueFlapMm: figure.max(BAG_SHEET_LIMITS.glueFlapMaxMm, {
    error: V.glueFlapMax(BAG_SHEET_LIMITS.glueFlapMaxMm),
  }),
  bottomFoldMm: figure,
});

export type PrintDefaultsValues = z.infer<typeof printDefaultsSchema>;

/**
 * The form's schema for a bag of `gussetMm` (the file's, or the stored model's): BE `PrintConfigRules.requireBag`
 * (origin/develop 3672ffb7) also refuses `bottomFoldMm > gussetMm`, compared as sent, unrounded. `null` (a cup, or a
 * bag not sized yet) leaves the gusset rule out.
 */
export function printDefaultsSchemaFor(gussetMm: number | null) {
  if (gussetMm === null) return printDefaultsSchema;
  return printDefaultsSchema.refine((d) => d.bottomFoldMm <= gussetMm, {
    path: ["bottomFoldMm"],
    error: V.bottomFoldMax(formatMm(gussetMm)),
  });
}

/** The gusset the bottom fold is checked against: the measured model's, else the stored one's; `null` for a cup. */
export const gussetOf = (model: CupModel | BagModel | null | undefined): number | null =>
  model?.kind === "parametric-bag" ? model.gussetMm : null;

/**
 * The values of the form for a kind: from the stored configuration if it is of that kind, else the constants. A bag
 * without a glue flap or bottom fold (new, or stored before them) takes the BE's defaults (`BagModel.withDefaults`):
 * 20 mm, and `round2(0.6 × gusset)` of the `measured` file's gusset, else the stored one's.
 */
export function defaultsFor(
  kind: ModelKind,
  stored: PrintConfigDto | null,
  measured: CupModel | BagModel | null = null,
): PrintDefaultsValues {
  const same = stored?.model?.kind === kind ? stored : null;
  const area = same?.printAreas[0];
  const fallback = PRINT_TEMPLATE_DEFAULTS[kind === "parametric-cup" ? "cup" : "bag"];
  const model = same?.model;
  const cup = model?.kind === "parametric-cup" ? model : null;
  const bag = model?.kind === "parametric-bag" ? model : null;
  return {
    safeMarginMm: area?.safeMarginMm ?? fallback.safeMarginMm,
    bleedMm: area?.bleedMm ?? fallback.bleedMm,
    seamMm: cup?.seamMm ?? DEFAULT_MODEL_DEFAULTS.seamMm,
    rimMm: cup?.rimMm ?? DEFAULT_MODEL_DEFAULTS.rimMm,
    cupMaterial: cup?.material ?? DEFAULT_MODEL_DEFAULTS.cupMaterial,
    bagMaterial: bag?.material ?? DEFAULT_MODEL_DEFAULTS.bagMaterial,
    handle: bag?.handle ?? DEFAULT_MODEL_DEFAULTS.handle,
    topFoldMm: bag?.topFoldMm ?? 0,
    glueFlapMm: bag?.glueFlapMm ?? BAG_SHEET_LIMITS.glueFlapDefaultMm,
    bottomFoldMm:
      bag?.bottomFoldMm ?? defaultBottomFoldMm(gussetOf(measured) ?? bag?.gussetMm ?? 0),
  };
}
