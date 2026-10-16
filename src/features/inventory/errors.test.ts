import { describe, expect, it } from "vitest";

import {
  INVENTORY_ERROR_MESSAGES as M,
  INVENTORY_ERROR_TITLES,
  INVENTORY_LABELS,
  INVENTORY_MESSAGES,
} from "@/constants/inventory";

import { ApiError } from "@/lib/api/error";

import { inventoryErrorView, isRetryableInventoryError, isStaleAdjustmentError } from "./errors";

const ENGLISH = "Some English backend sentence";

function apiError(status: number, code: string, traceId = "trace-1") {
  return new ApiError(status, code, ENGLISH, undefined, traceId);
}

// BE develop 0f18f24 ErrorCode.java: code, HTTP status.
describe("inventory error mapping by backend errorCode", () => {
  it.each([
    ["ADJUSTMENT_SELF_APPROVAL", 409, "conflict", M.selfApproval],
    ["INVALID_ADJUSTMENT_TRANSITION", 409, "conflict", M.transition],
    ["OPTIMISTIC_LOCK", 409, "conflict", M.concurrentChange],
    ["ADJUSTMENT_NOT_REQUESTER", 403, "forbidden", M.notRequester],
    ["OUT_OF_DATA_SCOPE", 403, "forbidden", M.outOfScope],
    ["STOCK_ITEM_NOT_FOUND", 404, "not-found", M.stockItemNotFound],
    ["STOCK_ADJUSTMENT_NOT_FOUND", 404, "not-found", M.adjustmentNotFound],
    ["INSUFFICIENT_STOCK", 409, "conflict", M.insufficientStock],
    ["INVENTORY_POLICY_STOCK_CONFLICT", 409, "conflict", M.policyConflict],
    ["VALIDATION_FAILED", 400, "validation", M.validation],
  ] as const)("%s (%i) → Vietnamese %s message", (code, status, kind, detail) => {
    const view = inventoryErrorView(apiError(status, code));
    expect(view).toMatchObject({ kind, detail, traceId: "trace-1" });
    expect(view.title).not.toContain(ENGLISH);
    expect(view.detail).not.toContain(ENGLISH);
  });

  it("classifies only lifecycle races as stale", () => {
    ["ADJUSTMENT_SELF_APPROVAL", "INVALID_ADJUSTMENT_TRANSITION", "OPTIMISTIC_LOCK"].forEach(
      (code) => expect(isStaleAdjustmentError(apiError(409, code))).toBe(true),
    );
    [
      "INSUFFICIENT_STOCK",
      "INVENTORY_POLICY_STOCK_CONFLICT",
      "ADJUSTMENT_NOT_REQUESTER",
      "STOCK_ADJUSTMENT_NOT_FOUND",
      "CONFLICT",
    ].forEach((code) => expect(isStaleAdjustmentError(apiError(409, code))).toBe(false));
    expect(isStaleAdjustmentError(new Error("INVALID_ADJUSTMENT_TRANSITION"))).toBe(false);
  });

  it("does not present ADJUSTMENT_NOT_REQUESTER as an inventory view denial", () => {
    const view = inventoryErrorView(apiError(403, "ADJUSTMENT_NOT_REQUESTER"));
    expect(view.title).not.toBe(INVENTORY_LABELS.denied);
    expect(view.detail).not.toBe(INVENTORY_LABELS.deniedDescription);
  });

  it("names the missing adjustment, not stock, for STOCK_ADJUSTMENT_NOT_FOUND", () => {
    expect(inventoryErrorView(apiError(404, "STOCK_ADJUSTMENT_NOT_FOUND")).title).toBe(
      INVENTORY_ERROR_TITLES.adjustmentNotFound,
    );
    expect(inventoryErrorView(apiError(404, "STOCK_ITEM_NOT_FOUND")).detail).not.toBe(
      M.adjustmentNotFound,
    );
  });

  it.each([
    [403, "forbidden", M.forbidden],
    [404, "not-found", M.notFound],
    [409, "conflict", M.conflict],
    [422, "validation", M.validation],
    [500, "server", M.server],
    [503, "server", M.server],
  ] as const)("unknown code with HTTP %i falls back to %s", (status, kind, detail) => {
    const view = inventoryErrorView(apiError(status, "SOMETHING_NEW"));
    expect(view).toMatchObject({ kind, detail, traceId: "trace-1" });
    expect(view.detail).not.toContain(ENGLISH);
  });

  it("keeps network and contract failures distinct", () => {
    expect(inventoryErrorView(new ApiError(0, "NETWORK_ERROR", ENGLISH))).toMatchObject({
      kind: "network",
      detail: M.network,
    });
    expect(
      inventoryErrorView(new ApiError(502, "INVALID_INVENTORY_CONTRACT", ENGLISH)),
    ).toMatchObject({ kind: "contract", detail: INVENTORY_MESSAGES.invalidContract });
  });

  it("never leaks a non-API error message", () => {
    const view = inventoryErrorView(new Error(ENGLISH));
    expect(view).toMatchObject({ kind: "server", detail: M.server });
    expect(view.traceId).toBeUndefined();
  });

  it("offers retry only where repeating the read can help", () => {
    expect(isRetryableInventoryError(inventoryErrorView(apiError(500, "X")))).toBe(true);
    expect(
      isRetryableInventoryError(inventoryErrorView(new ApiError(0, "NETWORK_ERROR", ""))),
    ).toBe(true);
    expect(
      isRetryableInventoryError(inventoryErrorView(apiError(404, "STOCK_ADJUSTMENT_NOT_FOUND"))),
    ).toBe(false);
    expect(isRetryableInventoryError(inventoryErrorView(apiError(403, "OUT_OF_DATA_SCOPE")))).toBe(
      false,
    );
  });
});
