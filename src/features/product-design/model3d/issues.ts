// Ported from stockflow-storefront src/features/product-design/engine/model3d/issues.ts
import { MODEL3D_ISSUE_MESSAGES } from "@/constants/labels-model3d";
import { MODEL3D_LIMITS } from "@/constants/numbers";

/**
 * What can be wrong with a `.glb` model, in plain Vietnamese (spec §5).
 * Errors block the model (the viewer keeps the number-built mould); warnings do not.
 */
export type ModelIssueCode =
  | "NO_PRINT_MESH"
  | "DUPLICATE_PRINT_MESH"
  | "MIXED_KINDS"
  | "BAD_UNITS"
  | "NOT_REVOLVED"
  | "TOO_COARSE"
  | "NOT_PLANAR"
  | "NOT_RECTANGULAR"
  | "TOO_MANY_TRIANGLES"
  | "FILE_TOO_LARGE"
  | "NOT_FACING_FRONT"
  | "BASE_NOT_AT_ZERO"
  | "FACES_INWARD"
  | "PRINT_NAME_NEAR_MISS"
  | "INVALID_GEOMETRY"
  | "MULTI_MATERIAL_PRINT_MESH"
  | "GUSSET_MISMATCH"
  | "BAG_MODEL_INCOMPLETE";

export type ModelIssue = {
  code: ModelIssueCode;
  level: "error" | "warning";
  message: string;
  meshName?: string;
};

export const MODEL_ISSUE_LEVEL: Readonly<Record<ModelIssueCode, ModelIssue["level"]>> = {
  NO_PRINT_MESH: "error",
  DUPLICATE_PRINT_MESH: "error",
  MIXED_KINDS: "error",
  BAD_UNITS: "error",
  NOT_REVOLVED: "error",
  TOO_COARSE: "error",
  NOT_PLANAR: "error",
  NOT_RECTANGULAR: "error",
  TOO_MANY_TRIANGLES: "error",
  FILE_TOO_LARGE: "error",
  NOT_FACING_FRONT: "warning",
  BASE_NOT_AT_ZERO: "warning",
  FACES_INWARD: "warning",
  PRINT_NAME_NEAR_MISS: "warning",
  INVALID_GEOMETRY: "error",
  MULTI_MATERIAL_PRINT_MESH: "error",
  GUSSET_MISMATCH: "warning",
  BAG_MODEL_INCOMPLETE: "warning",
};

export function modelIssue(code: ModelIssueCode, message: string, meshName?: string): ModelIssue {
  return meshName === undefined
    ? { code, level: MODEL_ISSUE_LEVEL[code], message }
    : { code, level: MODEL_ISSUE_LEVEL[code], message, meshName };
}

/** The Vietnamese message of each issue (texts live in `constants/labels-model3d.ts`). */
export const issueMessages = MODEL3D_ISSUE_MESSAGES;

/** Exactly 1 mm off passes, float noise does not flip it (used by `templateDifferences`). */
export const COMPARISON_TOLERANCE_MM = MODEL3D_LIMITS.comparisonToleranceMm;
