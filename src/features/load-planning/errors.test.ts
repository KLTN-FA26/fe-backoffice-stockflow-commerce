import { describe, expect, it } from "vitest";

import { LOAD_PLAN_ERROR_MESSAGES as M } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  isOptimisticLockError,
  isStaleLoadPlanError,
  knownLoadPlanReadError,
  loadPlanErrorMessage,
} from "./errors";

const api = (code: string, status = 409, fields?: Record<string, string>) =>
  new ApiError(status, code, "Tiếng Anh của BE", fields);

describe("loadPlanErrorMessage", () => {
  it.each([
    ["OPTIMISTIC_LOCK", M.OPTIMISTIC_LOCK],
    ["LOAD_PLAN_NEEDS_RECALCULATION", M.LOAD_PLAN_NEEDS_RECALCULATION],
    ["LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED", M.LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED],
    ["LOAD_PLAN_LOADING_STARTED", M.LOAD_PLAN_LOADING_STARTED],
    ["LOAD_PLAN_PACKAGE_TAKEN", M.LOAD_PLAN_PACKAGE_TAKEN],
    ["PACKAGE_IN_LOAD_PLAN", M.PACKAGE_IN_LOAD_PLAN],
    ["LOAD_MANAGED_BY_PLAN", M.LOAD_MANAGED_BY_PLAN],
    ["INVALID_LOAD_PLAN_TRANSITION", M.INVALID_LOAD_PLAN_TRANSITION],
    ["LOAD_PLAN_EMPTY", M.LOAD_PLAN_EMPTY],
    ["LOAD_PLAN_PACKAGE_UNMEASURED", M.LOAD_PLAN_PACKAGE_UNMEASURED],
    ["PLACEMENT_RULE_VIOLATION", M.PLACEMENT_RULE_VIOLATION],
    ["VEHICLE_TYPE_INACTIVE", M.VEHICLE_TYPE_INACTIVE],
    ["SHIPMENT_STATE_CONFLICT", M.SHIPMENT_STATE_CONFLICT],
    ["SHIPMENT_NOT_FOR_LOAD", M.SHIPMENT_NOT_FOR_LOAD],
    ["LOAD_PLAN_NOT_FOUND", M.LOAD_PLAN_NOT_FOUND],
    ["LOAD_PLAN_VEHICLE_NOT_FOUND", M.LOAD_PLAN_VEHICLE_NOT_FOUND],
    ["WAREHOUSE_NOT_FOUND", M.WAREHOUSE_NOT_FOUND],
    ["VEHICLE_TYPE_NOT_FOUND", M.VEHICLE_TYPE_NOT_FOUND],
    ["SHIPMENT_NOT_FOUND", M.SHIPMENT_NOT_FOUND],
    ["CONFLICT", M.CONFLICT],
    ["OUT_OF_DATA_SCOPE", M.OUT_OF_DATA_SCOPE],
  ] as const)("%s → Vietnamese message, never the BE English", (code, message) => {
    const text = loadPlanErrorMessage(api(code));
    expect(text).toBe(message);
    expect(text).not.toContain("Tiếng Anh");
  });

  it("LP-4 names the orders the BE puts in fieldErrors.orderNumber", () => {
    const text = loadPlanErrorMessage(
      api("ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED", 409, { orderNumber: "SO-20261004-000001" }),
    );
    expect(text).toContain("SO-20261004-000001");
    expect(text).toContain("LP-4");
  });

  it("LP-4 names EVERY order when the BE sends one fieldError per order", () => {
    const error = new ApiError(
      409,
      "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED",
      "x",
      { orderNumber: "SO-1" },
      undefined,
      undefined,
      [
        { field: "orderNumber", message: "SO-1" },
        { field: "orderNumber", message: "SO-2" },
        { field: "orderNumber", message: "SO-1" },
      ],
    );
    const text = loadPlanErrorMessage(error);
    expect(text).toContain("SO-1, SO-2");
    expect(text.startsWith("Các đơn")).toBe(true);
    expect(text.match(/SO-1/g)).toHaveLength(1);
  });

  it("LP-4 without an order number still gives the general sentence", () => {
    expect(loadPlanErrorMessage(api("ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED"))).toBe(
      M.ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED,
    );
  });

  it("unknown codes, 403 and non-API errors fall back safely", () => {
    expect(loadPlanErrorMessage(api("SOMETHING_NEW", 500))).toBe(M.generic);
    expect(loadPlanErrorMessage(api("HTTP_403", 403))).toBe(M.FORBIDDEN);
    expect(loadPlanErrorMessage(new Error("boom"))).toBe(M.generic);
    expect(loadPlanErrorMessage(undefined)).toBe(M.generic);
    // Tên thuộc tính của Object.prototype không được coi là mã lỗi đã biết
    expect(loadPlanErrorMessage(api("constructor", 500))).toBe(M.generic);
  });

  it("the optimistic-lock message says the data was reloaded", () => {
    expect(M.OPTIMISTIC_LOCK).toContain("tải lại");
  });
});

