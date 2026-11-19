/**
 * Print configuration (BE "customization template") of a variant: what the back end returns, and what the
 * screen sends when saving. DTO layer `PrintConfigDto`, input layer `PrintConfigSaveInput` (api-conventions).
 * Shape: BE `CustomizationTemplateResponse` / `CustomizationTemplateRequest` (origin/develop d47ed4ae).
 */
import { z } from "zod";

import { PRINT_CONFIG_SCHEMA_MESSAGES as M } from "@/constants/labels-print-config";
import { MODEL3D_LIMITS, PRINT_CONFIG_LIMITS as LIMITS } from "@/constants/numbers";

import { measuredChanged } from "./measured";
import { measuredFaults } from "./print-config-rules";
import {
  incompleteSurfaces,
  looseSurfaceFaults,
  sameSurfaces,
  surfaceFaultMessage,
} from "./surfaces";
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
 * BE `CustomizationTemplateResponse.Model3d`: always present, `{ hasFile, fileName?, fileChecksum?, surfaces[] }`, with
 * no URL (the stored file is read through `GET …/model-file/download-url`). `application.yml` has
 * `default-property-inclusion: non_null`, so `fileName` and `fileChecksum` are absent without a file; every optional
 * field accepts absent and null and normalises to null. `fileChecksum` is the SHA-256 the BE computed of the stored bytes.
 */
export const model3dSchema = z.object({
  hasFile: z.boolean(),
  fileName: nullable(z.string()),
  fileChecksum: nullable(z.string().regex(LIMITS.checksumPattern)),
  surfaces: z.array(surfaceSchema),
});

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
  model3d: model3dSchema,
});

/** `GET …/model-file/download-url` (BE `DownloadLink`): a short-lived link to the stored `.glb`. */
export const downloadLinkSchema = z.object({
  url: z.string().min(1),
  expiresAt: nullable(z.string()),
});

const printAreaInputSchema = z.object({
  code: printAreaCodeSchema,
  name: z.string().min(1).max(LIMITS.nameMaxLength),
  safeMarginMm: z.number().min(0).max(LIMITS.safeMarginMaxMm),
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
    // BE `PrintConfigRules.requireCup` / `requireBag`: the figures the file determines. No input fixes them.
    for (const { key, message } of measuredFaults(config.model)) {
      ctx.addIssue({ code: "custom", path: ["model", key], message });
    }
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
    // BE `requireSurfaces` (422 PRINT_CONFIG_SURFACES_INVALID, every save): each row a print area of the model, once.
    // The complete table (every area, on its `print:<code>` mesh) is the save's rule: it holds only with a file.
    for (const fault of looseSurfaceFaults(codes, config.surfaces)) {
      const path = fault.kind === "missing" ? ["surfaces"] : ["surfaces", fault.index];
      ctx.addIssue({ code: "custom", path, message: surfaceFaultMessage(fault) });
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

/** What the screen knows of the saved configuration it started from: what a save may not change without a file. */
export const storedPrintConfigSchema = printConfigDtoSchema
  .pick({ templateId: true, version: true, model: true })
  .extend({ hasFile: z.boolean(), surfaces: z.array(surfaceSchema) });

/**
 * The rules of `CustomizationTemplateController` / `PrintConfigService` (origin/develop d47ed4ae), checked before
 * anything is sent so that a save the BE is bound to refuse is never sent:
 *  - a create carries its file (else 409 PRINT_CONFIG_MODEL_FILE_REQUIRED);
 *  - a save without a new file keeps every value the file determines and the area ↔ mesh table (`ModelFileRules`,
 *    compared in hundredths of a millimetre; else 409 PRINT_CONFIG_MODEL_FILE_REQUIRED);
 *  - with a file, stored or sent, every print area has exactly one row, on the mesh `print:<code>` (else 422
 *    PRINT_CONFIG_SURFACES_INVALID). A template without a file takes free edits with its table as it is.
 */
export const printConfigSaveInputSchema = z
  .object({
    config: printConfigBodySchema,
    /** `null` when the variant has no configuration yet (create). */
    stored: storedPrintConfigSchema.nullable(),
    /** The file the figures were measured on: the exact bytes, sent in the same request as the template. */
    file: modelFileSchema.optional(),
  })
  .superRefine((input, ctx) => {
    const { stored, config, file } = input;
    if (!stored && !file) {
      ctx.addIssue({ code: "custom", path: ["file"], message: M.fileRequiredToCreate });
    }
    if (stored && !file) {
      const changed =
        measuredChanged(stored.model, config.model) ||
        !sameSurfaces(stored.surfaces, config.surfaces);
      if (changed) ctx.addIssue({ code: "custom", path: ["file"], message: M.modelFileRequired });
    }
    if (file || stored?.hasFile) {
      const codes = config.printAreas.map((area) => area.code);
      for (const fault of incompleteSurfaces(codes, config.surfaces)) {
        const path =
          fault.kind === "missing" ? ["surfaces"] : ["surfaces", fault.index, "meshName"];
        ctx.addIssue({ code: "custom", path, message: surfaceFaultMessage(fault) });
      }
    }
  });
