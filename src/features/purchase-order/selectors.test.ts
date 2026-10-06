import { describe, expect, it } from "vitest";

import {
  deliveryFailureName,
  linesMissingDescription,
  isDeliveryFailing,
  deliveryRound,
  isFirstDelivery,
  isExpectedDatePast,
  openQuantity,
  shouldFlagPoRow,
  suggestExpectedDate,
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
    status: "PARTIALLY_RECEIVED",
    currency: "VND",
    orderDate: "2026-09-30",
    expectedDate: "",
    createdBy: "tester",
    grandTotal: 20000,
    paymentTermDays: 30,
    leadTimeDays: 7,
    supplierConfirmationStatus: "CONFIRMED",
    deliveryStatus: "DELIVERED",
    warnings: [],
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

describe("BR-06 (docs 02 §6) — ngày giao dự kiến so với HÔM NAY, chỉ cảnh báo", () => {
  // Tái hiện review: ngày giao 20/9 đã qua; trước đây đổi "ngày đặt" về 10/9 làm mất cảnh báo.
  it("ngày giao trước hôm nay → quá hạn", () => {
    expect(isExpectedDatePast("2026-09-20", "2026-10-02")).toBe(true);
  });

  it("hôm nay hoặc sau đó → không cảnh báo; chưa nhập ngày → không cảnh báo", () => {
    expect(isExpectedDatePast("2026-10-02", "2026-10-02")).toBe(false);
    expect(isExpectedDatePast("2026-10-09", "2026-10-02")).toBe(false);
    expect(isExpectedDatePast("", "2026-10-02")).toBe(false);
  });
});

describe("suggestExpectedDate — hôm nay + leadTimeDays của NCC", () => {
  it("cộng ngày, kể cả qua tháng", () => {
    expect(suggestExpectedDate("2026-10-02", 7)).toBe("2026-10-09");
    expect(suggestExpectedDate("2026-10-28", 7)).toBe("2026-11-04");
  });
});

describe("lượt gửi NCC (BE generation đếm từ 0)", () => {
  it("generation 0 là gửi lần đầu, ≥1 là khôi phục gửi", () => {
    expect(isFirstDelivery(0)).toBe(true);
    expect(isFirstDelivery(1)).toBe(false);
  });

  it("hiển thị lượt đếm từ 1", () => {
    expect(deliveryRound(0)).toBe(1);
    expect(deliveryRound(2)).toBe(3);
  });
});

describe('deliveryFailureName (failure BE: "<reference>: <Exception>")', () => {
  it("bỏ reference chứa UUID, chỉ giữ tên lỗi", () => {
    expect(deliveryFailureName("purchase-order:1f2e-3d: MailSendException")).toBe(
      "MailSendException",
    );
  });

  it("null/rỗng → null", () => {
    expect(deliveryFailureName(null)).toBeNull();
    expect(deliveryFailureName("")).toBeNull();
  });
});

describe("isDeliveryFailing (BE deliveryStatus)", () => {
  it("RETRYING / FAILED là chưa tới NCC; các trạng thái khác thì không", () => {
    expect(isDeliveryFailing({ deliveryStatus: "FAILED" })).toBe(true);
    expect(isDeliveryFailing({ deliveryStatus: "RETRYING" })).toBe(true);
    expect(isDeliveryFailing({ deliveryStatus: "QUEUED" })).toBe(false);
    expect(isDeliveryFailing({ deliveryStatus: "DELIVERED" })).toBe(false);
  });
});

describe("linesMissingDescription (BE #36 PO_LINE_DESCRIPTION_REQUIRED khi gửi)", () => {
  it("chỉ trả các dòng mô tả trống / toàn khoảng trắng", () => {
    const lines: PoLine[] = [
      { ...line("a", 1), description: "Sofa" },
      { ...line("b", 1), description: "  " },
      { ...line("c", 1), description: undefined },
    ];
    expect(linesMissingDescription({ lines }).map((l) => l.lineId)).toEqual(["b", "c"]);
  });
});
