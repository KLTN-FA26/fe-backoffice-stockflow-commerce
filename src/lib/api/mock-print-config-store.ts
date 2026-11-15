/**
 * Kho mock của cấu hình in (BE `customization_templates` + `print_areas`) và file model `.glb` của nó.
 * Hình response theo BE `CustomizationTemplateResponse` cộng các trường BE chưa có:
 * ASSUMPTION (yêu cầu BE B-2, B-3, B-6) `model3d { url, surfaces }` và `modelFileChecksum`.
 * File giữ trong bộ nhớ; `url` là object URL của chính file vừa tải (hoặc `/mock/models/...` cho bản seed).
 * Một lần lưu là một request: số đo và file cùng vào kho, hoặc không gì vào (xem `mock-routes-print-configs.ts`).
 */
import { MODEL3D_LIMITS } from "@/constants/numbers";
// Only the pure formula module: the `model3d` entry would pull three.js into every page in mock mode.
import {
  cupSector,
  isCylindricalCup,
  trimBoundsOf,
} from "@/features/product-design/model3d/cup-sector";

import { seedTemplates } from "./mock-print-config-seed";

import type { PrintConfigDto, PrintSurface } from "@/features/product-design";
import type { PrintAreaCode } from "@/features/product-design/model3d/model-types";

export { SEED_PRINT_CONFIG_VARIANT } from "./mock-print-config-seed";

type Model = NonNullable<PrintConfigDto["model"]>;

export interface MockAreaInput {
  code: PrintAreaCode;
  name: string;
  safeMarginMm: number;
  bleedMm: number;
}

export interface MockModelFile {
  url: string;
  name: string;
  sizeBytes: number;
  checksum: string;
}

export interface MockPrintTemplate {
  templateId: string;
  productId: string;
  variantId: string;
  sku: string;
  code: string;
  name: string;
  minDpi: number;
  colorMode: "RGB" | "CMYK";
  allowedFileFormats: string[];
  maxFileSizeMb: number;
  maxColors: number | null;
  allowedFontCodes: string[] | null;
  active: boolean;
  model: Model;
  areas: MockAreaInput[];
  surfaces: PrintSurface[];
  file: MockModelFile | null;
  version: number;
}

const byVariant = new Map<string, MockPrintTemplate[]>();
let seeded = false;
let counter = 0;

export function resetPrintConfigMockStore(): void {
  byVariant.clear();
  seeded = false;
  counter = 0;
}

export const nextTemplateId = (): string => `tpl-mock-${++counter}`;

function seed(): void {
  if (seeded) return;
  seeded = true;
  for (const template of seedTemplates()) {
    byVariant.set(template.variantId, [...(byVariant.get(template.variantId) ?? []), template]);
  }
}

export function templatesOf(variantId: string): MockPrintTemplate[] {
  seed();
  return [...(byVariant.get(variantId) ?? [])].sort((a, b) => a.code.localeCompare(b.code));
}

export function saveTemplate(template: MockPrintTemplate): void {
  seed();
  const list = byVariant.get(template.variantId) ?? [];
  byVariant.set(template.variantId, [
    ...list.filter((t) => t.templateId !== template.templateId),
    template,
  ]);
}

/** BE computes each area's position and shape from the model; the mock does the same (cup: the trim's sector). */
function areaGeometry(model: Model, code: PrintAreaCode) {
  if (model.kind === "parametric-cup") {
    const { width, height } = trimBoundsOf(model);
    if (isCylindricalCup(model)) return { width, height, shape: { type: "rect" } as const };
    const s = cupSector(model);
    const shape = {
      type: "annular-sector",
      innerRadiusMm: s.trimInnerMm,
      outerRadiusMm: s.trimOuterMm,
      sweepRad: s.sweepRad,
      seamMm: model.seamMm,
    } as const;
    return { width, height, shape };
  }
  // ASSUMPTION (BE computes bag faces; this is the mock's own rule): front/back are width wide, sides gusset wide.
  const width = code === "LEFT" || code === "RIGHT" ? model.gussetMm : model.widthMm;
  return { width, height: model.heightMm - model.topFoldMm, shape: { type: "rect" } as const };
}

export function responseOf(t: MockPrintTemplate) {
  return {
    templateId: t.templateId,
    productId: t.productId,
    variantId: t.variantId,
    sku: t.sku,
    code: t.code,
    name: t.name,
    minDpi: t.minDpi,
    colorMode: t.colorMode,
    allowedFileFormats: t.allowedFileFormats,
    maxFileSizeMb: t.maxFileSizeMb,
    maxColors: t.maxColors,
    allowedFontCodes: t.allowedFontCodes,
    active: t.active,
    model: t.model,
    printAreas: t.areas.map((area) => {
      const { width, height, shape } = areaGeometry(t.model, area.code);
      return {
        code: area.code,
        name: area.name,
        xMm: 0,
        yMm: 0,
        widthMm: width,
        heightMm: height,
        safeMarginMm: area.safeMarginMm,
        bleedMm: area.bleedMm,
        shape,
        uvMapping: { meshPart: `print:${area.code}` },
      };
    }),
    version: t.version,
    model3d: t.file ? { url: t.file.url, surfaces: t.surfaces } : null,
    modelFileChecksum: t.file?.checksum ?? null,
  };
}

/** Mock-data units: the largest `.glb` the BE takes (B-1: 10 MB). */
export const MAX_MODEL_FILE_BYTES = MODEL3D_LIMITS.maxFileBytes;
