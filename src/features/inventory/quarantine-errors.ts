/**
 * Cách ly thùng — map lỗi API sang câu hiển thị, theo `error.code` của BE (không theo `message` tiếng Anh).
 * Mã lạ rơi về `inventoryErrorView` theo HTTP status.
 */

import { QUARANTINE_ERROR_MESSAGES } from "@/constants/quarantine";

import { ApiError } from "@/lib/api/error";

import { inventoryErrorView } from "./errors";

const M = QUARANTINE_ERROR_MESSAGES;

function messageOf(code: string): string | null {
  switch (code) {
    case "STOCK_PACKAGE_NOT_FOUND":
      return M.cartonNotFound;
    case "STOCK_PACKAGE_QUARANTINED":
      return M.alreadyQuarantined;
    case "STOCK_PACKAGE_NOT_QUARANTINED":
      return M.notQuarantined;
    case "LOCATION_AREA_MISMATCH":
      return M.notQuarantineArea;
    case "LOCATION_NOT_FOUND":
      return M.locationNotFound;
    case "MOVE_ACROSS_WAREHOUSES":
      return M.acrossWarehouses;
    case "STOCK_PACKAGE_HELD":
      return M.held;
    case "STOCK_SLOT_UNDER_COUNT":
      return M.underCount;
    case "STOCK_PACKAGE_DECISION_PENDING":
      return M.decisionPending;
    case "INVALID_STOCK_PACKAGE_TRANSITION":
      return M.notInStock;
    case "FORBIDDEN":
      return M.forbidden;
    case "OUT_OF_DATA_SCOPE":
      return M.outOfScope;
    case "VALIDATION_FAILED":
      return M.validation;
    case "NETWORK_ERROR":
      return M.network;
    default:
      return null;
  }
}

export function quarantineActionError(error: unknown): { detail: string; traceId?: string } {
  if (error instanceof ApiError) {
    const detail = messageOf(error.code);
    if (detail) return { detail, traceId: error.traceId };
  }
  const view = inventoryErrorView(error);
  return { detail: view.detail, traceId: view.traceId };
}
