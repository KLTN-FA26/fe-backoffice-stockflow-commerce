// Ported from stockflow-storefront src/features/product-design/engine/model3d/template-from-model.ts
import { MODEL3D_TEMPLATE_LABELS } from "@/constants/labels-model3d";
import { PRINT_TEMPLATE_DEFAULTS } from "@/constants/numbers";

import { cupSector, isCylindricalCup, trimBoundsOf } from "./cup-sector";
import { BAG_CODES, round2 } from "./measure-types";

import type {
  BagModel,
  CupModel,
  CustomizationTemplate,
  PrintArea,
  PrintAreaCode,
} from "./model-types";

/** What a measured model cannot tell: margins and file rules (spec 2026-11-13 print-config §6). */
export type TemplateDefaults = {
  cup: { safeMarginMm: number; bleedMm: number; maxColors: number | null };
  bag: { safeMarginMm: number; bleedMm: number; maxColors: number | null };
  minDpi: number;
  allowedFileFormats: string[];
  maxFileSizeMb: number;
  colorMode: CustomizationTemplate["colorMode"];
};

/**
 * The figures the design mock uses (bleed 2-3 mm, safe margin 3-5 mm; B34: 300 dpi, PNG/JPG,
 * 50 MB). Real values come from the printer; the convention document leaves them open.
 */
export const DEFAULT_TEMPLATE_DEFAULTS: TemplateDefaults = {
  cup: { ...PRINT_TEMPLATE_DEFAULTS.cup },
  bag: { ...PRINT_TEMPLATE_DEFAULTS.bag },
  minDpi: PRINT_TEMPLATE_DEFAULTS.minDpi,
  allowedFileFormats: ["image/png", "image/jpeg"],
  maxFileSizeMb: PRINT_TEMPLATE_DEFAULTS.maxFileSizeMb,
  colorMode: "CMYK",
};

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

function cupArea(model: CupModel, margins: TemplateDefaults["cup"]): PrintArea {
  const { safeMarginMm, bleedMm } = margins;
  const base = {
    code: "BODY" as const,
    name: MODEL3D_TEMPLATE_LABELS.cupBody,
    xMm: 0,
    yMm: 0,
    safeMarginMm,
    bleedMm,
    uvMapping: { meshPart: "body" },
  };
  const sector = isCylindricalCup(model) ? null : cupSector(model);
  const shape: PrintArea["shape"] = sector
    ? {
        type: "annular-sector",
        innerRadiusMm: round2(sector.trimInnerMm),
        outerRadiusMm: round2(sector.trimOuterMm),
        sweepRad: round5(sector.sweepRad),
        seamMm: model.seamMm,
      }
    : { type: "rect" };
  // The box is the trim's bounding box (the mock's templates carry it so), i.e. the surface
  // without its bleed ring.
  const trim = trimBoundsOf(model);
  return {
    ...base,
    widthMm: round2(trim.width),
    heightMm: round2(trim.height),
    shape,
  };
}

function bagAreas(
  model: BagModel,
  printMeshes: readonly { printAreaCode: PrintAreaCode }[],
  margins: TemplateDefaults["bag"],
): PrintArea[] {
  const present = new Set(printMeshes.map((mesh) => mesh.printAreaCode));
  const printableMm = model.heightMm - model.topFoldMm;
  return BAG_CODES.filter((code) => present.has(code)).map((code) => ({
    code,
    name: MODEL3D_TEMPLATE_LABELS.faces[code],
    xMm: 0,
    yMm: 0,
    widthMm: code === "FRONT" || code === "BACK" ? model.widthMm : model.gussetMm,
    heightMm: printableMm,
    safeMarginMm: margins.safeMarginMm,
    bleedMm: margins.bleedMm,
    shape: { type: "rect" as const },
    uvMapping: { meshPart: code.toLowerCase() },
  }));
}

/**
 * A full template (print areas, margins, file rules) for a measured model, so the page can draw
 * the 2D mould and drive the viewer before any back-office screen exists. A cup gets its one
 * `BODY` area, derived from the measured numbers the way the engine derives it; a bag gets a rect
 * for each face the file has (`printMeshes`). The result passes `customizationTemplateSchema`.
 */
export function templateFromModel(
  model: CupModel | BagModel,
  printMeshes: readonly { printAreaCode: PrintAreaCode }[],
  defaults: Partial<TemplateDefaults> = {},
): CustomizationTemplate {
  const rules = { ...DEFAULT_TEMPLATE_DEFAULTS, ...defaults };
  const margins = model.kind === "parametric-cup" ? rules.cup : rules.bag;
  const printAreas =
    model.kind === "parametric-cup"
      ? [cupArea(model, rules.cup)]
      : bagAreas(model, printMeshes, rules.bag);
  if (printAreas.length === 0) throw new Error("A bag template needs at least one printed face");
  return {
    templateId: "tpl-model-check",
    code: "MODEL-CHECK",
    name: MODEL3D_TEMPLATE_LABELS.templateName,
    sku: "MODEL-CHECK",
    minDpi: rules.minDpi,
    allowedFileFormats: [...rules.allowedFileFormats],
    maxFileSizeMb: rules.maxFileSizeMb,
    colorMode: rules.colorMode,
    maxColors: margins.maxColors,
    allowedFontCodes: null,
    model,
    printAreas,
  };
}
