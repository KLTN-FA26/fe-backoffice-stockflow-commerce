import { describe, expect, it } from "vitest";

import { bePo, bePoLine } from "./__fixtures__/render";
import { mapBePoToFe } from "./mappers";
import { beDeliveryDecisionSchema, bePurchaseOrderSchema, beSupplierSpendSchema } from "./schemas";

/** PurchaseOrderResponse của BE (Jackson: BigDecimal → số, có thể là chuỗi). */
function beResponse(overrides: Record<string, unknown> = {}) {
  return bePo({
    status: "PARTIALLY_RECEIVED",
    lines: [
      bePoLine({
        description: "3 Seater Sofa",
        quantityReceived: 4,
        openQuantity: 6,
        unitPrice: "100000.00",
        taxRate: "8.00",
        lineTotal: "1000000.00",
        status: "PARTIALLY_RECEIVED",
      }),
    ],
    orderDate: "2026-09-30",
    // 17:30 UTC = 00:30 hôm sau theo Asia/Ho_Chi_Minh
    createdAt: "2026-09-29T17:30:00Z",
    sentAt: "2026-09-30T02:00:00Z",
    supplierConfirmationStatus: "CONFIRMED",
    deliveryStatus: "DELIVERED",
    ...overrides,
  });
}

describe("bePurchaseOrderSchema (parse tại biên API)", () => {
  it("nhận response BE và đổi BigDecimal dạng chuỗi thành số", () => {
    expect(bePurchaseOrderSchema.parse(beResponse()).lines[0]?.unitPrice).toBe(100000);
  });

  it("chặn status ngoài 8 mã BE D4 (không để từ vựng Title Case lọt qua)", () => {
    expect(
      bePurchaseOrderSchema.safeParse(beResponse({ status: "Pending Approval" })).success,
    ).toBe(false);
    // Mã cũ trước D4 không còn hợp lệ.
    expect(bePurchaseOrderSchema.safeParse(beResponse({ status: "SENT" })).success).toBe(false);
  });

  it("chặn số tiền không phải số thay vì âm thầm đổi thành 0", () => {
    expect(bePurchaseOrderSchema.safeParse(beResponse({ totalAmount: "abc" })).success).toBe(false);
  });

  it("deliveryStatus BE mới chưa biết → UNKNOWN (không làm hỏng cả trang)", () => {
    expect(
      bePurchaseOrderSchema.parse(beResponse({ deliveryStatus: "BOUNCED" })).deliveryStatus,
    ).toBe("UNKNOWN");
  });

  it("chặn supplierConfirmationStatus ngoài hợp đồng", () => {
    expect(
      bePurchaseOrderSchema.safeParse(beResponse({ supplierConfirmationStatus: "MAYBE" })).success,
    ).toBe(false);
  });
});

