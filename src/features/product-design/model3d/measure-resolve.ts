// Split from stockflow-storefront src/features/product-design/engine/model3d/measure.ts (print mesh resolution)
import type { Mesh, Object3D, Vector3 } from "three";

import { MODEL3D_MEASURE_DETAILS } from "@/constants/labels-model3d";

import { findPrintObjects } from "./find-print-meshes";
import { issueMessages, type ModelIssue, modelIssue } from "./issues";
import { printPoints } from "./measure-points";

import type { PrintShape } from "./measure-types";
import type { PrintAreaCode } from "./model-types";

export type PrintMeshInfo = {
  printAreaCode: PrintAreaCode;
  /** the author's name, e.g. `print:BODY` */
  meshName: string;
  /** the mesh itself; null when none could be resolved */
  mesh: Mesh | null;
  /** this mesh measured on its own; null when it failed its own checks */
  shape: PrintShape | null;
};

export type Measurable = { entry: PrintMeshInfo; points: Vector3[]; triangles: number[] };

/** Resolve every print object; the first of each code is the one that gets measured. */
export function resolvePrintMeshes(root: Object3D, issues: ModelIssue[]) {
  const printMeshes: PrintMeshInfo[] = [];
  const measurable = new Map<PrintAreaCode, Measurable>();
  const seen = new Set<PrintAreaCode>();
  const duplicated = new Set<PrintAreaCode>();
  for (const found of findPrintObjects(root)) {
    const { printAreaCode, name } = found;
    const entry: PrintMeshInfo = { printAreaCode, meshName: name, mesh: found.mesh, shape: null };
    printMeshes.push(entry);
    if (found.problem === "parent") {
      // not a print mesh itself: the print objects below it are measured as usual
      issues.push(modelIssue("INVALID_GEOMETRY", issueMessages.printOnParent(name), name));
      continue;
    }
    if (seen.has(printAreaCode)) {
      if (!duplicated.has(printAreaCode)) {
        duplicated.add(printAreaCode);
        issues.push(
          modelIssue("DUPLICATE_PRINT_MESH", issueMessages.duplicatePrintMesh(name), name),
        );
      }
      continue;
    }
    seen.add(printAreaCode);
    if (found.problem === "multi") {
      issues.push(modelIssue("MULTI_MATERIAL_PRINT_MESH", issueMessages.multiMaterial(name), name));
    } else if (!found.mesh) {
      issues.push(
        modelIssue(
          "INVALID_GEOMETRY",
          issueMessages.invalidGeometry(name, MODEL3D_MEASURE_DETAILS.noMesh),
          name,
        ),
      );
    } else {
      const result = printPoints(found.mesh);
      if ("problem" in result) {
        issues.push(
          modelIssue("INVALID_GEOMETRY", issueMessages.invalidGeometry(name, result.problem), name),
        );
      } else {
        measurable.set(printAreaCode, {
          entry,
          points: result.points,
          triangles: result.triangles,
        });
      }
    }
  }
  return { printMeshes, measurable };
}
