/**
 * From what the screen holds (a measurement of a chosen file, or the stored configuration; the defaults the person
 * confirmed) to the input of `savePrintConfig`. Pure. The measured figures are never changed here: only the defaults
 * (seam, rim, material, top fold, glue flap, bottom fold, handle, margins) are applied on top of them.
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
  const template = templateFromModel(model, areas, {
    // A stored configuration keeps its file rules; a new one takes the convention's defaults.
    ...(stored
      ? {
          minDpi: stored.minDpi,
          colorMode: stored.colorMode,
          allowedFileFormats: stored.allowedFileFormats,
          maxFileSizeMb: stored.maxFileSizeMb,
        }
      : {}),
    cup: { ...margins, maxColors: stored ? stored.maxColors : null },
    bag: { ...margins, maxColors: stored ? stored.maxColors : 4 },
  });
  return { base, model, template };
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
  // Faces with their own margins keep them, unless the person typed a value of their own (one that is not the first
  // area's, which is what the form shows).
  const margin = (code: PrintAreaCode, field: "safeMarginMm" | "bleedMm", value: number) => {
    const areas = kept?.printAreas;
    if (!areas || areas[0]?.[field] !== value) return value;
    return areas.find((area) => area.code === code)?.[field] ?? value;
  };
  return {
    config: {
      code: kept?.code ?? fresh.code,
      name: kept?.name ?? fresh.name,
      minDpi: template.minDpi,
      colorMode: template.colorMode,
      allowedFileFormats: template.allowedFileFormats,
      maxFileSizeMb: template.maxFileSizeMb,
      maxColors: template.maxColors,
      allowedFontCodes: stored?.allowedFontCodes ?? null,
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
