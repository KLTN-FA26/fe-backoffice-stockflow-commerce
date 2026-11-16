// Ported from stockflow-storefront src/features/product-design/engine/model3d/measure-bag.ts
import { Vector3 } from "three";

import { MODEL3D_LIMITS } from "@/constants/numbers";

import { issueMessages, type ModelIssue, modelIssue } from "./issues";
import {
  BAG_CODES,
  type BagCode,
  type FaceShape,
  type ModelDefaults,
  round2,
} from "./measure-types";
import { mostlyInward } from "./measure-winding";

import type { BagModel } from "./model-types";

const { bagHeightRangeMm: BAG_HEIGHT_RANGE_MM, shapeToleranceMm: SHAPE_TOLERANCE_MM } =
  MODEL3D_LIMITS;

/** The direction each face must look in (the front is +Z). */
const OUTWARD: Record<BagCode, Vector3> = {
  FRONT: new Vector3(0, 0, 1),
  BACK: new Vector3(0, 0, -1),
  RIGHT: new Vector3(1, 0, 0),
  LEFT: new Vector3(-1, 0, 0),
};

export type FaceInput = { name: string; points: Vector3[]; triangles: ArrayLike<number> };

function range(values: number[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

/** FRONT/BACK lie in a plane of constant z, LEFT/RIGHT in a plane of constant x; each is a rectangle. */
function measureFace(
  code: BagCode,
  { name, points }: FaceInput,
): { shape: FaceShape | null; issue: ModelIssue | null } {
  const alongZ = code === "FRONT" || code === "BACK";
  const fail = (issue: ModelIssue) => ({ shape: null, issue });

  const [n0, n1] = range(points.map((p) => (alongZ ? p.z : p.x)));
  if (n1 - n0 > SHAPE_TOLERANCE_MM) {
    return fail(modelIssue("NOT_PLANAR", issueMessages.notPlanar(name, n1 - n0), name));
  }

  const flat = points.map((p) => ({ a: alongZ ? p.x : p.z, y: p.y }));
  const [a0, a1] = range(flat.map((q) => q.a));
  const [y0, y1] = range(flat.map((q) => q.y));
  const near = (v: number, edge: number) => Math.abs(v - edge) <= SHAPE_TOLERANCE_MM;
  // A flat face with vertices inside (loop cuts) is still a rectangle: what makes it one is a
  // vertex at each of the four corners of its bounding box (and, below, a real width and height).
  const hasCorner = (a: number, y: number) => flat.some((q) => near(q.a, a) && near(q.y, y));
  const cornered = hasCorner(a0, y0) && hasCorner(a0, y1) && hasCorner(a1, y0) && hasCorner(a1, y1);
  const height = y1 - y0;
  const [minH, maxH] = BAG_HEIGHT_RANGE_MM;
  // sizes in metres read as millimetres are a units problem, whatever the face looks like
  if (cornered && (height < minH || height > maxH)) {
    return fail(
      modelIssue("BAD_UNITS", issueMessages.badUnits(name, height, BAG_HEIGHT_RANGE_MM), name),
    );
  }
  if (!cornered || a1 - a0 <= SHAPE_TOLERANCE_MM || height <= SHAPE_TOLERANCE_MM) {
    return fail(modelIssue("NOT_RECTANGULAR", issueMessages.notRectangular(name), name));
  }
  return {
    shape: {
      kind: "face",
      widthMm: round2(a1 - a0),
      heightMm: round2(height),
      bottomYMm: round2(y0),
      offsetMm: round2((n0 + n1) / 2),
      centreMm: round2((a0 + a1) / 2),
    },
    issue: null,
  };
}

export type BagAnalysis = {
  /** one entry per face given; null when that face failed its own checks */
  shapes: Partial<Record<BagCode, FaceShape | null>>;
  model: BagModel | null;
  issues: ModelIssue[];
};

export function measureBag(
  faces: Partial<Record<BagCode, FaceInput>>,
  defaults: ModelDefaults,
): BagAnalysis {
  const issues: ModelIssue[] = [];
  const shapes: BagAnalysis["shapes"] = {};
  for (const code of BAG_CODES) {
    const face = faces[code];
    if (!face) continue;
    const { shape, issue } = measureFace(code, face);
    shapes[code] = shape;
    if (issue) issues.push(issue);
    if (shape && mostlyInward(face.points, face.triangles, () => OUTWARD[code])) {
      issues.push(modelIssue("FACES_INWARD", issueMessages.facesInward(face.name), face.name));
    }
  }
  if (issues.some((i) => i.level === "error")) return { shapes, model: null, issues };

  // the front face looks towards +z; BACK is only checked when FRONT is absent
  if (shapes.FRONT && shapes.FRONT.offsetMm <= 0) {
    const name = faces.FRONT?.name ?? "print:FRONT";
    issues.push(modelIssue("NOT_FACING_FRONT", issueMessages.notFacingFront(name), name));
  } else if (!shapes.FRONT && shapes.BACK && shapes.BACK.offsetMm >= 0) {
    const name = faces.BACK?.name ?? "print:BACK";
    issues.push(modelIssue("NOT_FACING_FRONT", issueMessages.notFacingFront(name), name));
  }

  const widthFace = shapes.FRONT ?? shapes.BACK;
  const sideCode: BagCode | null = shapes.LEFT ? "LEFT" : shapes.RIGHT ? "RIGHT" : null;
  const side = sideCode ? shapes[sideCode] : null;
  const planes =
    shapes.FRONT && shapes.BACK ? Math.abs(shapes.FRONT.offsetMm - shapes.BACK.offsetMm) : null;

  let gusset: number | null = null;
  if (side) {
    gusset = side.widthMm;
    if (planes !== null && Math.abs(planes - side.widthMm) > SHAPE_TOLERANCE_MM) {
      const name = (sideCode && faces[sideCode]?.name) || "print:LEFT";
      issues.push(
        modelIssue(
          "GUSSET_MISMATCH",
          issueMessages.gussetMismatch(name, side.widthMm, planes),
          name,
        ),
      );
    }
  } else if (planes !== null) {
    gusset = round2(planes);
  }

  if (!widthFace || gusset === null || gusset <= 0) {
    issues.push(modelIssue("BAG_MODEL_INCOMPLETE", issueMessages.bagIncomplete()));
    return { shapes, model: null, issues };
  }

  return {
    shapes,
    model: {
      kind: "parametric-bag",
      widthMm: widthFace.widthMm,
      gussetMm: gusset,
      heightMm: widthFace.heightMm,
      topFoldMm: 0,
      handle: defaults.handle,
      material: defaults.bagMaterial,
    },
    issues,
  };
}
