// Ported from stockflow-storefront src/features/product-design/engine/model3d/measure.ts
import { Mesh, type Object3D } from "three";

import { MODEL3D_LIMITS } from "@/constants/numbers";

import { findNearMissNames } from "./find-print-meshes";
import { issueMessages, type ModelIssue, modelIssue } from "./issues";
import { type FaceInput, measureBag } from "./measure-bag";
import { cupModelOf, measureCup } from "./measure-cup";
import { highestWorldY, lowestWorldY, triangleCount } from "./measure-points";
import { type PrintMeshInfo, resolvePrintMeshes } from "./measure-resolve";
import { BAG_CODES, DEFAULT_MODEL_DEFAULTS, type ModelDefaults } from "./measure-types";

import type { BagModel, CupModel } from "./model-types";

const {
  maxFileBytes: MAX_FILE_BYTES,
  maxTriangles: MAX_TRIANGLES,
  shapeToleranceMm: SHAPE_TOLERANCE_MM,
} = MODEL3D_LIMITS;

/**
 * Recognise, measure and check a model that is already loaded as a three object tree (spec §5).
 * Pure: no React, no WebGL, no loader. The geometry must already be in millimetres (the loader
 * scales the file from metres); world transforms are applied here. Never throws.
 */

export {
  DEFAULT_MODEL_DEFAULTS,
  type ModelDefaults,
  type BandShape,
  type FaceShape,
  type PrintShape,
} from "./measure-types";
export type { PrintMeshInfo } from "./measure-resolve";

export type ModelMeasurement = {
  kind: "cup" | "bag" | null;
  /**
   * For a cup, the WHOLE cup: heightMm is the highest world Y of all meshes (the base is Y 0), the
   * cone through the band's two rings is extended to Y 0 and to that height for the diameters, and
   * the band offsets are measured along the slant of the whole cup from rim and base. A body whose
   * cone closes before the base or the rim is INVALID_GEOMETRY. The band alone is each mesh's `shape`.
   * Any error-level issue means `model` is null. It can also be null with warnings only
   * (`BAG_MODEL_INCOMPLETE`: not enough faces to size the whole bag); the per-mesh `shape`s are
   * still filled in then.
   */
  model: CupModel | BagModel | null;
  printMeshes: PrintMeshInfo[];
  issues: ModelIssue[];
};

export function measureModel(
  root: Object3D,
  info: { byteLength?: number } = {},
  defaults: Partial<ModelDefaults> = {},
): ModelMeasurement {
  const settings: ModelDefaults = { ...DEFAULT_MODEL_DEFAULTS, ...defaults };
  root.updateMatrixWorld(true);

  const issues: ModelIssue[] = [];
  let triangles = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    triangles += triangleCount(object);
    minY = Math.min(minY, lowestWorldY(object));
    maxY = Math.max(maxY, highestWorldY(object));
  });
  if (info.byteLength !== undefined && info.byteLength > MAX_FILE_BYTES) {
    issues.push(
      modelIssue("FILE_TOO_LARGE", issueMessages.fileTooLarge(info.byteLength, MAX_FILE_BYTES)),
    );
  }
  if (triangles > MAX_TRIANGLES) {
    issues.push(
      modelIssue("TOO_MANY_TRIANGLES", issueMessages.tooManyTriangles(triangles, MAX_TRIANGLES)),
    );
  }

  const { printMeshes, measurable } = resolvePrintMeshes(root, issues);
  for (const miss of findNearMissNames(root)) {
    issues.push(
      modelIssue(
        "PRINT_NAME_NEAR_MISS",
        issueMessages.nameNearMiss(miss.name, miss.expected),
        miss.name,
      ),
    );
  }
  const present = new Set(printMeshes.map((m) => m.printAreaCode));
  const hasBody = present.has("BODY");
  const hasBag = BAG_CODES.some((code) => present.has(code));

  let kind: ModelMeasurement["kind"] = null;
  let model: CupModel | BagModel | null = null;
  if (hasBody && hasBag) {
    issues.push(modelIssue("MIXED_KINDS", issueMessages.mixedKinds()));
  } else if (!hasBody && !hasBag) {
    issues.push(modelIssue("NO_PRINT_MESH", issueMessages.noPrintMesh()));
  } else if (hasBody) {
    kind = "cup";
    const body = measurable.get("BODY");
    if (body) {
      const result = measureCup(
        body.entry.meshName,
        body.points,
        body.triangles,
        Number.isFinite(maxY - minY) ? maxY - minY : undefined,
      );
      issues.push(...result.issues);
      body.entry.shape = result.shape;
      if (result.band) {
        const whole = cupModelOf(result.band, maxY, settings);
        model = whole.model;
        if (whole.closes) {
          const name = body.entry.meshName;
          issues.push(
            modelIssue("INVALID_GEOMETRY", issueMessages.coneCloses(name, whole.closes), name),
          );
        }
      }
    }
  } else {
    kind = "bag";
    const faces: Partial<Record<(typeof BAG_CODES)[number], FaceInput>> = {};
    for (const code of BAG_CODES) {
      const face = measurable.get(code);
      if (face)
        faces[code] = {
          name: face.entry.meshName,
          points: face.points,
          triangles: face.triangles,
        };
    }
    // with no usable face the invalid meshes are already reported
    if (Object.keys(faces).length > 0) {
      const result = measureBag(faces, settings);
      issues.push(...result.issues);
      for (const code of BAG_CODES) {
        const face = measurable.get(code);
        if (face) face.entry.shape = result.shapes[code] ?? null;
      }
      model = result.model;
    }
  }

  const blocked = issues.some((i) => i.level === "error");
  if (!blocked && Number.isFinite(minY) && Math.abs(minY) > SHAPE_TOLERANCE_MM) {
    issues.push(modelIssue("BASE_NOT_AT_ZERO", issueMessages.baseNotAtZero(minY)));
  }
  return { kind, model: blocked ? null : model, printMeshes, issues };
}
