// Test helper, not shipped code. Ported from stockflow-storefront
// src/features/product-design/engine/viewer3d/cup-mesh.ts (`buildCupGeometry`, reduced to its `body`:
// the printed band, the one mesh the print-uv tests compare against) and viewer3d/pick.ts (`uvToSurfacePoint`).
import { BufferGeometry, Float32BufferAttribute } from "three";

import { printedWidthMm } from "../cup-sector";

import type { CupModel } from "../model-types";
import type { PrintSurface, SurfacePoint } from "../surface-types";

export type CupGeometryOptions = { radialSegments?: number; heightSegments?: number };

const DEFAULT_RADIAL_SEGMENTS = 128;
const DEFAULT_HEIGHT_SEGMENTS = 16;
const TAU = Math.PI * 2;

/** One horizontal circle of the frustum; `uv` gives the texture coordinate at axis angle `alpha`. */
type Ring = { y: number; radius: number; uv: (alpha: number) => [number, number] };

/**
 * Revolves strips of rings (each listed from the top down) about the Y axis. The axis angle α runs
 * from 0 (at −Z, where the seam is) through π (facing +Z) to 2π, increasing towards +X as seen from
 * the front, so a texture whose u grows with α reads left to right. Rings are `radialSegments + 1`
 * vertices wide (the first and last coincide) and `lean` is the wall's outward normal in the
 * (radial, y) plane.
 */
function revolveStrips(
  strips: readonly (readonly Ring[])[],
  radialSegments: number,
  lean: { radial: number; y: number },
): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stride = radialSegments + 1;

  for (const rings of strips) {
    const first = positions.length / 3;
    for (const ring of rings) {
      for (let i = 0; i <= radialSegments; i++) {
        const alpha = (i / radialSegments) * TAU;
        const [sin, cos] = [Math.sin(alpha), Math.cos(alpha)];
        positions.push(-ring.radius * sin, ring.y, -ring.radius * cos);
        normals.push(-lean.radial * sin, lean.y, -lean.radial * cos);
        uvs.push(...ring.uv(alpha));
      }
    }
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < radialSegments; i++) {
        // Counter-clockwise seen from outside: a (top left), b (below it), c (top right), d.
        const a = first + j * stride + i;
        const [b, c] = [a + stride, a + 1];
        indices.push(a, b, c, b, b + 1, c);
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

/**
 * The printed band of a cup (scene units = mm, axis +Y, base at y = 0, front faces +Z). A body
 * vertex at axis angle α and slant distance `v` from the rim takes the texture coordinate of the
 * dieline point `(u = α / 2π · printed width, v)`.
 */
export function buildCupGeometry(
  model: CupModel,
  surface: PrintSurface,
  opts: CupGeometryOptions = {},
): { body: BufferGeometry } {
  const radialSegments = opts.radialSegments ?? DEFAULT_RADIAL_SEGMENTS;
  const heightSegments = opts.heightSegments ?? DEFAULT_HEIGHT_SEGMENTS;
  const topRadius = model.topDiameterMm / 2;
  const bottomRadius = model.bottomDiameterMm / 2;
  const slantMm = Math.hypot(model.heightMm, topRadius - bottomRadius);
  const lean = { radial: model.heightMm / slantMm, y: (bottomRadius - topRadius) / slantMm };

  /** The wall at slant distance `v` below the rim. */
  const wallAt = (v: number) => {
    const t = v / slantMm;
    return { y: model.heightMm * (1 - t), radius: topRadius + (bottomRadius - topRadius) * t };
  };

  const widthMm = printedWidthMm(model, surface);
  const [bandTop, bandBottom] = surface.vRange;
  const bodyRings = Array.from({ length: heightSegments + 1 }, (_, j): Ring => {
    const v = bandTop + ((bandBottom - bandTop) * j) / heightSegments;
    return {
      ...wallAt(v),
      uv: (alpha) => {
        const flat = surface.toFlat((alpha / TAU) * widthMm, v);
        return surface.uvOf(flat.x, flat.y);
      },
    };
  });

  return { body: revolveStrips([bodyRings], radialSegments, lean) };
}

/**
 * A texture UV picked on a mesh → surface coordinates in mm. The inverse of `PrintSurface.uvOf`
 * (UVs span `flatBounds`, V grows upwards) followed by `fromFlat`.
 */
export function uvToSurfacePoint(surface: PrintSurface, uv: [number, number]): SurfacePoint {
  const { width, height } = surface.flatBounds;
  return surface.fromFlat(uv[0] * width, (1 - uv[1]) * height);
}