describe("LOAD_PLAN_PACKAGE_NOT_ON_TRAY (VALIDATION_FAILED with a field code)", () => {
  const notOnTray = () =>
    new ApiError(
      400,
      "VALIDATION_FAILED",
      "x",
      { "pkg-1": "not on the plan's tray" },
      undefined,
      { "pkg-1": "LOAD_PLAN_PACKAGE_NOT_ON_TRAY" },
      [
        {
          field: "pkg-1",
          message: "not on the plan's tray",
          code: "LOAD_PLAN_PACKAGE_NOT_ON_TRAY",
        },
      ],
    );

  it("is mapped from the field error code to a clear message, not the generic validation one", () => {
    expect(loadPlanErrorMessage(notOnTray())).toBe(M.LOAD_PLAN_PACKAGE_NOT_ON_TRAY);
    expect(loadPlanErrorMessage(api("VALIDATION_FAILED", 400))).toBe(M.VALIDATION_FAILED);
  });

  it("counts as stale data so the plan is reloaded", () => {
    expect(isStaleLoadPlanError(notOnTray())).toBe(true);
    expect(isStaleLoadPlanError(api("VALIDATION_FAILED", 400))).toBe(false);
  });
});

describe("knownLoadPlanReadError", () => {
  it("gives the scope message for a 403, a known message for a known code, null for anything else", () => {
    expect(knownLoadPlanReadError(api("HTTP_403", 403))).toBe(M.OUT_OF_DATA_SCOPE);
    expect(knownLoadPlanReadError(api("OUT_OF_DATA_SCOPE", 403))).toBe(M.OUT_OF_DATA_SCOPE);
    expect(knownLoadPlanReadError(api("WAREHOUSE_NOT_FOUND", 404))).toBe(M.WAREHOUSE_NOT_FOUND);
    expect(knownLoadPlanReadError(api("HTTP_500", 500))).toBeNull();
    expect(knownLoadPlanReadError(new Error("x"))).toBeNull();
  });
});

describe("stale-data detection", () => {
  it("OPTIMISTIC_LOCK and state-changed errors reload the plan; validation errors do not", () => {
    for (const code of [
      "OPTIMISTIC_LOCK",
      "INVALID_LOAD_PLAN_TRANSITION",
      "LOAD_PLAN_NEEDS_RECALCULATION",
      "LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED",
      "LOAD_PLAN_LOADING_STARTED",
      "LOAD_PLAN_NOT_FOUND",
    ])
      expect(isStaleLoadPlanError(api(code))).toBe(true);
    for (const code of ["VALIDATION_FAILED", "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED", "FORBIDDEN"])
      expect(isStaleLoadPlanError(api(code))).toBe(false);
    expect(isStaleLoadPlanError(new Error("x"))).toBe(false);
  });

  it("isOptimisticLockError matches only the 409 OPTIMISTIC_LOCK", () => {
    expect(isOptimisticLockError(api("OPTIMISTIC_LOCK"))).toBe(true);
    expect(isOptimisticLockError(api("INVALID_LOAD_PLAN_TRANSITION"))).toBe(false);
  });
});
