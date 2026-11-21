/**
 * Kho mock của cấu hình in (BE `customization_templates` + `print_areas`) và file model `.glb` của nó.
 * Hình response đúng BE `CustomizationTemplateResponse` (origin/develop d47ed4ae): `model3d` luôn có, là
 * `{ hasFile, fileName?, fileChecksum?, surfaces[] }`, không có `url`; `omitNulls` bỏ các trường rỗng như BE.
 * File giữ trong bộ nhớ; `url` (object URL của chính file vừa tải, hoặc `/mock/models/...` cho bản seed) chỉ ra ngoài
 * qua `GET …/model-file/download-url`. Số đo, bảng ghép và file vào kho trong cùng một request, như BE
 * (xem `mock-routes-print-configs.ts`).
 */
import { MODEL3D_LIMITS } from "@/constants/numbers";
// Only the pure formula module: the `model3d` entry would pull three.js into every page in mock mode.
import {
  cupSector,
  isCylindricalCup,
  trimBoundsOf,
} from "@/features/product-design/model3d/cup-sector";

import { withBagFlaps } from "./mock-print-config-bag";
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

/**
 * Test hook (the BE has none): the server keeps other bytes than it was sent, so its checksum differs from the measured
 * file's. Cleared by `resetPrintConfigMockStore`.
 */
export const printConfigMockFaults: { storeOtherBytes: boolean } = { storeOtherBytes: false };

/**
 * Test hook (the BE computes it): how many `PENDING_REVIEW` designs every template answers as `pendingReviewCount`.
 * Cleared by `resetPrintConfigMockStore`.
 */
export const printConfigMockPending: { count: number } = { count: 0 };

export function resetPrintConfigMockStore(): void {
  printConfigMockPending.count = 0;
  byVariant.clear();
  seeded = false;
  counter = 0;
  printConfigMockFaults.storeOtherBytes = false;
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
    // A bag stored before its glue flap and bottom fold is returned with the defaults, as the BE fills them.
    model: withBagFlaps(t.model),
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
    // ASSUMPTION: the mock has no separate print version; the lock's `version` stands in for it.
    printVersion: t.version,
    pendingReviewCount: printConfigMockPending.count,
    referenceFileName: null,
    model3d: {
      hasFile: t.file !== null,
      fileName: t.file?.name ?? null,
      fileChecksum: t.file?.checksum ?? null,
      surfaces: t.surfaces,
    },
  };
}

/** The largest `.glb` the BE takes (`FileCategory.PRINT_MODEL`: 10 MB). */
export const MAX_MODEL_FILE_BYTES = MODEL3D_LIMITS.maxFileBytes;
