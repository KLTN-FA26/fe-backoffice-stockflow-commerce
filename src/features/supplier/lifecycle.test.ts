import { describe, expect, it } from "vitest";

import { SUPPLIER_TRANSITIONS, allowedSupplierActions } from "./lifecycle";

import type { SupplierStatus } from "./types";

describe("supplier lifecycle", () => {
  it("allows Active -> Inactive", () => {
    expect(SUPPLIER_TRANSITIONS.Active).toEqual(["Inactive"] satisfies SupplierStatus[]);
  });

  it("allows Inactive -> Active", () => {
    expect(SUPPLIER_TRANSITIONS.Inactive).toEqual(["Active"] satisfies SupplierStatus[]);
  });

  it("exposes deactivate action for Active", () => {
    expect(allowedSupplierActions(["Active"]).map((a) => a.key)).toEqual(["deactivate"]);
    expect(allowedSupplierActions(["Active"])[0]?.targetStatus).toBe("Inactive");
  });

  it("exposes activate action for Inactive", () => {
    expect(allowedSupplierActions(["Inactive"]).map((a) => a.key)).toEqual(["activate"]);
  });

  it("returns empty for unknown status (defensive)", () => {
    expect(allowedSupplierActions(["Unknown" as SupplierStatus])).toEqual([]);
  });

  it("aggregates actions for multiple statuses", () => {
    const keys = allowedSupplierActions(["Active", "Inactive"]).map((a) => a.key);
    expect(keys).toEqual(["deactivate", "activate"]);
  });
});
