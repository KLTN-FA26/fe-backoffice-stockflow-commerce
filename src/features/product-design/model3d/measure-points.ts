// Ported from stockflow-storefront src/features/product-design/engine/model3d/measure-points.ts
import { type Mesh, Vector3 } from "three";

import { MODEL3D_MEASURE_DETAILS } from "@/constants/labels-model3d";

/** Triangles of a mesh; 0 for a mesh without a position attribute. */
export function triangleCount(mesh: Mesh): number {
  const { geometry } = mesh;
  const position = geometry.getAttribute("position");
  if (!position) return 0;
  return Math.floor((geometry.index ? geometry.index.count : position.count) / 3);
}

/** Highest world Y among the finite vertices of a mesh; -Infinity when there are none. */
export function highestWorldY(mesh: Mesh): number {
  const position = mesh.geometry.getAttribute("position");
  if (!position) return -Infinity;
  const v = new Vector3();
  let highest = -Infinity;
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (Number.isFinite(v.y) && v.y > highest) highest = v.y;
  }
  return highest;
}

/** Lowest world Y among the finite vertices of a mesh; Infinity when there are none. */
export function lowestWorldY(mesh: Mesh): number {
  const position = mesh.geometry.getAttribute("position");
  if (!position) return Infinity;
  const v = new Vector3();
  let lowest = Infinity;
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (Number.isFinite(v.y) && v.y < lowest) lowest = v.y;
  }
  return lowest;
}

export type PrintPoints = { points: Vector3[]; triangles: number[] } | { problem: string };

/** World-space vertices of a print mesh, or why the mesh cannot be measured. */
export function printPoints(mesh: Mesh): PrintPoints {
  const position = mesh.geometry.getAttribute("position");
  if (!position || position.count === 0) return { problem: MODEL3D_MEASURE_DETAILS.noVertices };
  if (triangleCount(mesh) === 0) return { problem: MODEL3D_MEASURE_DETAILS.noTriangles };
  const points: Vector3[] = [];
  for (let i = 0; i < position.count; i++) {
    const p = new Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      return { problem: MODEL3D_MEASURE_DETAILS.badCoordinates };
    }
    points.push(p);
  }
  const { index } = mesh.geometry;
  const triangles: number[] = [];
  const count = index ? index.count : position.count;
  for (let i = 0; i < count - (count % 3); i++) triangles.push(index ? index.getX(i) : i);
  return { points, triangles };
}
