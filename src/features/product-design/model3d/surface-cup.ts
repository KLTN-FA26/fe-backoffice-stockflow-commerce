// Ported from stockflow-storefront src/features/product-design/engine/surfaces/cup.ts
// (`createCupSurface`, the sector surface and `bleedBox`; `cupSector`, `isCylindricalCup` are in cup-sector.ts).
import {
  cupSector,
  isCylindricalCup,
  sectorBounds,
  straightBandOf,
  type CupSector,
} from "./cup-sector";
import { createRectSurface } from "./surface-rect";

import type { CupModel, PrintArea } from "./model-types";
import type { PathCmd, PointMm, PrintSurface, RectMm, SurfaceRegion } from "./surface-types";

/**
 * A region in polar form about the apex. At radius `R` it spans the angles
 * `[from + insetMm / R, to − insetMm / R]`, so a margin keeps a constant width along the radial
 * edges (a negative inset widens, as bleed does).
 */
type Band = { inner: number; outer: number; from: number; to: number; insetMm: number };

/** Sector angle `φ` (0 = straight up, −y) → `PathCmd` canvas arc angle (0 = +x, towards +y). */
const canvasAngle = (phi: number) => phi - Math.PI / 2;

/**
 * Bounding box of the bleed region relative to the apex (spec §4.3): bleed radii, trim angles
 * widened by `bleed / trimInner`.
 */
function bleedBox(s: CupSector, bleed: number): RectMm {
  const widen = bleed / s.trimInnerMm;
  return sectorBounds(
    [s.trimOuterMm + bleed, s.trimInnerMm - bleed],
    -s.sweepRad / 2 - widen,
    s.sweepRad / 2 + s.seamRad + widen,
  );
}

function createSectorSurface(area: PrintArea, s: CupSector): PrintSurface {
  const half = s.sweepRad / 2;
  const { bleedMm: bleed, safeMarginMm: safe } = area;
  const seamEnd = half + s.seamRad;
  const bands: Record<SurfaceRegion, Band> = {
    bleed: {
      inner: s.trimInnerMm - bleed,
      outer: s.trimOuterMm + bleed,
      from: -half,
      to: seamEnd,
      insetMm: -bleed,
    },
    trim: { inner: s.trimInnerMm, outer: s.trimOuterMm, from: -half, to: seamEnd, insetMm: 0 },
    // The safe area stops at the seam: the flap is hidden under the overlap.
    safe: {
      inner: s.trimInnerMm + safe,
      outer: s.trimOuterMm - safe,
      from: -half,
      to: half,
      insetMm: safe,
    },
  };

  // Apex placed so the bleed box starts at the flat origin.
  const box = bleedBox(s, bleed);
  const cx = -box.x;
  const cy = -box.y;
  const flatBounds: RectMm = { x: 0, y: 0, width: box.width, height: box.height };

  const at = (r: number, phi: number): PointMm => ({
    x: cx + r * Math.sin(phi),
    y: cy - r * Math.cos(phi),
  });
  const polar = (p: PointMm) => {
    const dx = p.x - cx;
    const dy = cy - p.y;
    return { r: Math.hypot(dx, dy), phi: Math.atan2(dx, dy) };
  };
  const inBand = (p: PointMm, band: Band) => {
    const { r, phi } = polar(p);
    if (r < band.inner || r > band.outer) return false;
    const margin = band.insetMm / r;
    return phi >= band.from + margin && phi <= band.to - margin;
  };
  const arc = (r: number, from: number, to: number, ccw: boolean): PathCmd => ({
    c: "A",
    cx,
    cy,
    r,
    start: canvasAngle(from),
    end: canvasAngle(to),
    ccw,
  });
  const outline = (region: SurfaceRegion): PathCmd[] => {
    const { inner, outer, from, to, insetMm } = bands[region];
    const [outerFrom, outerTo] = [from + insetMm / outer, to - insetMm / outer];
    const [innerFrom, innerTo] = [from + insetMm / inner, to - insetMm / inner];
    return [
      { c: "M", ...at(outer, outerFrom) },
      arc(outer, outerFrom, outerTo, false),
      { c: "L", ...at(inner, innerTo) },
      arc(inner, innerTo, innerFrom, true),
      { c: "Z" },
    ];
  };

  return {
    code: area.code,
    kind: "sector",
    flatBounds,
    uRange: [0, (s.sweepRad + s.seamRad) * s.midRadiusMm],
    vRange: [s.outerRadiusMm - s.trimOuterMm, s.outerRadiusMm - s.trimInnerMm],
    bleedMm: bleed,
    apexMm: { x: cx, y: cy },
    toFlat: (u, v) => {
      const phi = u / s.midRadiusMm - half;
      return { ...at(s.outerRadiusMm - v, phi), uprightRad: phi };
    },
    fromFlat: (x, y) => {
      const { r, phi } = polar({ x, y });
      return { u: (phi + half) * s.midRadiusMm, v: s.outerRadiusMm - r };
    },
    contains: (p, region) => inBand(p, bands[region]),
    inSeam: (p) => inBand(p, bands.trim) && polar(p).phi > half,
    outline,
    guides: () => [
      { kind: "bleed", path: outline("bleed") },
      { kind: "trim", path: outline("trim") },
      { kind: "safe", path: outline("safe") },
      {
        kind: "seam",
        path: [
          { c: "M", ...at(s.trimOuterMm, half) },
          { c: "L", ...at(s.trimInnerMm, half) },
        ],
      },
    ],
    uvOf: (x, y) => [x / flatBounds.width, 1 - y / flatBounds.height],
  };
}

/**
 * The cup body's print surface. `u` is arc length at the mid radius (front of the cup at the
 * centre), `v` the distance from the rim along the slant; a near-straight wall unrolls to a rect
 * of the top circumference plus the seam.
 */
export function createCupSurface(model: CupModel, area: PrintArea): PrintSurface {
  if (!isCylindricalCup(model)) return createSectorSurface(area, cupSector(model));

  const { widthMm, heightMm } = straightBandOf(model);
  return createRectSurface({
    code: area.code,
    widthMm,
    heightMm,
    bleedMm: area.bleedMm,
    safeMarginMm: area.safeMarginMm,
    vOffsetMm: model.bandTopOffsetMm,
    seamMm: model.seamMm,
    crease: false,
  });
}
