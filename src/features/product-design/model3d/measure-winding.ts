// Ported from stockflow-storefront src/features/product-design/engine/model3d/measure-winding.ts
import type { Vector3 } from "three";

/**
 * True when most of a surface, by triangle area, has its geometric normal (from the triangle
 * winding in world space, not the stored normals) pointing against `outwardAt`.
 */
export function mostlyInward(
  points: Vector3[],
  triangles: ArrayLike<number>,
  outwardAt: (centroid: Vector3) => Vector3,
): boolean {
  let inward = 0;
  let outward = 0;
  const e1 = points[0]?.clone();
  const e2 = points[0]?.clone();
  const centroid = points[0]?.clone();
  if (!e1 || !e2 || !centroid) return false;
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const a = points[triangles[i] ?? -1];
    const b = points[triangles[i + 1] ?? -1];
    const c = points[triangles[i + 2] ?? -1];
    if (!a || !b || !c) continue;
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    const normal = e1.cross(e2);
    centroid
      .copy(a)
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const area = normal.length() / 2;
    if (normal.dot(outwardAt(centroid)) < 0) inward += area;
    else outward += area;
  }
  return inward > outward;
}

const TAU_DEG = 360;

/**
 * The angular intervals (degrees, around the world Y axis) the triangles cover, as seen from the
 * axis. A triangle that crosses the -Z direction is unwrapped: its interval is the 360 degrees
 * minus the largest gap between its three directions.
 */
export function angularIntervals(
  points: Vector3[],
  triangles: ArrayLike<number>,
): [number, number][] {
  const intervals: [number, number][] = [];
  const dir = (p: Vector3) => (Math.atan2(p.x, p.z) * 180) / Math.PI;
  for (let i = 0; i + 2 < triangles.length; i += 3) {
    const ps = [triangles[i], triangles[i + 1], triangles[i + 2]].map((k) => points[k ?? -1]);
    if (ps.some((p) => !p || Math.hypot(p.x, p.z) < 1)) continue;
    const [s0 = 0, s1 = 0, s2 = 0] = ps.map((p) => (p ? dir(p) : 0)).sort((a, b) => a - b);
    const gaps = [s1 - s0, s2 - s1, s0 + TAU_DEG - s2];
    const k = gaps.indexOf(Math.max(...gaps));
    const start = [s1, s2, s0][k] ?? s0;
    const extent = TAU_DEG - (gaps[k] ?? 0);
    const from = ((start % TAU_DEG) + TAU_DEG) % TAU_DEG;
    if (from + extent > TAU_DEG) {
      intervals.push([from, TAU_DEG], [0, from + extent - TAU_DEG]);
    } else {
      intervals.push([from, from + extent]);
    }
  }
  return intervals;
}

/** The widest hole (degrees) left by the intervals around the full circle; 0 when covered. */
export function widestHoleDeg(intervals: [number, number][], toleranceDeg: number): number {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let cursor = 0;
  let widest = 0;
  for (const [from, to] of sorted) {
    if (from - cursor > toleranceDeg) widest = Math.max(widest, from - cursor);
    cursor = Math.max(cursor, to);
  }
  if (TAU_DEG - cursor > toleranceDeg) widest = Math.max(widest, TAU_DEG - cursor);
  return widest;
}
