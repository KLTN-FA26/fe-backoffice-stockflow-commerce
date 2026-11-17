// Split from stockflow-storefront src/features/product-design/engine/model3d/print-uv.ts
// (the triangle helpers: facing outward, cutting at the cup's seam).
import { Vector3 } from "three";

export const TAU = Math.PI * 2;

/** A triangle corner in world space. */
export type Corner = { p: Vector3; n: Vector3 };
/** A corner with the cup's axis angle it takes (0 or 2π on the seam cut). */
export type AngledCorner = Corner & { alpha: number };

/** Triangles thinner than this (mm²) left by a cut are dropped. */
const MIN_AREA_MM2 = 1e-6;

/**
 * The element at `index`; throws when there is none. The storefront reads these with `!`, which
 * would fail later with a TypeError on `undefined`: here it fails at once with a clear message.
 */
export function at<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`The print mesh has no element at index ${index}`);
  return item;
}

const areaOf = (a: Vector3, b: Vector3, c: Vector3) =>
  new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).length() / 2;

/**
 * Makes a triangle wind outward (swapping two corners when it faces inward) and its normals agree
 * (negating those that point inward). `outward` is the direction the surface faces at the
 * triangle; a triangle with no direction or no area is left alone.
 */
export function faceOutward(
  tri: [Corner, Corner, Corner],
  outward: Vector3 | null,
): [Corner, Corner, Corner] {
  if (!outward) return tri;
  const [a, b, c] = tri;
  const geometric = new Vector3().subVectors(b.p, a.p).cross(new Vector3().subVectors(c.p, a.p));
  const [first, second, third] = geometric.dot(outward) < 0 ? [a, c, b] : [a, b, c];
  const fix = (corner: Corner): Corner =>
    corner.n.dot(outward) < 0 ? { p: corner.p, n: corner.n.clone().negate() } : corner;
  return [fix(first), fix(second), fix(third)];
}

/** `atan2(-x, -z)` in [0, 2π): 0 at −Z (where the cup's seam is), π at +Z, growing towards +X seen from the front. */
export function axisAngle(p: Vector3): number {
  const alpha = Math.atan2(-p.x, -p.z);
  return alpha < 0 ? alpha + TAU : alpha;
}

/**
 * The cup triangle as one or two angled triangles. One that crosses the seam half-plane (x = 0,
 * z < 0, where α is 0 and 2π) is cut there: the part with small α keeps α and its cut corners take
 * 0, the part with α just below 2π takes 2π on its cut corners, so both map inside the printed
 * width. A corner exactly on the seam joins the side of its triangle.
 */
export function splitAtSeam(tri: readonly Corner[]): AngledCorner[][] {
  const alphas = tri.map((c) => axisAngle(c.p));
  const max = Math.max(...alphas);
  const corners = tri.map((c, i): AngledCorner => ({ ...c, alpha: at(alphas, i) }));
  if (max - Math.min(...alphas) <= Math.PI) return [corners];

  const low = alphas.map((alpha) => alpha < max - Math.PI);
  // Signed distance to the seam plane, never on the wrong side of it for its own region.
  const side = (i: number) => {
    const { x } = at(tri, i).p;
    return low[i] ? Math.min(x, 0) : Math.max(x, 0);
  };
  const cut = (i: number, j: number, alpha: number): AngledCorner => {
    const [da, db] = [side(i), side(j)];
    const t = da === db ? 0 : Math.min(1, Math.max(0, da / (da - db)));
    const [a, b] = [at(tri, i), at(tri, j)];
    const n = a.n.clone().lerp(b.n, t);
    return {
      p: a.p.clone().lerp(b.p, t),
      n: n.lengthSq() > 0 ? n.normalize() : a.n.clone(),
      alpha,
    };
  };

  return [true, false].flatMap((isLow) => {
    const polygon: AngledCorner[] = [];
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      if (low[i] === isLow) polygon.push(at(corners, i));
      if (low[i] !== low[j]) polygon.push(cut(i, j, isLow ? 0 : TAU));
    }
    const [anchor] = polygon;
    if (anchor === undefined) return [];
    const fan = polygon
      .slice(1, -1)
      .map((corner, k): [AngledCorner, AngledCorner, AngledCorner] => [
        anchor,
        corner,
        at(polygon, k + 2),
      ]);
    return fan.filter(([a, b, c]) => areaOf(a.p, b.p, c.p) > MIN_AREA_MM2);
  });
}
