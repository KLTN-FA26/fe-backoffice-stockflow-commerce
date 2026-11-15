// Split from stockflow-storefront src/features/product-design/engine/model3d/load.ts (error type)
import { MODEL3D_LOAD_MESSAGES } from "@/constants/labels-model3d";

export type Model3dErrorCode = "LOAD_FAILED" | "ABORTED" | "MESH_MISSING" | "INVALID_MODEL";

/** Why a `LOAD_FAILED` happened. */
export type Model3dLoadReason = "timeout" | "http" | "network" | "parse";

/** Why a `.glb` could not become a scene. */
export class Model3dError extends Error {
  readonly code: Model3dErrorCode;
  /** Set for `LOAD_FAILED`. */
  readonly reason?: Model3dLoadReason;

  constructor(code: Model3dErrorCode, message: string, reason?: Model3dLoadReason) {
    super(message);
    this.name = "Model3dError";
    this.code = code;
    if (reason) this.reason = reason;
  }
}

export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export const timeoutError = (reason: string) =>
  new Model3dError("LOAD_FAILED", MODEL3D_LOAD_MESSAGES.timeout(reason), "timeout");
