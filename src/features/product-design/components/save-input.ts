/**
 * From what the screen holds (a measurement of a chosen file, or the stored configuration; the defaults the person
 * confirmed) to the input of `savePrintConfig`. Pure. The measured figures are never changed here: only the defaults
 * (seam, rim, material, top fold, glue flap, bottom fold, handle, margins) and the file rules are applied on top of them.
 */
import { PRINT_CONFIG_SCREEN_LABELS } from "@/constants/labels-print-config";

import { bagHeightFor } from "../measured";
import { storedOf } from "../selectors";
import { templateFromModel } from "../model3d/template-from-model";

import type { BagModel, CupModel, PrintAreaCode } from "../model3d/model-types";
import type { PrintConfigDto, PrintConfigSaveInput } from "../types";
import type { PrintDefaultsValues } from "./print-defaults";

/** The measured model and the print parts it was measured from (`measureModel` result, or the stored table). */
export interface ModelSource {
  model: CupModel | BagModel;
  printMeshes: readonly { printAreaCode: PrintAreaCode; meshName: string }[];
}

export interface ModelFileBytes {
  name: string;
  bytes: ArrayBuffer;
}

export interface BuildSaveArgs {
  /** The measurement of the file just chosen; `null` = keep the stored file and only change the defaults. */
  source: ModelSource | null;
  stored: PrintConfigDto | null;
  defaults: PrintDefaultsValues;
  /** The bytes that were measured, with the name of the file (never read from the `File` again). */
  file?: ModelFileBytes;
}

/**
 * The model with the confirmed defaults on it; the measured figures are kept as they are, so a save without a new file
 * sends them exactly as they were read (the BE refuses any change of them: `ModelFileRules`). A bag's `heightMm` is
 * the face height plus the top fold, so the print area (`heightMm - topFoldMm`) keeps the height of the face in the
 * file whatever fold is typed (`bagHeightFor`, in the BE's hundredths; the same fold keeps the height untouched).
 */
export function withDefaults(
  model: CupModel | BagModel,
  d: PrintDefaultsValues,
): CupModel | BagModel {
  return model.kind === "parametric-cup"
    ? { ...model, seamMm: d.seamMm, rimMm: d.rimMm, material: d.cupMaterial }
    : {
        ...model,
        heightMm: bagHeightFor(model, d.topFoldMm),
        topFoldMm: d.topFoldMm,
        glueFlapMm: d.glueFlapMm,
        bottomFoldMm: d.bottomFoldMm,
        handle: d.handle,
        material: d.bagMaterial,
      };
}

/**
 * The stored model and area table, as they were read, for a save without a new file. A configuration without a model
 * has nothing to keep (the BE would take any model as a change of kind): only a save with a file can follow.
 */
function sourceOfStored(stored: PrintConfigDto | null): ModelSource | null {
  if (!stored?.model) return null;
  return { model: stored.model, printMeshes: stored.model3d.surfaces };
}

/** The measured model with the confirmed defaults on it, and the template derived from it (margins, file rules). */
export function templateOfSource({ source, stored, defaults }: Omit<BuildSaveArgs, "file">) {
  const base = source ?? sourceOfStored(stored);
  if (!base) return null;
  const model = withDefaults(base.model, defaults);
  const margins = { safeMarginMm: defaults.safeMarginMm, bleedMm: defaults.bleedMm };
  // The print areas: a new file's faces; without one, the stored template's own areas, never its area ↔ mesh table,
  // which a template written before files were required has empty or partial (BE `model_surfaces_json` defaults to
  // `[]`, and `updateLocked` asks for a complete table only with a file).
  const areas = source
    ? source.printMeshes
    : (stored?.printAreas ?? []).map((area) => ({ printAreaCode: area.code }));
  if (model.kind === "parametric-bag" && areas.length === 0) return null; // no face to build a bag from
  // The file rules are the form's (what the person typed, prefilled from the stored configuration or the defaults),
  // never the stored values again: a save sends what the screen shows.
  const template = templateFromModel(model, areas, {
    minDpi: defaults.minDpi,
    colorMode: defaults.colorMode,
    allowedFileFormats: defaults.allowedFileFormats,
    maxFileSizeMb: defaults.maxFileSizeMb,
    cup: { ...margins, maxColors: defaults.maxColors },
    bag: { ...margins, maxColors: defaults.maxColors },
  });
  return { base, model, template };
}

/**
 * The margin an area is saved with. Faces with their own margins keep them, unless the person typed a value of their own
 * (one that is not the first area's, which is what the form shows). `kept`: the stored configuration of the same kind.
 */
export function keptAreaMargin(
  kept: PrintConfigDto | null,
  code: PrintAreaCode,
  field: "safeMarginMm" | "bleedMm",
  value: number,
): number {
  const areas = kept?.printAreas;
  if (!areas || areas[0]?.[field] !== value) return value;
  return areas.find((area) => area.code === code)?.[field] ?? value;
}

/** The safe margin each stored area is saved with, for the geometry check (BD-6: the BE checks each area's own). */
export function savedSafeMargins(
  stored: PrintConfigDto | null,
  model: CupModel | BagModel,
  typedMm: number,
): Partial<Record<PrintAreaCode, number>> {
  const kept = stored?.model?.kind === model.kind ? stored : null;
  const margins: Partial<Record<PrintAreaCode, number>> = {};
  for (const { code } of kept?.printAreas ?? []) {
    margins[code] = keptAreaMargin(kept, code, "safeMarginMm", typedMm);
  }
  return margins;
}

/** `null` when there is nothing to save: no measurement and no stored file. */
export function buildSaveInput({
  source,
  stored,
  defaults,
  file,
}: BuildSaveArgs): PrintConfigSaveInput | null {
  const derived = templateOfSource({ source, stored, defaults });
  if (!derived) return null;
  const { base, model, template } = derived;
  const names = PRINT_CONFIG_SCREEN_LABELS.newConfig;
  const fresh = model.kind === "parametric-cup" ? names.cup : names.bag;
  // A configuration of the other kind (a bag file over a cup) is a new thing: its code and name, not the old ones.
  const kept = stored?.model?.kind === model.kind ? stored : null;
  // One saved before models existed has no kind to clash with: it keeps its own code and name (the BE ignores
  // `code` on update and would take the new name, BD-13).
  const identity = kept ?? (stored && !stored.model ? stored : null);
  const margin = (code: PrintAreaCode, field: "safeMarginMm" | "bleedMm", value: number) =>
    keptAreaMargin(kept, code, field, value);
  return {
    config: {
      code: identity?.code ?? fresh.code,
      name: identity?.name ?? fresh.name,
      minDpi: template.minDpi,
      colorMode: template.colorMode,
      allowedFileFormats: template.allowedFileFormats,
      maxFileSizeMb: template.maxFileSizeMb,
      maxColors: template.maxColors,
      allowedFontCodes: defaults.allowedFontCodes,
      model,
      printAreas: template.printAreas.map(({ code, name, safeMarginMm, bleedMm }) => ({
        code,
        name,
        safeMarginMm: margin(code, "safeMarginMm", safeMarginMm),
        bleedMm: margin(code, "bleedMm", bleedMm),
      })),
      surfaces: base.printMeshes.map(({ printAreaCode, meshName }) => ({
        printAreaCode,
        meshName,
      })),
    },
    stored: stored ? storedOf(stored) : null,
    ...(file ? { file } : {}),
  };
}
