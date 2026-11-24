import { describe, expect, it } from "vitest";

import { MOVE_ERROR_MESSAGES, MOVE_MESSAGES } from "@/constants/move";

import { ApiError } from "@/lib/api/error";

import { isIdempotencyReused, moveErrorView, moveFieldErrors } from "./errors";

const error = (
  status: number,
  code: string,
  fields?: Record<string, string>,
  details?: Record<string, unknown>,
) =>
  new ApiError(
    status,
    code,
    "English server message",
    fields,
    "trace-1",
    undefined,
    undefined,
    details,
  );

describe("moveErrorView — branches on errorCode, never on the English message", () => {
  it.each([
    [404, "STOCK_PACKAGE_NOT_FOUND", "not-found", MOVE_ERROR_MESSAGES.cartonNotFound],
    [409, "STOCK_PACKAGE_HELD", "conflict", MOVE_ERROR_MESSAGES.cartonHeld],
    [409, "STOCK_SLOT_UNDER_COUNT", "conflict", MOVE_ERROR_MESSAGES.slotUnderCount],
    [409, "INVALID_STOCK_PACKAGE_TRANSITION", "conflict", MOVE_ERROR_MESSAGES.cartonNotInStock],
    [409, "MOVE_ACROSS_WAREHOUSES", "conflict", MOVE_ERROR_MESSAGES.crossWarehouse],
    [409, "STAGING_MOVE_NOT_ALLOWED", "conflict", MOVE_ERROR_MESSAGES.staging],
    [422, "CARTON_DOES_NOT_FIT_BIN", "validation", MOVE_ERROR_MESSAGES.doesNotFit],
    [409, "STOCK_PACKAGE_QUARANTINED", "conflict", MOVE_ERROR_MESSAGES.quarantined],
    [409, "LOCATION_AREA_MISMATCH", "conflict", MOVE_ERROR_MESSAGES.areaMismatch],
    [409, "STOCK_STATUS_MISMATCH", "conflict", MOVE_ERROR_MESSAGES.statusMismatch],
    [404, "LOCATION_NOT_FOUND", "not-found", MOVE_ERROR_MESSAGES.locationNotFound],
    [409, "LOCATION_NOT_USABLE", "conflict", MOVE_ERROR_MESSAGES.locationNotUsable],
    [422, "IDEMPOTENCY_KEY_REUSED", "validation", MOVE_ERROR_MESSAGES.idempotencyReused],
    [403, "OUT_OF_DATA_SCOPE", "forbidden", MOVE_ERROR_MESSAGES.outOfScope],
    [409, "OPTIMISTIC_LOCK", "conflict", MOVE_ERROR_MESSAGES.concurrent],
    [422, "VALIDATION_FAILED", "validation", MOVE_ERROR_MESSAGES.validation],
    [502, "INVALID_MOVE_CONTRACT", "contract", MOVE_MESSAGES.invalidContract],
    [0, "NETWORK_ERROR", "network", MOVE_ERROR_MESSAGES.network],
  ])("%i %s", (status, code, kind, detail) => {
    expect(moveErrorView(error(status, code))).toMatchObject({ kind, detail, traceId: "trace-1" });
  });

  it("names the carton the BE refused (details.lpn) so its row can be flagged", () => {
    const view = moveErrorView(
      error(409, "STOCK_PACKAGE_HELD", undefined, { lpn: "LPN-20261109-000002" }),
    );
    expect(view.lpn).toBe("LPN-20261109-000002");
    // details lạ / sai hình → bỏ qua, không làm hỏng thông điệp
    expect(
      moveErrorView(error(409, "STOCK_PACKAGE_HELD", undefined, { lpn: 7 })).lpn,
    ).toBeUndefined();
    expect(moveErrorView(error(409, "STAGING_MOVE_NOT_ALLOWED")).lpn).toBeUndefined();
  });

  it("never shows the server's English message", () => {
    for (const code of ["STOCK_PACKAGE_HELD", "SOMETHING_NEW"]) {
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

  it("recognizes a reused idempotency key", () => {
    expect(isIdempotencyReused(error(422, "IDEMPOTENCY_KEY_REUSED"))).toBe(true);
    expect(isIdempotencyReused(error(422, "VALIDATION_FAILED"))).toBe(false);
    expect(isIdempotencyReused(new Error("x"))).toBe(false);
  });
});

describe("moveFieldErrors", () => {
  it("maps `lpns` / `lpns[i]` to the carton list and ignores fields the form lacks", () => {
    expect(
      moveFieldErrors(
        error(400, "VALIDATION_FAILED", {
          "lpns[3]": "an LPN is at most 30 characters",
          toLocation: "toLocation is required",
          requestId: "requestId is required",
        }),
      ),
    ).toEqual({ lpns: MOVE_ERROR_MESSAGES.validation, toLocation: MOVE_MESSAGES.required });
    expect(moveFieldErrors(error(400, "VALIDATION_FAILED", { lpns: "x" }))).toEqual({
      lpns: MOVE_ERROR_MESSAGES.validation,
    });
    expect(moveFieldErrors(new Error("x"))).toEqual({});
  });
});
