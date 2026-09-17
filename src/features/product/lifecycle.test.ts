import { describe, expect, it } from "vitest";

import {
  allowedProductActions,
  allowedSkuActions,
  nextProductStatuses,
  nextSkuStatuses,
} from "./lifecycle";

import { can } from "@/lib/auth/permissions";

import type { ProductStatus, SkuStatus } from "./types";

describe("product lifecycle", () => {
  it("allows product transitions from Draft per docs §5", () => {
    expect(nextProductStatuses("Draft")).toEqual(["Pending Approval"] satisfies ProductStatus[]);
  });

  it("allows SKU transitions from Active per docs §5", () => {
    expect(nextSkuStatuses("Active")).toEqual(["Blocked", "Obsolete"] satisfies SkuStatus[]);
  });

  it("gates Pending Approval product actions by E-commerce Admin role", () => {
    expect(
      allowedProductActions("Pending Approval", "E-commerce Admin").map((action) => action.code),
    ).toEqual(["approve", "reject"]);
  });

  it("gates Active SKU actions by E-commerce Admin role", () => {
    expect(allowedSkuActions("Active", "E-commerce Admin").map((action) => action.code)).toEqual([
      "block",
      "obsolete",
    ]);
  });

  it("gates product creation permission across admin, warehouse, and system roles", () => {
    expect(can("E-commerce Admin", "product.create")).toBe(true);
    expect(can("Warehouse Manager", "product.create")).toBe(false);
    expect(can("System Admin", "product.create")).toBe(true);
  });
});
