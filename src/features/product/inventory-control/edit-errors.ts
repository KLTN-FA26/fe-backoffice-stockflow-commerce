import { ZodError } from "zod";

import { ApiError } from "@/lib/api/error";

import { INVENTORY_CONTROL_TEXT as text } from "./constants";

export function inventoryPolicyError(error: unknown) {
  if (error instanceof ZodError) return text.malformed;
  if (!(error instanceof ApiError)) return text.saveFailed;
  switch (error.code) {
    // CONFLICT is also emitted for PENDING_APPROVAL / DISCONTINUED, not only stale versions.
    case "CONFLICT":
      return `${text.stateConflict} ${error.message}`;
    case "OPTIMISTIC_LOCK":
      return `${text.stateConflict} ${error.message}`;
    case "COUNT_POLICY_CONFLICT":
      return `${text.countConflict} ${error.message}`;
    case "INVENTORY_POLICY_STOCK_CONFLICT":
      return `${text.stockConflict} ${error.message}`;
    default:
      return error.status === 403 ? text.denied : error.message;
  }
}

export const isPolicyConflict = (error: unknown) =>
  error instanceof ApiError && error.status === 409;
