/**
 * Contract test — zod parse đúng hình JSON BE (Jackson non_null: key null bị BỎ HẲN).
 * credit-hold: BE CreditHoldResponse (SCRUM-427). production-order: hợp đồng đã thống nhất
 * (CONTRACT PENDING — field theo cột DB production.production_order).
 */

import { describe, expect, it } from "vitest";

import { apiCreditPosition, apiOrder } from "./__fixtures__/order";
import {
  creditHoldDtoSchema,
  creditHoldPageDtoSchema,
  creditPositionDtoSchema,
} from "./credit-hold-schemas";
import { productionOrderDtoSchema, productionOrderPageDtoSchema } from "./production-schemas";
import { orderDtoSchema, orderStatusChangeDtoSchema } from "./schemas";

const hold = {
  order: { ...apiOrder, status: "ON_HOLD", paymentTerm: "CREDIT" },
  checkedAt: "2026-09-07T03:16:00Z",
  creditLimit: 1_000_000,
  exposure: 800_000,
  orderAmount: 350_000,
};

describe("CreditHoldResponse", () => {
  it("parse đơn lồng + số liệu hạn mức", () => {
    expect(creditHoldDtoSchema.parse(hold).order.paymentTerm).toBe("CREDIT");
  });

  it("thiếu số liệu bắt buộc (creditLimit) → fail — bug contract", () => {
    const { creditLimit: _omit, ...rest } = hold;
    void _omit;
    expect(creditHoldDtoSchema.safeParse(rest).success).toBe(false);
  });

  it("PageResponse trang từ 0", () => {
    const page = creditHoldPageDtoSchema.parse({
      items: [hold],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items).toHaveLength(1);
  });
});

/** Dòng danh sách BE không mang `paymentTerm` ("null on list rows that do not carry it" → key vắng). */
const { paymentTerm: _listRowOmits, ...listRow } = apiOrder;
void _listRowOmits;

describe("OrderResponse — field SCRUM-423/427/460", () => {
  it("dòng danh sách không mang paymentTerm / payment fields (key vắng) → vẫn parse", () => {
    expect(orderDtoSchema.safeParse(listRow).success).toBe(true);
  });

  it("paymentStatus: lạ → UNKNOWN; đã biết giữ nguyên; null giữ null; vắng key giữ undefined", () => {
    const parse = (paymentStatus: unknown) =>
      orderDtoSchema.parse({ ...apiOrder, paymentStatus }).paymentStatus;
    expect(parse("REFUNDED")).toBe("UNKNOWN");
    expect(parse("PARTIALLY_PAID")).toBe("PARTIALLY_PAID");
    expect(parse(null)).toBeNull();
    expect(orderDtoSchema.parse(apiOrder).paymentStatus).toBeUndefined();
  });

  it("paymentTerm: lạ → null (KHÔNG UNKNOWN); đã biết giữ nguyên; null → null; vắng → undefined", () => {
    const parse = (paymentTerm: unknown) =>
      orderDtoSchema.parse({ ...apiOrder, paymentTerm }).paymentTerm;
    expect(parse("COD")).toBeNull();
    expect(parse("INSTALLMENT")).toBeNull();
    for (const term of ["PREPAID", "DEPOSIT", "CREDIT"] as const) expect(parse(term)).toBe(term);
    expect(parse(null)).toBeNull();
    // Vắng key (Jackson non_null) → undefined ở DTO; toOrder chuẩn hoá về null (api.test)
    expect(orderDtoSchema.parse(listRow).paymentTerm).toBeUndefined();
  });

  it("sai KIỂU (không phải chuỗi) vẫn fail — chỉ chuỗi lạ mới được dung thứ", () => {
    expect(orderDtoSchema.safeParse({ ...apiOrder, status: 3 }).success).toBe(false);
    expect(orderDtoSchema.safeParse({ ...apiOrder, paymentTerm: 1 }).success).toBe(false);
    expect(orderDtoSchema.safeParse({ ...apiOrder, paymentStatus: true }).success).toBe(false);
  });

  it("đơn credit hold lồng status lạ → order.status UNKNOWN, cả bản ghi vẫn parse", () => {
    expect(
      creditHoldDtoSchema.parse({ ...hold, order: { ...hold.order, status: "PAYMENT_FAILED" } })
        .order.status,
    ).toBe("UNKNOWN");
  });

  it("history: trạng thái PR #133 giữ nguyên; from / to lạ (hoặc mã đã bỏ) → UNKNOWN; from null giữ null", () => {
    const at = "2026-09-07T03:15:00Z";
    expect(
      orderStatusChangeDtoSchema.parse({ from: "PACKED", to: "SHIPPED", occurredAt: at }).from,
    ).toBe("PACKED");
    expect(
      orderStatusChangeDtoSchema.parse({ from: "CONFIRMED", to: "PICKING", occurredAt: at }).to,
    ).toBe("PICKING");
    expect(
      orderStatusChangeDtoSchema.parse({ from: "IN_FULFILMENT", to: "SHIPPED", occurredAt: at })
        .from,
    ).toBe("UNKNOWN");
    expect(
      orderStatusChangeDtoSchema.parse({ from: "CONFIRMED", to: "REVIEWING", occurredAt: at }).to,
    ).toBe("UNKNOWN");
    expect(
      orderStatusChangeDtoSchema.parse({ from: null, to: "PENDING_PAYMENT", occurredAt: at }).from,
    ).toBeNull();
    // `to` bắt buộc: vắng → vẫn fail
    expect(orderStatusChangeDtoSchema.safeParse({ from: null, occurredAt: at }).success).toBe(
      false,
    );
  });

  it("history: bước đầu không có key `from`", () => {
    expect(
      orderStatusChangeDtoSchema.parse({
        to: "PENDING_PAYMENT",
        occurredAt: "2026-09-07T03:15:00Z",
      }).from,
    ).toBeUndefined();
  });
});

describe("ProductionOrderRowResponse (GET /production/orders, BE develop 5683fe14)", () => {
  // Hình thật của BE row (Jackson non_null: parentId / holdReason / dueDate / packingLocation vắng)
  const parent = {
    id: "0b0b0b0b-0000-4000-8000-000000000001",
    orderNumber: "LSX-20261020-0001",
    type: "ORDER",
    mode: "IN_HOUSE",
    status: "PENDING_PREPRESS",
    warehouseId: "8f8f8f8f-0000-4000-8000-000000000001",
    blankSku: "CUP-12OZ-WHT",
    designSnapshotId: "c0ffee00-0000-4000-8000-000000000001",
    plannedQuantity: 100,
    goodQuantity: 0,
    salesOrderId: "5e5e5e5e-0000-4000-8000-000000000001",
    salesOrderLineId: "5e5e5e5e-0000-4000-8000-000000000002",
    createdAt: "2026-10-20T03:00:00Z",
  };
  const page = (items: unknown[]) => ({
    items,
    page: 0,
    size: 200,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  });

  it("LSX gốc: field null bị bỏ khỏi JSON (non_null) vẫn parse; field thừa của BE bị bỏ", () => {
    const parsed = productionOrderDtoSchema.parse(parent);
    expect(parsed.parentId).toBeUndefined();
    expect(parsed).not.toHaveProperty("blankSku");
  });

  it("trang PageResponse: LSX con gia công + treo (parentId, holdReason)", () => {
    const parsed = productionOrderPageDtoSchema.parse(
      page([
        parent,
        {
          ...parent,
          id: "0b0b0b0b-0000-4000-8000-000000000002",
          orderNumber: "LSX-20261020-0002",
          parentId: parent.id,
          mode: "SUBCONTRACTED",
          status: "ON_HOLD",
          holdReason: "SUBCONTRACTOR_LATE",
        },
      ]),
    );
    expect(parsed.items[1]?.parentId).toBe(parent.id);
    expect(parsed.items[1]?.holdReason).toBe("SUBCONTRACTOR_LATE");
  });

  it("trang rỗng (salesOrderId không có LSX) là hợp lệ", () => {
    expect(productionOrderPageDtoSchema.parse(page([])).items).toEqual([]);
  });

  it("status / mode / type ngoài enum BE → fail; mảng trần (hợp đồng mock cũ) → fail", () => {
    expect(productionOrderDtoSchema.safeParse({ ...parent, status: "DONE" }).success).toBe(false);
    expect(productionOrderDtoSchema.safeParse({ ...parent, mode: "OUTSOURCE" }).success).toBe(
      false,
    );
    expect(productionOrderDtoSchema.safeParse({ ...parent, type: "RUSH" }).success).toBe(false);
    expect(productionOrderPageDtoSchema.safeParse([parent]).success).toBe(false);
  });
});

describe("CreditPositionResponse (GET /orders/credit-position/{customerId})", () => {
  it("B. parse đúng hình BE; khách chỉ trả trước: field null bị bỏ khỏi JSON vẫn parse", () => {
    expect(creditPositionDtoSchema.parse(apiCreditPosition)).toMatchObject({
      allowedTerms: ["PREPAID", "DEPOSIT", "CREDIT"],
      depositPercent: 40,
      availableCredit: 200_000,
      hasOverdue: false,
    });
    const prepaidOnly = {
      customerId: apiOrder.customerId,
      allowedTerms: ["PREPAID"],
      defaultTerm: "PREPAID",
      exposure: 0,
      currency: "VND",
      hasOverdue: false,
    };
    const parsed = creditPositionDtoSchema.parse(prepaidOnly);
    expect(parsed.depositPercent).toBeUndefined();
    expect(parsed.creditLimit).toBeUndefined();
    expect(parsed.availableCredit).toBeUndefined();
  });

  it("C. thiếu field bắt buộc (exposure / currency / hasOverdue / allowedTerms) → fail", () => {
    for (const key of ["exposure", "currency", "hasOverdue", "allowedTerms", "customerId"]) {
      const broken: Record<string, unknown> = { ...apiCreditPosition };
      delete broken[key];
      expect(creditPositionDtoSchema.safeParse(broken).success, key).toBe(false);
    }
  });

  it("mã phương thức FE chưa biết bị bỏ khỏi allowedTerms / defaultTerm — không thành lựa chọn", () => {
    const parsed = creditPositionDtoSchema.parse({
      ...apiCreditPosition,
      allowedTerms: ["PREPAID", "INSTALLMENT"],
      defaultTerm: "INSTALLMENT",
    });
    expect(parsed.allowedTerms).toEqual(["PREPAID"]);
    expect(parsed.defaultTerm).toBeNull();
  });
});
