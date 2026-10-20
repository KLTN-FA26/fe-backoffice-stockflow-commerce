import { describe, expect, it } from "vitest";

import { MOVE_ERROR_MESSAGES, MOVE_MESSAGES } from "@/constants/move";

import { ApiError } from "@/lib/api/error";

import { moveErrorView, moveFieldErrors } from "./errors";

const error = (status: number, code: string, fields?: Record<string, string>) =>
  new ApiError(status, code, "English server message", fields, "trace-1");

describe("moveErrorView — branches on errorCode, never on the English message", () => {
  it.each([
    [409, "MOVE_ACROSS_WAREHOUSES", "conflict", MOVE_ERROR_MESSAGES.crossWarehouse],
    [404, "LOCATION_NOT_FOUND", "not-found", MOVE_ERROR_MESSAGES.locationNotFound],
    [409, "LOCATION_NOT_USABLE", "conflict", MOVE_ERROR_MESSAGES.locationNotUsable],
    [404, "STOCK_ITEM_NOT_FOUND", "not-found", MOVE_ERROR_MESSAGES.stockItemNotFound],
    [409, "INSUFFICIENT_STOCK", "conflict", MOVE_ERROR_MESSAGES.insufficientStock],
    [409, "STOCK_STATUS_MISMATCH", "conflict", MOVE_ERROR_MESSAGES.statusMismatch],
    [409, "INVENTORY_POLICY_STOCK_CONFLICT", "conflict", MOVE_ERROR_MESSAGES.policyConflict],
    [403, "OUT_OF_DATA_SCOPE", "forbidden", MOVE_ERROR_MESSAGES.outOfScope],
    [409, "OPTIMISTIC_LOCK", "conflict", MOVE_ERROR_MESSAGES.concurrent],
    [400, "VALIDATION_FAILED", "validation", MOVE_ERROR_MESSAGES.validation],
    [502, "INVALID_MOVE_CONTRACT", "contract", MOVE_MESSAGES.invalidContract],
    [0, "NETWORK_ERROR", "network", MOVE_ERROR_MESSAGES.network],
  ])("%i %s", (status, code, kind, detail) => {
    expect(moveErrorView(error(status, code))).toMatchObject({ kind, detail, traceId: "trace-1" });
  });

  it("never shows the server's English message", () => {
    for (const code of ["INSUFFICIENT_STOCK", "SOMETHING_NEW"]) {
      expect(moveErrorView(error(409, code)).detail).not.toContain("English");
    }
  });

  it.each([
    [400, "validation"],
    [422, "validation"],
    [403, "forbidden"],
    [404, "not-found"],
    [409, "conflict"],
    [500, "server"],
    [0, "network"],
  ])("unknown code falls back by HTTP status %i", (status, kind) => {
    expect(moveErrorView(error(status, "SOMETHING_NEW")).kind).toBe(kind);
  });

  it("a non-ApiError is a server failure", () => {
    expect(moveErrorView(new Error("boom"))).toMatchObject({
      kind: "server",
      detail: MOVE_ERROR_MESSAGES.server,
    });
  });
});

describe("moveFieldErrors", () => {
  it("re-words server field errors in Vietnamese and ignores fields the form lacks", () => {
    expect(
      moveFieldErrors(
        error(400, "VALIDATION_FAILED", {
          quantity: "quantity must be at least 1",
          sku: "malformed SKU",
          requestId: "requestId is required",
        }),
      ),
    ).toEqual({ quantity: MOVE_MESSAGES.quantity, sku: MOVE_MESSAGES.invalidSku });
    expect(moveFieldErrors(new Error("x"))).toEqual({});
  });
});
