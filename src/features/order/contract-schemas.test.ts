/**
 * Contract test — zod parse đúng hình JSON BE (Jackson non_null: key null bị BỎ HẲN).
 * credit-hold: BE CreditHoldResponse (SCRUM-427). production-order: hợp đồng đã thống nhất
 * (CONTRACT PENDING — field theo cột DB production.production_order).
 */

import { describe, expect, it } from "vitest";

import { apiOrder } from "./__fixtures__/order";
import { creditHoldDtoSchema, creditHoldPageDtoSchema } from "./credit-hold-schemas";
import { productionOrderDtoSchema, productionOrderListDtoSchema } from "./production-schemas";
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

describe("OrderResponse — field SCRUM-423/427/460", () => {
  it("dòng danh sách không mang paymentTerm / payment fields (key vắng) → vẫn parse", () => {
    expect(orderDtoSchema.safeParse(apiOrder).success).toBe(true);
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
    expect(orderDtoSchema.parse(apiOrder).paymentTerm).toBeUndefined();
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

  it("history: from lạ → UNKNOWN; to lạ → UNKNOWN; from null giữ null", () => {
    const at = "2026-09-07T03:15:00Z";
    expect(
      orderStatusChangeDtoSchema.parse({ from: "PACKED", to: "SHIPPED", occurredAt: at }).from,
    ).toBe("UNKNOWN");
    expect(
      orderStatusChangeDtoSchema.parse({ from: "CONFIRMED", to: "PICKING", occurredAt: at }).to,
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

describe("Production order (CONTRACT PENDING)", () => {
  const parent = {
    productionOrderId: "PRD-1",
    productionOrderNumber: "LSX-1",
    salesOrderLineId: "L1",
    mode: "IN_HOUSE",
    status: "PENDING_PREPRESS",
    plannedQuantity: 100,
    goodQuantity: 0,
  };

  it("LSX gốc: không có parentId / subcontractor (non_null bỏ key)", () => {
    expect(productionOrderDtoSchema.parse(parent).parentId).toBeUndefined();
  });

  it("LSX con gia công + treo (statusBeforeHold, holdReason)", () => {
    const list = productionOrderListDtoSchema.parse([
      parent,
      {
        ...parent,
        productionOrderId: "PRD-1-S1",
        parentId: "PRD-1",
        mode: "SUBCONTRACTED",
        status: "ON_HOLD",
        statusBeforeHold: "SUBCONTRACTED",
        holdReason: "SUBCONTRACTOR_LATE",
        subcontractorName: "NCC A",
      },
    ]);
    expect(list[1]?.parentId).toBe("PRD-1");
  });

  it("status / mode ngoài ràng buộc DB → fail", () => {
    expect(productionOrderDtoSchema.safeParse({ ...parent, status: "DONE" }).success).toBe(false);
    expect(productionOrderDtoSchema.safeParse({ ...parent, mode: "OUTSOURCE" }).success).toBe(
      false,
    );
  });
});