describe("mapBePoToFe", () => {
  const po = mapBePoToFe(bePurchaseOrderSchema.parse(beResponse()));

  it("giữ openQuantity và description của dòng BE", () => {
    expect(po.lines[0]).toMatchObject({
      skuId: "SOFA-3S-GREY",
      description: "3 Seater Sofa",
      orderedQty: 10,
      receivedQty: 4,
      openQuantity: 6,
      taxRate: 8,
      lineTotal: 1000000,
      status: "PARTIALLY_RECEIVED",
    });
  });

  it("dùng totalAmount của BE làm tổng, kèm điều khoản + trạng thái gửi NCC", () => {
    expect(po).toMatchObject({
      grandTotal: 1000000,
      paymentTermDays: 30,
      leadTimeDays: 7,
      deliveryStatus: "DELIVERED",
      supplierConfirmationStatus: "CONFIRMED",
      sentAt: "2026-09-30T02:00:00Z",
    });
  });

  it("orderDate lấy thẳng từ BE (LocalDate), không suy từ createdAt", () => {
    expect(po.orderDate).toBe("2026-09-30");
  });

  it("mang kho nhận, NCC, tổng trước thuế / thuế và revision", () => {
    expect(po).toMatchObject({
      type: "STANDARD",
      warehouseId: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
      warehouseName: "Kho Hồ Chí Minh",
      supplierName: "Gỗ Hòa Phát",
      subtotal: 1000000,
      taxTotal: 0,
      revisionNo: 0,
    });
  });

  it("giữ NGUYÊN tiền tệ BE trả (EUR không bị đổi thành VND)", () => {
    const eur = mapBePoToFe(bePurchaseOrderSchema.parse(beResponse({ currency: "EUR" })));
    expect(eur.currency).toBe("EUR");
    expect(eur.lines[0]?.currency).toBe("EUR");
  });

  it("đóng thiếu: CLOSED + closeKind SHORT_CLOSE, trả lý do đóng", () => {
    const closed = mapBePoToFe(
      bePurchaseOrderSchema.parse(
        beResponse({ status: "CLOSED", closeKind: "SHORT_CLOSE", closeReason: "NCC hết hàng" }),
      ),
    );
    expect(closed).toMatchObject({ closeKind: "SHORT_CLOSE", rejectionReason: "NCC hết hàng" });
  });

  it("chịu được field BE null", () => {
    const po2 = mapBePoToFe(
      bePurchaseOrderSchema.parse(
        beResponse({ expectedAt: null, createdBy: null, sentAt: null, lines: [] }),
      ),
    );
    expect(po2).toMatchObject({ expectedDate: "", createdBy: "", sentAt: undefined });
  });
});

describe("beSupplierSpendSchema (BE #40: theo tiền tệ)", () => {
  const row = {
    supplierId: "s-1",
    supplierCode: "GOHOAPHAT",
    supplierName: "Gỗ Hòa Phát",
    totalSpend: "2500.50",
    purchaseOrderCount: 2,
  };

  it("có field currency (BE #40)", () => {
    expect(beSupplierSpendSchema.parse({ ...row, currency: "USD" }).currency).toBe("USD");
  });

  it("vẫn nhận response BE cũ chưa có currency", () => {
    expect(beSupplierSpendSchema.parse(row).totalSpend).toBe(2500.5);
  });
});

describe("beDeliveryDecisionSchema (BE PurchaseOrderDeliveryDecisionResponse)", () => {
  const decision = {
    id: "dec-1",
    generation: 0,
    previousExpectedAt: null,
    expectedAt: "2026-10-09",
    reason: null,
    reconciled: false,
    acknowledgePastDue: false,
    channel: "EMAIL",
    recipient: "po@ncc.vn",
    actor: "procurement",
    requestedAt: "2026-10-01T03:00:00Z",
  };

  it("nhận quyết định gửi lần đầu (không lý do, chưa có ngày cũ)", () => {
    expect(beDeliveryDecisionSchema.parse(decision).generation).toBe(0);
  });

  it("chặn response thiếu cờ đối chiếu (sai hợp đồng)", () => {
    const { reconciled: _omit, ...broken } = decision;
    void _omit;
    expect(beDeliveryDecisionSchema.safeParse(broken).success).toBe(false);
  });
});

describe("field mới của BE #36 (9fbb90f)", () => {
  it("cancellationDeliveryStatus + warnings được parse và map", () => {
    const po = mapBePoToFe(
      bePurchaseOrderSchema.parse(
        beResponse({ cancellationDeliveryStatus: "QUEUED", warnings: ["DELIVERY_DATE_IN_PAST"] }),
      ),
    );
    expect(po).toMatchObject({
      cancellationDeliveryStatus: "QUEUED",
      warnings: ["DELIVERY_DATE_IN_PAST"],
    });
  });

  it("BE chưa có #36 (thiếu field) vẫn chạy; giá trị lạ → UNKNOWN", () => {
    const old = mapBePoToFe(bePurchaseOrderSchema.parse(beResponse()));
    expect(old.cancellationDeliveryStatus).toBeUndefined();
    expect(old.warnings).toEqual([]);
    expect(
      bePurchaseOrderSchema.parse(beResponse({ cancellationDeliveryStatus: "BOUNCED" }))
        .cancellationDeliveryStatus,
    ).toBe("UNKNOWN");
  });
});
