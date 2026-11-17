// Ported from stockflow-storefront src/features/product-design/engine/model3d/print-uv.ts
// (the triangle helpers are in print-uv-seam.ts).
import { BufferGeometry, Float32BufferAttribute, Matrix3, type Mesh, Vector3 } from "three";

import { printedWidthMm } from "./cup-sector";
import { at, splitAtSeam, TAU, faceOutward } from "./print-uv-seam";

import type { BagModel, CupModel } from "./model-types";
import type { AngledCorner, Corner } from "./print-uv-seam";
import type { SurfaceTarget } from "./surface-types";

type Axis = "x" | "z";

/**
 * For each bag face: the plan axis its width runs along and whether `s` (0 = left seen from
 * outside) grows with that axis. Mirrors `segmentsOf` in `viewer3d/bag-mesh.ts`: the front runs
 * towards +X, the right face towards −Z, the back towards −X and the left face towards +Z.
 */
const BAG_FACES: Record<string, { axis: Axis; rising: boolean; outward: Vector3 }> = {
  FRONT: { axis: "x", rising: true, outward: new Vector3(0, 0, 1) },
  RIGHT: { axis: "z", rising: false, outward: new Vector3(1, 0, 0) },
  BACK: { axis: "x", rising: false, outward: new Vector3(0, 0, -1) },
  LEFT: { axis: "z", rising: true, outward: new Vector3(-1, 0, 0) },
};

/**
 * A print mesh from a loaded model, given the texture coordinates the studio needs: it ignores the
 * UVs of the file and computes them from each vertex's position with the same formula the
 * parametric meshes use (`buildCupGeometry` / `buildBagGeometry`), so the artwork lands where the
 * 2D dieline says.
 *
 * The mesh's world transform (`matrixWorld`, parents included) is applied, so the returned
 * geometry is in world space (mm after the loader's scaling): put it on a mesh with an identity
 * transform. The cup's axis is the world Y axis through the origin; its front faces +Z. The
 * result is non-indexed and has `position`, `normal` (the file's, or smooth ones computed when it
 * has none) and `uv`.
 *
 * The result always faces outward (away from the Y axis for a cup; FRONT +Z, BACK −Z, RIGHT +X,
 * LEFT −X for a bag): a triangle that winds inward, by the file or a mirrored parent, has two
 * corners swapped, and normals that point inward are negated. A cup triangle that crosses the seam
 * (x = 0, z < 0) is cut there into two, one ending at α = 0 and one at α = 2π, so no UV leaves
 * `[0, printed width]` and the whole strip appears on the model. Limit: a triangle spanning more
 * than π without touching the seam is not understood (a body needs at least a few sides).
 *
 * The UV is a function of the vertex's ABSOLUTE world position against the template `model`, never
 * of the mesh's own extent: a vertex at the same place gets the same UV as on the parametric mesh,
 * so a mesh shorter or longer than the band is not rescaled, and vertices outside the band map
 * outside the printed area (no clamping).
 *
 * Cup: `α = atan2(−x, −z)`, `v = slant · (1 − y / heightMm)` (the relation `wallAt` in
 * `cup-mesh.ts` inverts), then `uvOf(toFlat(α/2π · printed width, v))`. Bag: `s` across the face
 * and `t = (panelHeight − y) / panelHeight`, with the face spans of `segmentsOf` in `bag-mesh.ts`
 * (FRONT x from −w/2, RIGHT z falling from g/2, BACK x falling from w/2, LEFT z from −g/2), then
 * `uvOf(toFlat(u0 + (u1 − u0)s, v0 + (v1 − v0)t))`.
 */
