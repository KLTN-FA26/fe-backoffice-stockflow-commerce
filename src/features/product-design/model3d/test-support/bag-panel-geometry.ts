// Test helper, not shipped code. Ported from stockflow-storefront
// src/features/product-design/engine/viewer3d/bag-mesh.ts (`buildBagGeometry`, reduced to its `panels`:
// the printed faces, the meshes the print-uv tests compare against).
import { BufferGeometry, Float32BufferAttribute } from "three";

import type { BagModel } from "../model-types";
import type { PrintSurface, SurfaceSet } from "../surface-types";

type FaceCode = "FRONT" | "BACK" | "LEFT" | "RIGHT";

/** How far a gusset's centre crease is pushed in, as a fraction of the gusset depth. */
const CREASE_DEPTH_RATIO = 0.1;

/** A vertical strip of wall between two plan points; `s0`/`s1` are its share of the face width. */
type Segment = { x0: number; z0: number; x1: number; z1: number; s0: number; s1: number };

/**
 * Plan outline of a face, listed so the print reads left to right seen from outside: the front
 * runs towards +X, the right face towards −Z, the back towards −X, the left face towards +Z.
 * Gusset faces pass through a crease point pushed in from the box.
 */
function segmentsOf(code: FaceCode, model: BagModel): Segment[] {
  const [hw, hg] = [model.widthMm / 2, model.gussetMm / 2];
  const dent = model.gussetMm * CREASE_DEPTH_RATIO;
  const outline: Record<FaceCode, [number, number][]> = {
    FRONT: [
      [-hw, hg],
      [hw, hg],
    ],
    RIGHT: [
      [hw, hg],
      [hw - dent, 0],
      [hw, -hg],
    ],
    BACK: [
      [hw, -hg],
      [-hw, -hg],
    ],
    LEFT: [
      [-hw, -hg],
      [-hw + dent, 0],
      [-hw, hg],
    ],
  };
  const points = outline[code];
  return points.flatMap(([x0, z0], k) => {
    const next = points[k + 1];
    if (!next) return [];
    const [s0, s1] = [k / (points.length - 1), (k + 1) / (points.length - 1)];
    return [{ x0, z0, x1: next[0], z1: next[1], s0, s1 }];
  });
}

/**
 * One quad per segment between heights `yBottom` and `yTop`, each with its own four vertices so
 * a crease stays sharp. `uvAt(s, t)` gives the texture coordinate at share `s` of the face width
 * and `t` down the height (0 = top, 1 = bottom).
 */
function quadsGeometry(
  segments: readonly Segment[],
  yBottom: number,
  yTop: number,
  uvAt: (s: number, t: number) => [number, number],
): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const { x0, z0, x1, z1, s0, s1 } of segments) {
    const first = positions.length / 3;
    // Outward normal = along × up (the run is left to right seen from outside).
    const length = Math.hypot(x1 - x0, z1 - z0);
    const normal = [-(z1 - z0) / length, 0, (x1 - x0) / length];
    // Vertices a (top left), b (bottom left), c (top right), d (bottom right).
    const corners: [x: number, y: number, z: number, s: number, t: number][] = [
      [x0, yTop, z0, s0, 0],
      [x0, yBottom, z0, s0, 1],
      [x1, yTop, z1, s1, 0],
      [x1, yBottom, z1, s1, 1],
    ];
    for (const [x, y, z, s, t] of corners) {
      positions.push(x, y, z);
      normals.push(...normal);
      uvs.push(...uvAt(s, t));
    }
    indices.push(first, first + 1, first + 2, first + 1, first + 3, first + 2);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

const plainUv = (s: number, t: number): [number, number] => [s, 1 - t];

/** Maps the face's trim box (u across, v down) into the surface's dieline texture. */
function dielineUv(surface: PrintSurface): (s: number, t: number) => [number, number] {
  const [u0, u1] = surface.uRange;
  const [v0, v1] = surface.vRange;
  return (s, t) => {
    const flat = surface.toFlat(u0 + (u1 - u0) * s, v0 + (v1 - v0) * t);
    return surface.uvOf(flat.x, flat.y);
  };
}

/**
 * The bag's printed faces (scene units = mm, base at y = 0, front faces +Z, width along X and
 * gusset depth along Z). Each panel's UVs map its trim box into its surface's dieline texture
 * through `uvOf`.
 */
export function buildBagGeometry(
  model: BagModel,
  surfaces: SurfaceSet,
): { panels: Record<FaceCode, BufferGeometry> } {
  const panelHeight = model.heightMm - model.topFoldMm;

  const panelFor = (code: FaceCode) => {
    const surface = surfaces.byCode[code];
    return quadsGeometry(
      segmentsOf(code, model),
      0,
      panelHeight,
      surface ? dielineUv(surface) : plainUv,
    );
  };

  return {
    panels: {
      FRONT: panelFor("FRONT"),
      BACK: panelFor("BACK"),
      LEFT: panelFor("LEFT"),
      RIGHT: panelFor("RIGHT"),
    },
  };
}
