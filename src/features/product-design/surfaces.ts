/**
 * The area ↔ mesh table of a template (`model3d.surfaces`), checked the way the BE checks it (origin/develop d47ed4ae):
 *  - always (`PrintConfigService.requireSurfaces`): each row names a print area of the model, once;
 *  - with a file, stored or sent (`ModelFileRules.incompleteSurfaces`): every print area has a row, and its mesh is
 *    `print:` + the area's code, the only name the storefront looks for.
 * The BE answers either with 422 PRINT_CONFIG_SURFACES_INVALID; the screen checks the same before sending.
 */
import { PRINT_CONFIG_SURFACE_ERROR_MESSAGES as MESSAGES } from "@/constants/labels-print-config";

import type { PrintSurface } from "./types";

export type SurfaceFault =
  | { kind: "unknown"; index: number; code: string }
  | { kind: "duplicate"; index: number; code: string }
  | { kind: "meshName"; index: number; code: string }
  | { kind: "missing"; code: string };

/** BE `ModelFileRules.MESH_PREFIX`: the mesh print area `code` is drawn on. */
const meshOf = (code: string): string => `print:${code}`;

/** Rows naming an area the model does not have, or an area named twice (BE `requireSurfaces`). */
export function looseSurfaceFaults(
  areaCodes: readonly string[],
  surfaces: readonly PrintSurface[],
): SurfaceFault[] {
  const seen = new Set<string>();
  const faults: SurfaceFault[] = [];
  surfaces.forEach(({ printAreaCode: code }, index) => {
    if (!areaCodes.includes(code)) faults.push({ kind: "unknown", index, code });
    else if (seen.has(code)) faults.push({ kind: "duplicate", index, code });
    seen.add(code);
  });
  return faults;
}

/** What keeps the table from being complete for a template with a file (BE `incompleteSurfaces`). */
export function incompleteSurfaces(
  areaCodes: readonly string[],
  surfaces: readonly PrintSurface[],
): SurfaceFault[] {
  const mapped = new Set<string>();
  const faults: SurfaceFault[] = [];
  surfaces.forEach(({ printAreaCode: code, meshName }, index) => {
    if (!areaCodes.includes(code)) return; // the loose check reports it
    mapped.add(code);
    if (meshName.trim() !== meshOf(code)) faults.push({ kind: "meshName", index, code });
  });
  for (const code of areaCodes) {
    if (!mapped.has(code)) faults.push({ kind: "missing", code });
  }
  return faults;
}

/** Both checks: what the BE refuses for a template that has a file. */
export const surfaceFaults = (
  areaCodes: readonly string[],
  surfaces: readonly PrintSurface[],
): SurfaceFault[] => [
  ...looseSurfaceFaults(areaCodes, surfaces),
  ...incompleteSurfaces(areaCodes, surfaces),
];

/** The sentence of a fault, naming its print area (the BE's `fieldErrors[].code` for the same fault). */
export function surfaceFaultMessage(fault: SurfaceFault): string {
  switch (fault.kind) {
    case "unknown":
      return MESSAGES.PrintAreaUnknown(fault.code);
    case "duplicate":
      return MESSAGES.PrintAreaDuplicate(fault.code);
    case "meshName":
      return MESSAGES.MeshNameMismatch(fault.code);
    case "missing":
      return MESSAGES.PrintAreaMissing(fault.code);
  }
}

const pairs = (surfaces: readonly PrintSurface[]): Set<string> =>
  new Set(surfaces.map((s) => JSON.stringify([s.printAreaCode, s.meshName.trim()])));

/** Whether two tables pair the same areas with the same meshes, whatever their order (BE `sameSurfaces`). */
export function sameSurfaces(a: readonly PrintSurface[], b: readonly PrintSurface[]): boolean {
  const left = pairs(a);
  const right = pairs(b);
  return left.size === right.size && [...left].every((pair) => right.has(pair));
}
