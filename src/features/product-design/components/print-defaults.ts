/**
 * The defaults of a print configuration that the `.glb` cannot tell: seam, rim, material, margins, top fold, handle.
 * Prefilled from the constants (or the stored configuration), edited under "Nâng cao", validated here.
 */
import { z } from "zod";

import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";
import { PRINT_CONFIG_LIMITS, PRINT_TEMPLATE_DEFAULTS } from "@/constants/numbers";

import { DEFAULT_MODEL_DEFAULTS } from "../model3d/measure-types";
import { bagModelSchema, cupModelSchema } from "../model3d/model-types";
import { geometryFaults } from "../print-config-rules";

import type { BagModel, CupModel } from "../model3d/model-types";
import type { PrintConfigDto } from "../types";

export type ModelKind = "parametric-cup" | "parametric-bag";

const V = PRINT_CONFIG_SCREEN_LABELS.advanced.validation;
const figure = z.number({ error: V.number }).min(0, { error: V.notNegative });
const upTo = (max: number) => figure.max(max, { error: V.atMost(max) });
const { modelFigureMaxMm } = PRINT_CONFIG_LIMITS;

/**
 * The limits of each value on its own (BE `PrintConfigRules`, origin/develop 3672ffb7): margins of an area
 * (`safeMarginMm` 0–500, `bleedMm` 0–20), a cup's seam (`MAX_SEAM_MM` 100) and rim, a bag's top fold
 * (`requireNonNegative`, at most 2000). The fold is added on top of the face height (see `withDefaults`): the height
 * that makes is checked with the model, by `printDefaultsSchemaFor`.
 */
export const printDefaultsSchema = z.object({
  safeMarginMm: upTo(PRINT_CONFIG_LIMITS.safeMarginMaxMm),
  bleedMm: figure.max(PRINT_CONFIG_LIMITS.bleedMaxMm, {
    error: V.bleedMax(PRINT_CONFIG_LIMITS.bleedMaxMm),
  }),
  seamMm: upTo(PRINT_CONFIG_LIMITS.seamMaxMm),
  rimMm: upTo(modelFigureMaxMm),
  cupMaterial: cupModelSchema.shape.material,
  bagMaterial: bagModelSchema.shape.material,
  handle: bagModelSchema.shape.handle,
  topFoldMm: upTo(modelFigureMaxMm),
});

export type PrintDefaultsValues = z.infer<typeof printDefaultsSchema>;

/**
 * The form's schema for the model in play (the chosen file's, else the stored one): the BE rules that need its sizes
 * (`geometryFaults`: the cup's seam and bleed against its unrolled band, the safe margin against each print area, a
 * bag's height with its fold), each on the field the BE names. `null` (no model yet) checks the values alone. Built
 * again on every render: react-hook-form validates with the latest resolver.
 */
export function printDefaultsSchemaFor(model: CupModel | BagModel | null) {
  if (!model) return printDefaultsSchema;
  return printDefaultsSchema.superRefine((values, ctx) => {
    for (const { field, message } of geometryFaults(model, values)) {
      ctx.addIssue({ code: "custom", path: [field], message });
    }
  });
}

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
