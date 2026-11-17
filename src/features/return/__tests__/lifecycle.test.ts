import { describe, expect, it } from "vitest";

import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import {
  RETURN_API_STATUSES,
  RETURN_RECEIPT_API_STATUSES,
  RMA_PERMISSIONS,
  RMA_RESOLUTION_PERMISSIONS,
} from "@/constants/returns";

import {
  RETURN_RECEIPT_TRANSITIONS,
  RETURN_TRANSITIONS,
  allowedReturnActions,
  allowedReturnReceiptActions,
  isReturnOpen,
} from "../lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";

// Bộ quyền theo seed BE (baseline V20261111000000)
const SALES: PermissionCode[] = [
  ...Object.values(RMA_PERMISSIONS),
  RMA_RESOLUTION_PERMISSIONS.propose,
];
const ACCOUNTANT: PermissionCode[] = [
  RMA_PERMISSIONS.viewPage,
  RMA_PERMISSIONS.read,
  RMA_RESOLUTION_PERMISSIONS.approve,
];
const WAREHOUSE: PermissionCode[] = [
  RMA_PERMISSIONS.viewPage,
  RMA_PERMISSIONS.read,
  ...Object.values(GOODS_RECEIPT_PERMISSIONS),
];
const as = (grants: PermissionCode[]) => (code: PermissionCode) => grants.includes(code);

describe("RETURN_TRANSITIONS (BE ReturnStatus.canTransitionTo)", () => {
  it("covers every BE status", () => {
    expect(Object.keys(RETURN_TRANSITIONS).sort()).toEqual([...RETURN_API_STATUSES].sort());
  });

  it("REQUESTED → AWAITING_RETURN / REJECTED / CANCELLED; refund goes back to RECEIVED when sent back", () => {
    expect(RETURN_TRANSITIONS.REQUESTED).toEqual(["AWAITING_RETURN", "REJECTED", "CANCELLED"]);
    expect(RETURN_TRANSITIONS.SETTLEMENT_PENDING).toEqual(["RESOLVED", "RECEIVED"]);
  });

  it("RESOLVED, REJECTED and the historical INSPECTED are terminal", () => {
    expect(RETURN_TRANSITIONS.RESOLVED).toEqual([]);
    expect(RETURN_TRANSITIONS.REJECTED).toEqual([]);
    expect(RETURN_TRANSITIONS.INSPECTED).toEqual([]);
  });

  it("open statuses keep the order from completing (BR-ORD-005)", () => {
    expect(RETURN_API_STATUSES.filter(isReturnOpen)).toEqual([
      "REQUESTED",
      "AWAITING_RETURN",
      "RECEIVED",
      "SETTLEMENT_PENDING",
    ]);
  });
});

describe("allowedReturnActions — three roles", () => {
  it("Sales decide a REQUESTED claim and may withdraw it; accountant and warehouse may not", () => {
    expect(allowedReturnActions({ status: "REQUESTED" }, as(SALES))).toEqual([
      "approve",
      "reject",
      "cancel",
    ]);
    expect(allowedReturnActions({ status: "REQUESTED" }, as(ACCOUNTANT))).toEqual([]);
    expect(allowedReturnActions({ status: "REQUESTED" }, as(WAREHOUSE))).toEqual([]);
  });

  it("AWAITING_RETURN: warehouse opens the return receipt (17 BR-18), Sales may still withdraw", () => {
    expect(allowedReturnActions({ status: "AWAITING_RETURN" }, as(WAREHOUSE))).toEqual([
      "createReceipt",
    ]);
    expect(allowedReturnActions({ status: "AWAITING_RETURN" }, as(SALES))).toEqual(["cancel"]);
  });

  it("RECEIVED: Sales propose the refund; SETTLEMENT_PENDING: only the accountant decides (four eyes)", () => {
    expect(allowedReturnActions({ status: "RECEIVED" }, as(SALES))).toEqual(["propose"]);
    expect(allowedReturnActions({ status: "RECEIVED" }, as(ACCOUNTANT))).toEqual([]);
    expect(allowedReturnActions({ status: "SETTLEMENT_PENDING" }, as(ACCOUNTANT))).toEqual([
      "approveSettlement",
      "rejectSettlement",
    ]);
    expect(allowedReturnActions({ status: "SETTLEMENT_PENDING" }, as(SALES))).toEqual([]);
  });

  it("terminal statuses render no mutating button for anyone", () => {
    const everyone = as([...SALES, ...ACCOUNTANT, ...WAREHOUSE]);
    for (const status of ["RESOLVED", "REJECTED", "CANCELLED", "EXPIRED", "INSPECTED"] as const)
      expect(allowedReturnActions({ status }, everyone)).toEqual([]);
  });
});

describe("return receipt", () => {
  it("covers every receipt status; only DRAFT moves", () => {
    expect(Object.keys(RETURN_RECEIPT_TRANSITIONS).sort()).toEqual(
      [...RETURN_RECEIPT_API_STATUSES].sort(),
    );
    expect(RETURN_RECEIPT_TRANSITIONS.DRAFT).toEqual(["CLOSED", "CANCELLED"]);
    expect(RETURN_RECEIPT_TRANSITIONS.CLOSED).toEqual([]);
  });

  it("a draft without cartons cannot be confirmed; Sales cannot touch it", () => {
    expect(allowedReturnReceiptActions({ status: "DRAFT", cartons: [] }, as(WAREHOUSE))).toEqual([
      "scan",
      "cancel",
    ]);
    expect(
      allowedReturnReceiptActions({ status: "DRAFT", cartons: [{}] }, as(WAREHOUSE)),
    ).toContain("confirm");
    expect(allowedReturnReceiptActions({ status: "DRAFT", cartons: [{}] }, as(SALES))).toEqual([]);
    expect(allowedReturnReceiptActions({ status: "CLOSED", cartons: [{}] }, as(WAREHOUSE))).toEqual(
      [],
    );
  });
});
