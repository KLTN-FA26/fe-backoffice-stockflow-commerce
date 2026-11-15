// Ported from stockflow-storefront src/features/product-design/engine/surfaces/types.ts
// and engine/geometry/types.ts (`PointMm`, `RectMm`, `PathCmd`).
import type { PrintAreaCode } from "./model-types";

/** A point in document space, in millimetres. */
export type PointMm = { x: number; y: number };

/** An axis-aligned rectangle in document space, in millimetres. */
export type RectMm = { x: number; y: number; width: number; height: number };

/**
 * One command of a flat outline path (surface boundary, print area, clip).
 * `M`/`L` move and line to a point; `A` is a circular arc about (`cx`, `cy`) with radius `r`
 * from `start` to `end` (radians, `ccw` = counter-clockwise); `Z` closes the sub-path.
 */
export type PathCmd =
  | { c: "M" | "L"; x: number; y: number }
  | { c: "A"; cx: number; cy: number; r: number; start: number; end: number; ccw: boolean }
  | { c: "Z" };

/** Nested print regions: bleed ⊃ trim ⊃ safe. */
export type SurfaceRegion = "bleed" | "trim" | "safe";

/** A non-printing line drawn over the editor view (never exported). */
export type Guide = { kind: "bleed" | "trim" | "safe" | "seam" | "crease"; path: PathCmd[] };

/** A dieline point plus the direction that reads as "up" on the product there (radians). */
export type FlatPoint = PointMm & { uprightRad: number };

/** Surface coordinates in mm: `u` across the print area, `v` down from its top (spec §4.3). */
export type SurfacePoint = { u: number; v: number };

/**
 * One print area unrolled into flat (dieline) coordinates. The flat origin is the top-left of
 * `flatBounds`, the bleed box; 2D editor, 3D texture and print output all share this geometry.
 */
export interface PrintSurface {
  code: PrintAreaCode;
  kind: "rect" | "sector";
  flatBounds: RectMm;
  uRange: [number, number];
  vRange: [number, number];
  bleedMm: number;
  /** The flat position of the cone's apex: set on sector (cup) surfaces only. */
  apexMm?: PointMm;
  toFlat(u: number, v: number): FlatPoint;
  fromFlat(x: number, y: number): SurfacePoint;
  contains(p: PointMm, region: SurfaceRegion): boolean;
  /** True inside the trim on the glue flap, which is hidden under the overlap once assembled. */
  inSeam(p: PointMm): boolean;
  outline(region: SurfaceRegion): PathCmd[];
  guides(): Guide[];
  /** Flat point → texture UV over `flatBounds` (V grows upwards, as in three.js). */
  uvOf(x: number, y: number): [number, number];
}

/** Every print surface of a template, in `printAreas` order. */
export type SurfaceSet = {
  order: PrintAreaCode[];
  byCode: Readonly<Partial<Record<PrintAreaCode, PrintSurface>>>;
};

/**
 * The print area a mesh carries the artwork of, and the surface its UVs belong to (the storefront's
 * `PrintTarget` of `viewer3d/scene-parts.ts`; named apart from the narrower `PrintTarget` of
 * `compare-template.ts`, which only reads `surface.vRange`).
 */
export type SurfaceTarget = { code: PrintAreaCode; surface: PrintSurface };
