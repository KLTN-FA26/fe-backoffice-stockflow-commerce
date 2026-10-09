import { describe, expect, it } from "vitest";

import {
  deliveryFailureName,
  linesMissingDescription,
  deliveryAlert,
  isDeliveryFailing,
  isDeliveryInFlight,
  deliveryRound,
  isFirstDelivery,
  isExpectedDatePast,
  openQuantity,
  poAttentionReason,
  shouldFlagPoRow,
  suggestExpectedDate,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
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
    uom: "EACH",
    taxRate: 0,
    lineTotal: 10000,
    status: openQuantity === 0 ? "RECEIVED" : "PARTIALLY_RECEIVED",
  };
}

describe("PO quantity selectors", () => {
  const po: PurchaseOrder = {
    poId: "po-1",
    poNumber: "PO-1",
    type: "STANDARD",
    supplierId: "sup-1",
    warehouseId: "wh-1",
    revisionNo: 0,
    subtotal: 20000,
    taxTotal: 0,
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

  it("đánh dấu đơn cần xử lý: gửi NCC thất bại / NCC từ chối (chỉ khi còn CONFIRMED)", () => {
    const sent = {
      ...po,
      status: "CONFIRMED" as const,
      supplierConfirmationStatus: "PENDING" as const,
    };
    expect(poAttentionReason({ ...sent, deliveryStatus: "FAILED" })).toBe("deliveryFailed");
    expect(
      poAttentionReason({
        ...sent,
        deliveryStatus: "DELIVERED",
        supplierConfirmationStatus: "REJECTED",
      }),
    ).toBe("supplierRejected");
    expect(shouldFlagPoRow({ ...sent, deliveryStatus: "FAILED" })).toBe(true);
    // Đang thử lại / đã gửi → chưa cần người xử lý
    expect(shouldFlagPoRow({ ...sent, deliveryStatus: "RETRYING" })).toBe(false);
    expect(shouldFlagPoRow({ ...sent, deliveryStatus: "DELIVERED" })).toBe(false);
    // Đã huỷ là kết thúc — không đánh dấu, kể cả lần gửi từng thất bại
    expect(shouldFlagPoRow({ ...po, status: "CANCELLED", deliveryStatus: "FAILED" })).toBe(false);
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

describe("deliveryAlert — cảnh báo thẻ Gửi NCC theo điều kiện khôi phục của BE", () => {
  const sent = { status: "CONFIRMED", supplierConfirmationStatus: "PENDING" } as const;
  it("thất bại hẳn + còn khôi phục được → recoverable; BE đang tự gửi lại → retrying", () => {
    expect(deliveryAlert({ ...sent, deliveryStatus: "FAILED" })).toBe("recoverable");
    expect(deliveryAlert({ ...sent, deliveryStatus: "RETRYING" })).toBe("retrying");
    expect(deliveryAlert({ ...sent, deliveryStatus: "DELIVERED" })).toBeNull();
  });
  it("không còn khôi phục được (đã huỷ / NCC đã phản hồi) → không cảnh báo", () => {
    expect(deliveryAlert({ ...sent, status: "CANCELLED", deliveryStatus: "FAILED" })).toBeNull();
    expect(
      deliveryAlert({ ...sent, supplierConfirmationStatus: "CONFIRMED", deliveryStatus: "FAILED" }),
    ).toBeNull();
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

describe("isDeliveryInFlight (tự tải lại khi đang gửi)", () => {
  it("thư gửi đơn hoặc thư báo huỷ đang QUEUED/RETRYING → đang gửi", () => {
    expect(isDeliveryInFlight({ deliveryStatus: "QUEUED" })).toBe(true);
    expect(isDeliveryInFlight({ deliveryStatus: "RETRYING" })).toBe(true);
    expect(
      isDeliveryInFlight({ deliveryStatus: "DELIVERED", cancellationDeliveryStatus: "QUEUED" }),
    ).toBe(true);
    expect(
      isDeliveryInFlight({ deliveryStatus: "DELIVERED", cancellationDeliveryStatus: "DELIVERED" }),
    ).toBe(false);
    expect(isDeliveryInFlight({ deliveryStatus: "FAILED" })).toBe(false);
    expect(isDeliveryInFlight(undefined)).toBe(false);
  });
});
