import { describe, expect, it } from "vitest";

import { mapBePoToFe } from "./mappers";
import { bePurchaseOrderSchema } from "./schemas";

/** Shape of BE PurchaseOrderResponse as serialised by Jackson (BigDecimal → number). */
function beResponse(overrides: Record<string, unknown> = {}) {
  return {
    purchaseOrderId: "11111111-1111-4111-8111-111111111111",
    poNumber: "PO-20260930-000001",
    supplierId: "22222222-2222-4222-8222-222222222222",
    status: "PARTIALLY_RECEIVED",
    currency: "VND",
    totalAmount: 1000000,
    expectedAt: "2026-10-07",
    lines: [
      {
        lineId: "33333333-3333-4333-8333-333333333333",
        sku: "SOFA-3S-GREY",
        description: "3 Seater Sofa",
        quantityOrdered: 10,
        quantityReceived: 4,
        openQuantity: 6,
        unitPrice: "100000.00",
      },
    ],
    // 17:30 UTC = 00:30 next day in Asia/Ho_Chi_Minh
    createdAt: "2026-09-29T17:30:00Z",
    createdBy: "procurement@stockflow.local",
    lastModifiedAt: "2026-09-29T17:30:00Z",
    lastModifiedBy: "procurement@stockflow.local",
    possibleDuplicate: false,
    cancellationReason: null,
    closeShortReason: null,
    ...overrides,
  };
}

describe("bePurchaseOrderSchema (parse at the API boundary)", () => {
  it("accepts the BE response and coerces BigDecimal strings", () => {
    const parsed = bePurchaseOrderSchema.parse(beResponse());
    expect(parsed.lines[0]?.unitPrice).toBe(100000);
  });

  it("rejects a status outside the 7 BE values (legacy Title Case never gets through)", () => {
    expect(
      bePurchaseOrderSchema.safeParse(beResponse({ status: "Pending Approval" })).success,
    ).toBe(false);
  });

  it("rejects a non-numeric amount instead of silently turning it into 0", () => {
    expect(bePurchaseOrderSchema.safeParse(beResponse({ totalAmount: "abc" })).success).toBe(false);
  });
});

describe("mapBePoToFe", () => {
  const po = mapBePoToFe(bePurchaseOrderSchema.parse(beResponse()));

  it("keeps openQuantity and description from the BE line", () => {
    expect(po.lines[0]).toMatchObject({
      skuId: "SOFA-3S-GREY",
      description: "3 Seater Sofa",
      orderedQty: 10,
      receivedQty: 4,
      openQuantity: 6,
      lineTotal: 1000000,
    });
  });

  it("uses BE totalAmount as grand total", () => {
    expect(po.grandTotal).toBe(1000000);
  });

  it("derives orderDate in Asia/Ho_Chi_Minh, not UTC", () => {
    expect(po.orderDate).toBe("2026-09-30");
  });

  it("does not invent a warehouse (BE PO has none yet)", () => {
    expect(po.warehouseId).toBeNull();
  });

  it("surfaces the close-short reason", () => {
    const closed = mapBePoToFe(
      bePurchaseOrderSchema.parse(
        beResponse({ status: "CLOSED_SHORT", closeShortReason: "NCC hết hàng" }),
      ),
    );
    expect(closed.rejectionReason).toBe("NCC hết hàng");
  });

  it("handles nullable BE fields and an unsupported currency", () => {
    const po2 = mapBePoToFe(
      bePurchaseOrderSchema.parse(
        beResponse({ currency: "EUR", expectedAt: null, createdBy: null, lines: [] }),
      ),
    );
    expect(po2).toMatchObject({ currency: "VND", expectedDate: "", createdBy: "" });
  });
});
