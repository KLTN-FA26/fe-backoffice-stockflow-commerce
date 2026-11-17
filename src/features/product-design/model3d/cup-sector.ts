// Ported from stockflow-storefront src/features/product-design/engine/surfaces/cup.ts
// (`cupSector`, `isCylindricalCup`), plus `sectorBounds` / `boundsOf` of engine/geometry.
import { MODEL3D_LIMITS } from "@/constants/numbers";

import type { CupModel } from "./model-types";
import type { RectMm } from "./surface-types";

/**
 * The cup body (a truncated cone) unrolled into an annular sector (spec §4.3). Radii are measured
 * from the cone's apex: `outer`/`inner` are the rim and base edges, `trim*` the printable band.
 */
export type CupSector = {
  slantMm: number;
  outerRadiusMm: number;
  innerRadiusMm: number;
  sweepRad: number;
  midRadiusMm: number;
  trimOuterMm: number;
  trimInnerMm: number;
  /** Angle of the glue flap past `+sweepRad / 2`, measured at the trim's inner radius. */
  seamRad: number;
};

export function isCylindricalCup(model: CupModel): boolean {
  return (model.topDiameterMm - model.bottomDiameterMm) / 2 < MODEL3D_LIMITS.cylinderTaperMm;
}

/** The wall's length from rim to base: the `slantMm` of `createCupSurface` in the storefront's `surfaces/cup.ts`. */
export function cupSlantMm(model: CupModel): number {
  return Math.hypot(model.heightMm, (model.topDiameterMm - model.bottomDiameterMm) / 2);
}

/** A near-straight wall unrolled: a rect of the top circumference plus the seam, by the slant less the two band offsets. */
export function straightBandOf(model: CupModel): { widthMm: number; heightMm: number } {
  return {
    widthMm: Math.PI * model.topDiameterMm + model.seamMm,
    heightMm: cupSlantMm(model) - model.bandTopOffsetMm - model.bandBottomOffsetMm,
  };
}

/** Width of the body's print at the surface, i.e. the `u` that α = 2π maps to (the glue flap lies beyond); `printedWidthMm` of the storefront's `viewer3d/cup-mesh.ts`. */
export function printedWidthMm(model: CupModel, surface: { kind: "rect" | "sector" }): number {
  if (surface.kind === "rect") return Math.PI * model.topDiameterMm;
  const sector = cupSector(model);
  return sector.sweepRad * sector.midRadiusMm;
}

export function cupSector(model: CupModel): CupSector {
  const rt = model.topDiameterMm / 2;
  const rb = model.bottomDiameterMm / 2;
  const slantMm = cupSlantMm(model);
  const outerRadiusMm = (rt * slantMm) / (rt - rb);
  const innerRadiusMm = outerRadiusMm - slantMm;
  const trimInnerMm = innerRadiusMm + model.bandBottomOffsetMm;
  return {
    slantMm,
    outerRadiusMm,
    innerRadiusMm,
    sweepRad: (2 * Math.PI * rt) / outerRadiusMm,
    midRadiusMm: (outerRadiusMm + innerRadiusMm) / 2,
    trimOuterMm: outerRadiusMm - model.bandTopOffsetMm,
    trimInnerMm,
    seamRad: model.seamMm / trimInnerMm,
  };
}

const QUARTER_TURN = Math.PI / 2;

/**
 * The exact flat bounding box of the annular sector about its apex between the two
 * `radii` and the angles `from` and `to` (0 = straight up, −y; `x = r·sin φ`, `y = −r·cos φ`). An
 * arc reaches its extremes only at its ends or at an axis angle (a multiple of π/2), and along a
 * ray x and y are linear in the radius, so the ends and the axis angles in range, each on both
 * radii, are all the points it needs.
 */
export function sectorBounds(radii: readonly [number, number], from: number, to: number): RectMm {
  const [lo, hi] = from <= to ? [from, to] : [to, from];
  const angles = [lo, hi];
  for (let k = Math.ceil(lo / QUARTER_TURN); k * QUARTER_TURN <= hi; k++) {
    angles.push(k * QUARTER_TURN);
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const phi of angles) {
    for (const r of radii) {
      const x = r * Math.sin(phi);
      const y = -r * Math.cos(phi);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * The size of the cup body's trim (the printed band without any bleed ring) once unrolled: what
 * `createCupSurface(model, area).flatBounds` is in the storefront for an area with bleed 0. A cone
 * is the box of its sector (trim radii, angles from `-sweep / 2` to `sweep / 2 + seamRad`); a
 * near-straight wall unrolls to a rect of the top circumference plus the seam, by the slant minus
 * the two band offsets.
 */
export function trimBoundsOf(model: CupModel): { width: number; height: number } {
  if (isCylindricalCup(model)) {
    const { widthMm, heightMm } = straightBandOf(model);
    return { width: widthMm, height: heightMm };
  }
  const s = cupSector(model);
  const { width, height } = sectorBounds(
    [s.trimOuterMm, s.trimInnerMm],
    -s.sweepRad / 2,
    s.sweepRad / 2 + s.seamRad,
  );
  return { width, height };
}

/**
 * `v` (distance from the rim along the slant) at the top and bottom edge of the printed band: the
 * `vRange` of the storefront's cup surface, which `templateDifferences` reads as `surface.vRange`.
 */
export function bandVRangeOf(model: CupModel): readonly [number, number] {
  if (isCylindricalCup(model)) {
    return [model.bandTopOffsetMm, model.bandTopOffsetMm + straightBandOf(model).heightMm];
  }
  const s = cupSector(model);
  return [s.outerRadiusMm - s.trimOuterMm, s.outerRadiusMm - s.trimInnerMm];
}
