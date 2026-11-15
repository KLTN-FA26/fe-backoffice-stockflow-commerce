// Ported from stockflow-storefront src/features/product-design/engine/template/schema.ts
import { z } from "zod";

import { MODEL3D_LIMITS } from "@/constants/numbers";

import { cupSector, isCylindricalCup } from "./cup-sector";

/**
 * Customization template: mirrors `product.customization_templates` + `print_areas` (spec §4.1).
 * All lengths are millimetres. Field names are the back end's contract, kept identical.
 */

export const printAreaCodeSchema = z.enum(["BODY", "FRONT", "BACK", "LEFT", "RIGHT"]);

const lengthMm = z.number().positive();
const offsetMm = z.number().nonnegative();

export const cupModelSchema = z.object({
  kind: z.literal("parametric-cup"),
  topDiameterMm: lengthMm,
  bottomDiameterMm: lengthMm,
  heightMm: lengthMm,
  rimMm: offsetMm,
  seamMm: offsetMm,
  bandTopOffsetMm: offsetMm,
  bandBottomOffsetMm: offsetMm,
  material: z.enum(["paper-white", "kraft", "pet-clear"]),
});

export const bagModelSchema = z.object({
  kind: z.literal("parametric-bag"),
  widthMm: lengthMm,
  gussetMm: lengthMm,
  heightMm: lengthMm,
  topFoldMm: offsetMm,
  handle: z.enum(["twisted", "flat", "none"]),
  material: z.enum(["kraft-brown", "kraft-white"]),
});

/** glTF port: accepted by the contract but not enabled in v1. */
export const gltfModelSchema = z.object({
  kind: z.literal("gltf"),
  url: z.string().min(1),
  surfaces: z.array(z.object({ printAreaCode: z.string().min(1), meshName: z.string().min(1) })),
});

export const productModelSchema = z.discriminatedUnion("kind", [
  cupModelSchema,
  bagModelSchema,
  gltfModelSchema,
]);

/** `shape_json`: a cup's sector keeps a prepress copy of the trim values derived in §4.3. */
const printAreaShapeSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rect") }),
  z.object({
    type: z.literal("annular-sector"),
    innerRadiusMm: lengthMm,
    outerRadiusMm: lengthMm,
    sweepRad: z.number().positive(),
    seamMm: offsetMm,
  }),
]);

export const printAreaSchema = z.object({
  code: printAreaCodeSchema,
  name: z.string().min(1),
  /** Bounding box on the 2D template (BE columns), informational for the engine. */
  xMm: z.number(),
  yMm: z.number(),
  widthMm: lengthMm,
  heightMm: lengthMm,
  safeMarginMm: offsetMm,
  bleedMm: offsetMm,
  shape: printAreaShapeSchema,
  uvMapping: z.object({ meshPart: z.string().min(1) }),
});

function shapeMatchesCup(shape: PrintArea["shape"], model: CupModel): boolean {
  if (isCylindricalCup(model)) return shape.type === "rect";
  if (shape.type !== "annular-sector") return false;

  const sector = cupSector(model);
  const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;
  const { sectorRadiusToleranceMm: radiusTolerance, sectorSweepToleranceRad } = MODEL3D_LIMITS;
  return (
    near(shape.innerRadiusMm, sector.trimInnerMm, radiusTolerance) &&
    near(shape.outerRadiusMm, sector.trimOuterMm, radiusTolerance) &&
    near(shape.sweepRad, sector.sweepRad, sectorSweepToleranceRad) &&
    near(shape.seamMm, model.seamMm, radiusTolerance)
  );
}

export const customizationTemplateSchema = z
  .object({
    templateId: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
    /** The template hangs off the variant (BE decision D5). */
    sku: z.string().min(1),
    minDpi: z.number().positive(),
    colorMode: z.enum(["RGB", "CMYK"]),
    allowedFileFormats: z.array(z.string().min(1)),
    maxFileSizeMb: z.number().positive(),
    maxColors: z.number().int().positive().nullable(),
    /** `null` = every font in the FE registry. */
    allowedFontCodes: z.array(z.string().min(1)).nullable(),
    model: productModelSchema,
    printAreas: z.array(printAreaSchema).min(1),
  })
  // Spec §4.1: a cup's print shapes must agree with its parametric sector; bag faces are rects.
  .superRefine((template, ctx) => {
    const { model } = template;
    template.printAreas.forEach((area, i) => {
      const path = ["printAreas", i, "shape"];
      if (model.kind === "parametric-cup" && !shapeMatchesCup(area.shape, model)) {
        ctx.addIssue({
          code: "custom",
          path,
          message: `Print area ${area.code} does not match the cup geometry`,
        });
      }
      if (model.kind === "parametric-bag" && area.shape.type !== "rect") {
        ctx.addIssue({ code: "custom", path, message: `Print area ${area.code} must be a rect` });
      }
    });
  });

export type PrintAreaCode = z.infer<typeof printAreaCodeSchema>;
export type CupModel = z.infer<typeof cupModelSchema>;
export type BagModel = z.infer<typeof bagModelSchema>;
export type ProductModel = z.infer<typeof productModelSchema>;
export type PrintArea = z.infer<typeof printAreaSchema>;
export type CustomizationTemplate = z.infer<typeof customizationTemplateSchema>;
export type MaterialKind = CupModel["material"] | BagModel["material"];
