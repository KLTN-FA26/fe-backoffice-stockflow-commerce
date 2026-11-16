import { describe, expect, it } from "vitest";

import { INVENTORY_PERMISSIONS, STOCK_PACKAGE_PERMISSIONS } from "@/constants/permissions";
import { QUARANTINE_ACTION } from "@/constants/quarantine";

import {
  allowedQuarantineActions,
  canWriteOffCarton,
  isHeldForOrder,
  isQuarantined,
} from "./quarantine-lifecycle";
import { stockPackageDetailDto } from "./quarantine-schemas";

import type { PermissionCode } from "@/lib/auth";

function granted(...codes: PermissionCode[]) {
  return (code: PermissionCode) => codes.includes(code);
}

const SP = STOCK_PACKAGE_PERMISSIONS;
// Seeded (V20261020000700): the warehouse manager has every action; warehouse staff read and print labels.
const manager = granted(
  SP.viewPage,
  SP.read,
  SP.create,
  SP.update,
  INVENTORY_PERMISSIONS.stockUpdate,
);
const staff = granted(SP.viewPage, SP.read, SP.create, INVENTORY_PERMISSIONS.stockUpdate);
const readOnly = granted(SP.viewPage, SP.read);

function carton(overrides: Record<string, unknown> = {}, stockStatus = "AVAILABLE") {
  return stockPackageDetailDto.parse({
    lpn: "LPN-20261110-000001",
    sku: "CUP-PP-500",
    nominalQty: 120,
    receivedQty: 120,
    lotNumber: "PO-1001",
    onHand: 120,
    reserved: 0,
    status: "IN_STOCK",
    locationCode: "HCM-A01-1-B",
    contents: [{ lotNumber: "PO-1001", status: stockStatus, onHand: 120, reserved: 0 }],
    ...overrides,
  });
}

describe("quarantine decisions (docs 20 §4.8, BR-21)", () => {
  it("a free carton in stock can be quarantined — by the manager only", () => {
    expect(allowedQuarantineActions(carton(), manager)).toEqual([QUARANTINE_ACTION.QUARANTINE]);
    expect(allowedQuarantineActions(carton(), staff)).toEqual([]);
    expect(allowedQuarantineActions(carton(), readOnly)).toEqual([]);
  });

  it("a quarantined carton can be released to a putaway task — by the manager only", () => {
    const held = carton({}, "QUARANTINE");
    expect(isQuarantined(held)).toBe(true);
    expect(allowedQuarantineActions(held, manager)).toEqual([QUARANTINE_ACTION.RELEASE]);
    expect(allowedQuarantineActions(held, staff)).toEqual([]);
  });

  it("a carton held for an order is not quarantined directly: release the hold first (BR-21)", () => {
    const heldForOrder = carton({ reserved: 120 });
    expect(isHeldForOrder(heldForOrder)).toBe(true);
    expect(allowedQuarantineActions(heldForOrder, manager)).toEqual([]);
  });

  it.each(["CONSUMED", "LOST", "VOID", "RECEIVING"])(
    "a %s carton is no longer in stock: no quarantine, no release, no write-off",
    (status) => {
      const gone = carton({ status, contents: [] });
      expect(allowedQuarantineActions(gone, manager)).toEqual([]);
      expect(canWriteOffCarton(gone, manager)).toBe(false);
    },
  );

  it("an unknown carton status offers nothing", () => {
    expect(allowedQuarantineActions(carton({ status: "FUTURE" }), manager)).toEqual([]);
  });

  it("only a quarantined carton is written off from here — as an adjustment request, never a direct write", () => {
    const held = carton({}, "QUARANTINE");
    expect(canWriteOffCarton(held, manager)).toBe(true);
    expect(canWriteOffCarton(held, staff)).toBe(true);
    expect(canWriteOffCarton(held, readOnly)).toBe(false);
    expect(canWriteOffCarton(carton(), manager)).toBe(false);
  });
});
