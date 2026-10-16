/**
 * Inventory — mapping lỗi API sang thông điệp hiển thị.
 *
 * Branch theo `error.code` (= `errorCode` của BE, giữ nguyên trong `transport.ts`), KHÔNG theo
 * `error.message` — message server là tiếng Anh và có thể đổi bất cứ lúc nào; code là contract
 * (BE develop 0f18f24 `common/error/ErrorCode.java`). Mã lạ → rơi về theo HTTP status.
 */

import {
  INVENTORY_ERROR_MESSAGES,
  INVENTORY_ERROR_TITLES,
  INVENTORY_LABELS,
  INVENTORY_MESSAGES,
} from "@/constants/inventory";

import { ApiError } from "@/lib/api/error";

export type InventoryErrorKind =
  "not-found" | "forbidden" | "conflict" | "validation" | "contract" | "network" | "server";

export interface InventoryErrorView {
  kind: InventoryErrorKind;
  title: string;
  detail: string;
  traceId?: string;
}

const M = INVENTORY_ERROR_MESSAGES;

const TITLES: Record<InventoryErrorKind, string> = {
  "not-found": INVENTORY_ERROR_TITLES.notFound,
  forbidden: INVENTORY_LABELS.denied,
  conflict: INVENTORY_ERROR_TITLES.actionFailed,
  validation: INVENTORY_ERROR_TITLES.actionFailed,
  contract: INVENTORY_LABELS.loadError,
  network: INVENTORY_ERROR_TITLES.network,
  server: INVENTORY_LABELS.loadError,
};

const FALLBACK: Record<InventoryErrorKind, string> = {
  "not-found": M.notFound,
  forbidden: M.forbidden,
  conflict: M.conflict,
  validation: M.validation,
  contract: INVENTORY_MESSAGES.invalidContract,
  network: M.network,
  server: M.server,
};

function known(code: string): Pick<InventoryErrorView, "kind" | "detail" | "title"> | null {
  switch (code) {
    // StockAdjustment.approveAndPost/reject — 409, four eyes (requester cannot decide).
    case "ADJUSTMENT_SELF_APPROVAL":
      return { kind: "conflict", title: TITLES.conflict, detail: M.selfApproval };
    // StockAdjustment.requirePending — 409, already decided or withdrawn.
    case "INVALID_ADJUSTMENT_TRANSITION":
      return { kind: "conflict", title: TITLES.conflict, detail: M.transition };
    // GlobalExceptionHandler OptimisticLockingFailureException — 409, versioned row changed.
    case "OPTIMISTIC_LOCK":
      return { kind: "conflict", title: TITLES.conflict, detail: M.concurrentChange };
    // StockAdjustment.withdraw — 403 for a non-requester; an action error, not a view denial.
    case "ADJUSTMENT_NOT_REQUESTER":
      return { kind: "forbidden", title: TITLES.conflict, detail: M.notRequester };
    // WarehouseScope.requireLocation — 403.
    case "OUT_OF_DATA_SCOPE":
      return { kind: "forbidden", title: TITLES.forbidden, detail: M.outOfScope };
    // requestAdjustment / approve — 404, the stock row (not the adjustment) is missing.
    case "STOCK_ITEM_NOT_FOUND":
      return { kind: "not-found", title: TITLES["not-found"], detail: M.stockItemNotFound };
    // GET detail hides out-of-scope rows as this 404 too — existence is not disclosed.
    case "STOCK_ADJUSTMENT_NOT_FOUND":
      return {
        kind: "not-found",
        title: INVENTORY_ERROR_TITLES.adjustmentNotFound,
        detail: M.adjustmentNotFound,
      };
    // StockItem.adjustBy — 409, on hand would drop below reserved.
    case "INSUFFICIENT_STOCK":
      return { kind: "conflict", title: TITLES.conflict, detail: M.insufficientStock };
    // findOne (several layers) / stock policy — 409.
    case "INVENTORY_POLICY_STOCK_CONFLICT":
      return { kind: "conflict", title: TITLES.conflict, detail: M.policyConflict };
    case "VALIDATION_FAILED":
      return { kind: "validation", title: TITLES.validation, detail: M.validation };
    // transport.ts: response did not match the Inventory DTO.
    case "INVALID_INVENTORY_CONTRACT":
      return { kind: "contract", title: TITLES.contract, detail: FALLBACK.contract };
    case "NETWORK_ERROR":
      return { kind: "network", title: TITLES.network, detail: FALLBACK.network };
    default:
      return null;
  }
}

function kindOfStatus(status: number): InventoryErrorKind {
  if (status === 0) return "network";
  if (status === 400 || status === 422) return "validation";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  return "server";
}

export function inventoryErrorView(error: unknown): InventoryErrorView {
  if (!(error instanceof ApiError)) {
    return { kind: "server", title: TITLES.server, detail: FALLBACK.server };
  }
  const view = known(error.code);
  if (view) return { ...view, traceId: error.traceId };
  const kind = kindOfStatus(error.status);
  return { kind, title: TITLES[kind], detail: FALLBACK[kind], traceId: error.traceId };
}

/** Retrying the same read cannot fix these. */
export function isRetryableInventoryError(view: InventoryErrorView) {
  return view.kind === "network" || view.kind === "server" || view.kind === "contract";
}

// The page's adjustment state is behind the server: refresh the detail so Step 3 lifecycle
// and permission rules recompute the actions from the current status.
const STALE_ADJUSTMENT_CODES: readonly string[] = [
  "INVALID_ADJUSTMENT_TRANSITION",
  "ADJUSTMENT_SELF_APPROVAL",
  "OPTIMISTIC_LOCK",
];

export function isStaleAdjustmentError(error: unknown): boolean {
  return error instanceof ApiError && STALE_ADJUSTMENT_CODES.includes(error.code);
}
