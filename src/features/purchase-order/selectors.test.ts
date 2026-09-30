import { describe, expect, it } from "vitest";

import {
  openQuantity,
  shouldFlagPoRow,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
  validateReceiveDraft,
} from "./selectors";

import type { PoLine, PurchaseOrder } from "./types";

function line(lineId: string, openQuantity: number): PoLine {
  return {
    lineId,
    poId: "po-1",
    skuId: `SKU-${lineId}`,
    orderedQty: 10,
    receivedQty: 10 - openQuantity,
    openQuantity,
    unitPrice: 1000,
    currency: "VND",
    lineTotal: 10000,
  };
}

describe("validateReceiveDraft — BR-04 (docs 02 §6), dung sai = 0 theo BE (open-question C9)", () => {
  const lines = [line("a", 6), line("b", 3)];

  it("keeps valid lines and skips empty inputs", () => {
    expect(validateReceiveDraft(lines, { a: "4", b: "" })).toEqual({
      lines: [{ lineId: "a", quantity: 4 }],
      errors: {},
    });
  });

  it("accepts exactly the open quantity", () => {
    expect(validateReceiveDraft(lines, { a: "6" }).lines).toEqual([{ lineId: "a", quantity: 6 }]);
  });

  it("BR-04: SL nhận vượt openQuantity bị chặn, có lỗi inline", () => {
    const result = validateReceiveDraft(lines, { a: "20" });
    expect(result.lines).toEqual([]);
    expect(result.errors.a).toContain("6");
  });

  it.each(["0", "-1", "1.5", "abc"])("rejects %s", (raw) => {
    expect(validateReceiveDraft(lines, { b: raw }).errors.b).toBeDefined();
  });

  it("returns nothing to send when every input is empty", () => {
    expect(validateReceiveDraft(lines, {})).toEqual({ lines: [], errors: {} });
  });
});

describe("PO quantity selectors", () => {
  const po: PurchaseOrder = {
    poId: "po-1",
    poNumber: "PO-1",
    supplierId: "sup-1",
    warehouseId: null,
    status: "PARTIALLY_RECEIVED",
    currency: "VND",
    orderDate: "2026-09-30",
    expectedDate: "",
    createdBy: "tester",
    grandTotal: 20000,
    lines: [line("a", 6), line("b", 0)],
  };

  it("openQuantity reads the BE value instead of recomputing", () => {
    expect(openQuantity({ ...line("a", 2), receivedQty: 0 })).toBe(2);
  });

  it("sums ordered / received / open quantities across lines", () => {
    expect(totalOrderedQuantity(po)).toBe(20);
    expect(totalReceivedQuantity(po)).toBe(14);
    expect(totalOpenQuantity(po)).toBe(6);
  });

  it("flags only CANCELLED rows", () => {
    expect(shouldFlagPoRow({ ...po, status: "CANCELLED" })).toBe(true);
    expect(shouldFlagPoRow(po)).toBe(false);
  });
});
