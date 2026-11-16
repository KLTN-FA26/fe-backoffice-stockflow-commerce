/**
 * The defaults of a print configuration that the `.glb` cannot tell: seam, rim, material, margins, top fold, handle.
 * Prefilled from the constants (or the stored configuration), edited under "Nâng cao", validated here.
 */
import { z } from "zod";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { PRINT_CONFIG_LIMITS, PRINT_TEMPLATE_DEFAULTS } from "@/constants/numbers";

import { DEFAULT_MODEL_DEFAULTS } from "../model3d/measure-types";
import { bagModelSchema, cupModelSchema } from "../model3d/model-types";

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
});

export type PrintDefaultsValues = z.infer<typeof printDefaultsSchema>;

/** The values of the form for a kind: from the stored configuration if it is of that kind, else the constants. */
export function defaultsFor(kind: ModelKind, stored: PrintConfigDto | null): PrintDefaultsValues {
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
  };
}
