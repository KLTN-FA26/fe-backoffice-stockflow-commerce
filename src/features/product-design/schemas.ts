/**
 * Print configuration (BE "customization template") of a variant: what the back end returns, and what the
 * screen sends when saving. DTO layer `PrintConfigDto`, input layer `PrintConfigSaveInput` (api-conventions).
 * Shape: BE `CustomizationTemplateResponse` / `CustomizationTemplateRequest` (origin/develop) plus the fields
 * of requirements B-2, B-3 and B-6 (docs/superpowers/reports/2026-11-13-design-yeu-cau-bo-sung-cho-be.md).
 */
import { z } from "zod";

import { PRINT_CONFIG_SCHEMA_MESSAGES as M } from "@/constants/labels-print-config";
import { MODEL3D_LIMITS, PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";

import { measuredChanged } from "./measured";
import {
  bagModelSchema,
  cupModelSchema,
  gltfModelSchema,
  printAreaCodeSchema,
  printAreaSchema,
} from "./model3d/model-types";

const nullable = <T extends z.ZodType>(schema: T) => schema.nullish().transform((v) => v ?? null);

/** The measured model of a template: a cup or a bag (BE `ProductModelRequest`; the `gltf` kind is not a BE kind). */
export const printModelSchema = z.discriminatedUnion("kind", [cupModelSchema, bagModelSchema]);

/** One row of the area ↔ mesh table; the shape of the storefront's `gltfModelSchema.surfaces` (B-2). */
export const surfaceSchema = gltfModelSchema.shape.surfaces.element.extend({
  printAreaCode: printAreaCodeSchema,
  meshName: z.string().min(1).max(LIMITS.meshNameMaxLength),
});

/**
 * ASSUMPTION (yêu cầu BE B-2, B-3): the back-office response carries `model3d { url, surfaces }` (null without a
 * file) and, from B-6, `modelFileChecksum`. The BE omits nulls, so every optional field normalises to null.
 */
export const printConfigDtoSchema = z.object({
  templateId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  sku: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  minDpi: z.number().int().positive(),
  colorMode: z.enum(["RGB", "CMYK"]),
  allowedFileFormats: z.array(z.string().min(1)),
  maxFileSizeMb: z.number().int().positive(),
  maxColors: nullable(z.number().int().positive()),
  allowedFontCodes: nullable(z.array(z.string().min(1))),
  /** BE: `active` is the status; a template is created inactive. */
  active: z.boolean(),
  /** BE: absent for a template written before templates had a model. */
  model: nullable(printModelSchema),
  printAreas: z.array(printAreaSchema),
  referenceFileName: nullable(z.string()),
  version: z.number().int().nonnegative(),
  model3d: nullable(z.object({ url: z.string().min(1), surfaces: z.array(surfaceSchema) })),
  modelFileChecksum: nullable(z.string().regex(LIMITS.checksumPattern)),
});

const printAreaInputSchema = z.object({
  code: printAreaCodeSchema,
  name: z.string().min(1).max(LIMITS.nameMaxLength),
  safeMarginMm: z.number().nonnegative(),
  bleedMm: z.number().min(0).max(LIMITS.bleedMaxMm),
});

/** BE `CustomizationTemplateController.create`: the print areas of each kind of model. */
export const AREAS_OF = {
  "parametric-cup": ["BODY"],
  "parametric-bag": ["FRONT", "BACK", "LEFT", "RIGHT"],
} as const;

/** The template as the BE takes it: `CustomizationTemplateRequest` without `version`, plus the area ↔ mesh table. */
export const printConfigBodySchema = z
  .object({
    code: z.string().regex(LIMITS.codePattern),
    name: z.string().min(1).max(LIMITS.nameMaxLength),
    minDpi: z.number().int().min(LIMITS.minDpiRange[0]).max(LIMITS.minDpiRange[1]),
    colorMode: z.enum(["RGB", "CMYK"]),
    allowedFileFormats: z.array(z.string().min(1)).min(1),
    maxFileSizeMb: z
      .number()
      .int()
      .min(LIMITS.maxFileSizeMbRange[0])
      .max(LIMITS.maxFileSizeMbRange[1]),
    maxColors: z.number().int().positive().nullable(),
    allowedFontCodes: z.array(z.string().min(1)).nullable(),
    model: printModelSchema,
    printAreas: z.array(printAreaInputSchema).min(1),
    surfaces: z.array(surfaceSchema),
  })
  .superRefine((config, ctx) => {
    const codes: string[] = config.printAreas.map((area) => area.code);
    const expected: readonly string[] = AREAS_OF[config.model.kind];
    // BE `CustomizationTemplateController.create`: a cup has one area, a bag four, no missing and no extra.
    codes.forEach((code, i) => {
      if (codes.indexOf(code) !== i) {
        ctx.addIssue({ code: "custom", path: ["printAreas", i], message: M.areaTwice(code) });
      }
    });
    if (codes.length !== expected.length || expected.some((code) => !codes.includes(code))) {
      const message = config.model.kind === "parametric-cup" ? M.cupAreas : M.bagAreas;
      ctx.addIssue({ code: "custom", path: ["printAreas"], message });
    }
    const seen = new Set<string>();
    config.surfaces.forEach((surface, i) => {
      const path = ["surfaces", i];
      // B-2: each code at most one row, and a code the model has. Spec 2026-11-13-design-print-config-files-2d-3d:
      // the mesh of a print area is named `print:` + its code.
      if (seen.has(surface.printAreaCode)) {
        ctx.addIssue({ code: "custom", path, message: M.surfaceTwice(surface.printAreaCode) });
      }
      seen.add(surface.printAreaCode);
      if (!codes.includes(surface.printAreaCode)) {
        ctx.addIssue({ code: "custom", path, message: M.surfaceUnknown(surface.printAreaCode) });
      }
      if (surface.meshName !== `print:${surface.printAreaCode}`) {
        ctx.addIssue({
          code: "custom",
          path: [...path, "meshName"],
          message: M.meshName(surface.printAreaCode),
        });
      }
    });
    // Storefront `buildGlbScene`: every print area needs its mesh (else MESH_MISSING).
    for (const code of new Set(codes)) {
      if (!seen.has(code)) {
        ctx.addIssue({ code: "custom", path: ["surfaces"], message: M.surfaceMissing(code) });
      }
    }
  });

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  Object.prototype.toString.call(value) === "[object ArrayBuffer]";

/**
 * B-1: a `.glb`, at most 10 MB, as the exact bytes the screen measured (never a `File`, which a browser may read
 * again with different content).
 */
const modelFileSchema = z
  .object({ name: z.string(), bytes: z.custom<ArrayBuffer>(isArrayBuffer) })
  .superRefine((file, ctx) => {
    if (!file.name.toLowerCase().endsWith(LIMITS.modelFileExtension)) {
      ctx.addIssue({ code: "custom", message: M.fileExtension });
    }
    if (file.bytes.byteLength === 0) ctx.addIssue({ code: "custom", message: M.fileEmpty });
    if (file.bytes.byteLength > MODEL3D_LIMITS.maxFileBytes) {
      ctx.addIssue({
        code: "custom",
        message: M.fileTooLarge(MODEL3D_LIMITS.maxFileBytes / (1024 * 1024)),
      });
    }
  });

/** What the screen knows of the saved configuration it started from (the part B-6 needs). */
export const storedPrintConfigSchema = printConfigDtoSchema.pick({
  templateId: true,
  version: true,
  model: true,
  modelFileChecksum: true,
});

export const printConfigSaveInputSchema = z
  .object({
    config: printConfigBodySchema,
    /** `null` when the variant has no configuration yet (create). */
    stored: storedPrintConfigSchema.nullable(),
    /** The file the figures were measured on, sent in the same request as the configuration. */
    file: modelFileSchema.optional(),
    /**
     * SHA-256 (hex) of the file already stored, for a save without `file` (B-6). Ignored when `file` is present: the
     * checksum is then computed from `file.bytes`.
     */
    modelFileChecksum: z.string().regex(LIMITS.checksumPattern).optional(),
  })
  .superRefine((input, ctx) => {
    const { stored, config, file, modelFileChecksum } = input;
    // B-6: once a file is stored, changed measured figures need a new file, or the checksum of the stored one.
    if (
      stored?.modelFileChecksum &&
      stored.model &&
      measuredChanged(stored.model, config.model) &&
      !file &&
      modelFileChecksum !== stored.modelFileChecksum
    ) {
      ctx.addIssue({ code: "custom", path: ["file"], message: M.pairRequired });
    }
  });