export function printGeometry(
  mesh: Mesh,
  target: SurfaceTarget,
  model: CupModel | BagModel,
): BufferGeometry {
  const { code, surface } = target;
  const notFound = () => new Error(`Print area ${code} does not exist on a ${model.kind} model`);
  if (model.kind === "parametric-cup" && code !== "BODY") throw notFound();
  const bagFace = model.kind === "parametric-bag" ? (BAG_FACES[code] ?? null) : null;
  if (model.kind === "parametric-bag" && bagFace === null) throw notFound();

  const source = mesh.geometry;
  const positionAttr = source.getAttribute("position");
  if (!positionAttr || positionAttr.itemSize < 3) {
    throw new Error("The print mesh has no position attribute");
  }

  // Smooth normals for a file without them, computed in the mesh's own space before de-indexing.
  const withNormals = source.getAttribute("normal") ? source : source.clone();
  if (withNormals !== source) withNormals.computeVertexNormals();
  const normalAttr = withNormals.getAttribute("normal");

  mesh.updateWorldMatrix(true, false);
  const normalMatrix = new Matrix3().getNormalMatrix(mesh.matrixWorld);
  const world = Array.from({ length: positionAttr.count }, (_, i) =>
    new Vector3().fromBufferAttribute(positionAttr, i).applyMatrix4(mesh.matrixWorld),
  );
  const worldNormals = Array.from({ length: normalAttr.count }, (_, i) =>
    new Vector3().fromBufferAttribute(normalAttr, i).applyMatrix3(normalMatrix).normalize(),
  );

  const index = source.getIndex();
  const corners = index ? Array.from(index.array) : world.map((_, i) => i);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const toUv = (u: number, v: number) => {
    const flat = surface.toFlat(u, v);
    return surface.uvOf(flat.x, flat.y);
  };

  // The UV of a vertex, given the unwrapped axis angle when this is a cup. Always from the
  // vertex's absolute world position against the model, never from the mesh's own extent.
  let uvOfVertex: (p: Vector3, alpha: number) => [number, number];
  if (model.kind === "parametric-cup") {
    const widthMm = printedWidthMm(model, surface);
    const slantMm = Math.hypot(model.heightMm, (model.topDiameterMm - model.bottomDiameterMm) / 2);
    uvOfVertex = (p, alpha) => toUv((alpha / TAU) * widthMm, slantMm * (1 - p.y / model.heightMm));
  } else {
    if (bagFace === null) throw notFound();
    const { axis, rising } = bagFace;
    const [u0, u1] = surface.uRange;
    const [v0, v1] = surface.vRange;
    const [hw, hg] = [model.widthMm / 2, model.gussetMm / 2];
    const panelHeight = model.heightMm - model.topFoldMm;
    // Plan span of the face, as in `segmentsOf`: start and length along its axis.
    const span =
      axis === "x" ? { from: -hw, length: model.widthMm } : { from: -hg, length: model.gussetMm };
    uvOfVertex = (p) => {
      const along = (p[axis] - span.from) / span.length;
      const s = rising ? along : 1 - along;
      const t = (panelHeight - p.y) / panelHeight;
      return toUv(u0 + (u1 - u0) * s, v0 + (v1 - v0) * t);
    };
  }

  const cornerOf = (k: number): Corner => {
    const vertex = at(corners, k);
    return { p: at(world, vertex), n: at(worldNormals, vertex) };
  };
  const bagOutward = bagFace === null ? null : bagFace.outward;
  for (let k = 0; k + 2 < corners.length; k += 3) {
    const [a, b, c] = [cornerOf(k), cornerOf(k + 1), cornerOf(k + 2)];
    // A cup faces away from the Y axis at the triangle's centre; a bag face along its own direction.
    const centre = new Vector3(a.p.x + b.p.x + c.p.x, 0, a.p.z + b.p.z + c.p.z);
    const outward = bagOutward ?? (centre.lengthSq() > 1e-9 ? centre : null);
    const oriented = faceOutward([a, b, c], outward);
    const pieces: AngledCorner[][] =
      model.kind === "parametric-cup"
        ? splitAtSeam(oriented)
        : [oriented.map((corner) => ({ ...corner, alpha: 0 }))];
    for (const piece of pieces) {
      for (const { p, n, alpha } of piece) {
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
        uvs.push(...uvOfVertex(p, alpha));
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  return geometry;
}
