// Ported from stockflow-storefront src/features/product-design/engine/model3d/measure-cup.ts
import { Vector3 } from "three";

import { MODEL3D_MEASURE_DETAILS } from "@/constants/labels-model3d";
import { MODEL3D_LIMITS } from "@/constants/numbers";

import { issueMessages, type ModelIssue, modelIssue } from "./issues";
import { type BandShape, type ModelDefaults, round2 } from "./measure-types";
import { angularIntervals, mostlyInward, widestHoleDeg } from "./measure-winding";

import type { CupModel } from "./model-types";

const {
  // Vertices this close in height belong to the same ring (mm).
  ringToleranceMm: RING_TOLERANCE_MM,
  // A hole in the circle of triangles narrower than this (degrees) is ignored.
  holeToleranceDeg: HOLE_TOLERANCE_DEG,
  cupHeightRangeMm: CUP_HEIGHT_RANGE_MM,
  minBodyEdges: MIN_BODY_EDGES,
  shapeToleranceMm: SHAPE_TOLERANCE_MM,
} = MODEL3D_LIMITS;

type Ring = { radius: number };

function ringOf(points: Vector3[], keep: (p: Vector3) => boolean): Ring {
  let sum = 0;
  let count = 0;
  for (const p of points) {
    if (!keep(p)) continue;
    sum += Math.hypot(p.x, p.z);
    count += 1;
  }
  return { radius: count > 0 ? sum / count : 0 };
}

/** Distinct directions (to 0.1 degree) of the vertices of one ring. */
function ringDirections(points: Vector3[], keep: (p: Vector3) => boolean): number {
  const tenths = new Set<number>();
  for (const p of points) {
    if (!keep(p) || Math.hypot(p.x, p.z) < 1) continue;
    const deg = ((Math.atan2(p.x, p.z) * 180) / Math.PI + 360) % 360;
    tenths.add(Math.round(deg * 10) % 3600);
  }
  return tenths.size;
}

/**
 * The cup axis is the world Y axis through the origin: every vertex radius is measured from it and
 * compared with the cone between the top and bottom ring. The ring is closed when the triangles
 * cover the whole circle around the axis (a hole under 0.5 degrees is ignored); TOO_COARSE takes
 * the smaller number of distinct directions of the top ring and of the bottom ring. The unit check
 * uses `modelHeightMm` (the whole model, not the print band).
 */
export function measureCup(
  name: string,
  points: Vector3[],
  triangles: ArrayLike<number>,
  modelHeightMm?: number,
): { shape: BandShape | null; band: Band | null; issues: ModelIssue[] } {
  const issues: ModelIssue[] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const height = maxY - minY;

  const [minH, maxH] = CUP_HEIGHT_RANGE_MM;
  const unitsHeight = modelHeightMm ?? height;
  if (unitsHeight < minH || unitsHeight > maxH) {
    issues.push(
      modelIssue("BAD_UNITS", issueMessages.badUnits(name, unitsHeight, CUP_HEIGHT_RANGE_MM), name),
    );
  }
  if (height <= 0) return { shape: null, band: null, issues };

  const top = ringOf(points, (p) => p.y >= maxY - RING_TOLERANCE_MM);
  const bottom = ringOf(points, (p) => p.y <= minY + RING_TOLERANCE_MM);
  const radiusAt = (y: number) =>
    bottom.radius + ((top.radius - bottom.radius) * (y - minY)) / height;

  let deviation = 0;
  for (const p of points) {
    deviation = Math.max(deviation, Math.abs(Math.hypot(p.x, p.z) - radiusAt(p.y)));
  }
  const holeDeg = widestHoleDeg(angularIntervals(points, triangles), HOLE_TOLERANCE_DEG);
  const edges = Math.min(
    ringDirections(points, (p) => p.y >= maxY - RING_TOLERANCE_MM),
    ringDirections(points, (p) => p.y <= minY + RING_TOLERANCE_MM),
  );
  const details: string[] = [];
  if (deviation > SHAPE_TOLERANCE_MM)
    details.push(MODEL3D_MEASURE_DETAILS.coneDeviation(deviation));
  if (top.radius <= 0 || bottom.radius <= 0) details.push(MODEL3D_MEASURE_DETAILS.zeroRadius);
  if (holeDeg > 0) details.push(MODEL3D_MEASURE_DETAILS.ringHole(holeDeg));
  if (details.length > 0) {
    issues.push(
      modelIssue("NOT_REVOLVED", issueMessages.notRevolved(name, details.join(", ")), name),
    );
  }
  if (edges < MIN_BODY_EDGES) {
    issues.push(
      modelIssue("TOO_COARSE", issueMessages.tooCoarse(name, edges, MIN_BODY_EDGES), name),
    );
  }
  if (mostlyInward(points, triangles, (c) => new Vector3(c.x, 0, c.z))) {
    issues.push(modelIssue("FACES_INWARD", issueMessages.facesInward(name), name));
  }

  const failed = issues.some((i) => i.level === "error");
  return {
    band: failed
      ? null
      : {
          topDiameterMm: top.radius * 2,
          bottomDiameterMm: bottom.radius * 2,
          topYMm: maxY,
          bottomYMm: minY,
        },
    shape: failed
      ? null
      : {
          kind: "band",
          topDiameterMm: round2(top.radius * 2),
          bottomDiameterMm: round2(bottom.radius * 2),
          topYMm: round2(maxY),
          bottomYMm: round2(minY),
        },
    issues,
  };
}

/** The band's rings before rounding, so extending the cone does not compound rounding. */
export type Band = {
  topDiameterMm: number;
  bottomDiameterMm: number;
  topYMm: number;
  bottomYMm: number;
};

/**
 * The whole cup from the band: the cone through the band's two rings is extended to Y 0 and to the
 * highest Y of the model. The offsets invert `y = heightMm * (1 - v / slant)` of viewer3d/cup-mesh.ts
 * (v = distance along the slant from the rim). Null when the cone closes before the base or the rim.
 */
export function cupModelOf(
  band: Band,
  modelTopYMm: number,
  defaults: ModelDefaults,
): { model: CupModel | null; closes: "base" | "rim" | null } {
  const height = Math.max(modelTopYMm, band.topYMm);
  const slope = (band.topDiameterMm - band.bottomDiameterMm) / (band.topYMm - band.bottomYMm);
  const bottomDiameter = band.bottomDiameterMm - slope * band.bottomYMm;
  const topDiameter = band.topDiameterMm + slope * (height - band.topYMm);
  if (bottomDiameter <= 0) return { model: null, closes: "base" };
  if (topDiameter <= 0) return { model: null, closes: "rim" };
  const slant = Math.hypot(height, (topDiameter - bottomDiameter) / 2);
  return {
    closes: null,
    model: {
      kind: "parametric-cup",
      topDiameterMm: round2(topDiameter),
      bottomDiameterMm: round2(bottomDiameter),
      heightMm: round2(height),
      rimMm: defaults.rimMm,
      seamMm: defaults.seamMm,
      bandTopOffsetMm: round2(Math.max(0, slant * (1 - band.topYMm / height))),
      bandBottomOffsetMm: round2(Math.max(0, (slant * band.bottomYMm) / height)),
      material: defaults.cupMaterial,
    },
  };
}
