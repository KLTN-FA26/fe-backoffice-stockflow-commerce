// Ported from stockflow-storefront src/features/product-design/engine/model3d/compare-template.ts
import { MODEL3D_DIFFERENCE_MESSAGES as MESSAGES } from "@/constants/labels-model3d";

import { COMPARISON_TOLERANCE_MM } from "./issues";

import type { PrintShape } from "./measure-types";
import type { BagModel, CupModel, PrintAreaCode } from "./model-types";

/**
 * The print area a mesh carries the artwork of, and what of its surface the comparison reads. The
 * storefront passes its whole `PrintSurface` here; only `vRange` (`v` at the band's top and bottom
 * edge, distance from the rim along the slant) is read, and `bandVRangeOf` in `cup-sector.ts` gives
 * the same pair for a cup model.
 */
export type PrintTarget = { code: PrintAreaCode; surface: { vRange: readonly [number, number] } };

/** Exactly 1 mm off passes, float noise does not flip it. */
const TOLERANCE_MM = COMPARISON_TOLERANCE_MM + 1e-9;

/** The plane a bag face stands in (`segmentsOf` in `viewer3d/bag-mesh.ts`): FRONT z +g/2, BACK z -g/2, RIGHT x +w/2, LEFT x -w/2. */
function facePlane(code: PrintAreaCode, model: BagModel): number {
  switch (code) {
    case "FRONT":
      return model.gussetMm / 2;
    case "BACK":
      return -model.gussetMm / 2;
    case "RIGHT":
      return model.widthMm / 2;
    default:
      return -model.widthMm / 2;
  }
}

/**
 * The figures of one mapped mesh that differ from the template by more than 1 mm, at absolute
 * positions (never through `measurement.model`): a band against the template's printed band
 * (`surface.vRange` through `y = heightMm · (1 − v / slant)`, as `cup-mesh.ts` has it) and the cone
 * at those heights; a face against the template's face size, base and plane.
 */
export function templateDifferences(
  { code, surface, shape }: PrintTarget & { shape: PrintShape | null },
  model: CupModel | BagModel,
): string[] {
  const out: string[] = [];
  const check = (label: string, file: number, template: number) => {
    if (Math.abs(file - template) > TOLERANCE_MM) {
      out.push(MESSAGES.value(label, file, template));
    }
  };
  if (!shape) return out;

  if (model.kind === "parametric-cup") {
    if (shape.kind !== "band") return [MESSAGES.faceInsteadOfBand(code)];
    const slant = Math.hypot(model.heightMm, (model.topDiameterMm - model.bottomDiameterMm) / 2);
    const [vTop, vBottom] = surface.vRange;
    const yAtV = (v: number) => model.heightMm * (1 - v / slant);
    const [yTop, yBottom] = [yAtV(vTop), yAtV(vBottom)];
    const diameterAt = (y: number) =>
      model.bottomDiameterMm +
      ((model.topDiameterMm - model.bottomDiameterMm) * y) / model.heightMm;
    check(MESSAGES.bandTopY, shape.topYMm, yTop);
    check(MESSAGES.bandBottomY, shape.bottomYMm, yBottom);
    check(MESSAGES.bandTopDiameter, shape.topDiameterMm, diameterAt(yTop));
    check(MESSAGES.bandBottomDiameter, shape.bottomDiameterMm, diameterAt(yBottom));
    return out;
  }

  if (shape.kind !== "face") return [MESSAGES.bandInsteadOfFace(code)];
  const sideFace = code === "LEFT" || code === "RIGHT";
  check(MESSAGES.faceWidth(code), shape.widthMm, sideFace ? model.gussetMm : model.widthMm);
  check(MESSAGES.faceHeight(code), shape.heightMm, model.heightMm - model.topFoldMm);
  check(MESSAGES.faceBaseY(code), shape.bottomYMm, 0);
  check(MESSAGES.facePlane(code), shape.offsetMm, facePlane(code, model));
  // Where the face lies along its own width: `printGeometry` measures `s` from the template's
  // centre line, so a face shifted sideways would put the artwork off by the same amount.
  if (Math.abs(shape.centreMm) > TOLERANCE_MM) {
    out.push(MESSAGES.faceOffCentre(code, Math.abs(shape.centreMm), shape.centreMm));
  }
  return out;
}
