import { describe, expect, it } from "vitest";

import { COLUMN_LABELS, DEFAULT_COLUMNS, FILTERABLE_STATUSES, STATUS_OPTIONS } from "./constants";

describe("bộ lọc trạng thái danh sách đơn (BE PR #133)", () => {
  it("có đủ 21 trạng thái BE với nhãn tiếng Việt, gồm các trạng thái mới", () => {
    expect(STATUS_OPTIONS).toHaveLength(21);
    const labels = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
    expect(labels).toMatchObject({
      Picking: "Đang lấy hàng",
      Packed: "Đã đóng gói",
      "Partially Fulfilled": "Giao một phần",
      "Delivery Failed": "Giao thất bại",
      "Return Requested": "Đang yêu cầu trả hàng",
      Refunded: "Đã hoàn tiền",
      "Partially Refunded": "Hoàn tiền một phần",
      Closed: "Đã đóng",
      "On Hold": "Tạm giữ",
      Confirmed: "Đã xác nhận",
      "Pending Contract": "Chờ ký hợp đồng",
      "Awaiting Stock": "Đang chờ hàng",
    });
  });

  it("không còn Paid / In Fulfilment, và không cho lọc theo UNKNOWN", () => {
    const values: readonly string[] = STATUS_OPTIONS.map((o) => o.value);
    expect(values).not.toContain("Paid");
    expect(values).not.toContain("In Fulfilment");
    expect(values).not.toContain("UNKNOWN");
    expect(FILTERABLE_STATUSES).toEqual(STATUS_OPTIONS.map((o) => o.value));
  });
});

describe("cột mặc định (WF-05 BO-08)", () => {
  it("không còn Phương thức TT / trạng thái thanh toán của đơn — BE không trả trên đơn (4B-10)", () => {
    expect(DEFAULT_COLUMNS).not.toContain("paymentTerm");
    expect(DEFAULT_COLUMNS).not.toContain("paymentStatus");
    expect(COLUMN_LABELS).not.toHaveProperty("paymentTerm");
    expect(COLUMN_LABELS).not.toHaveProperty("paymentStatus");
  });

  it("bo-17: cột Thanh toán (đã thu / còn phải thu của các đợt) ẩn được như các cột khác", () => {
    expect(DEFAULT_COLUMNS).toContain("payment");
    expect(COLUMN_LABELS.payment).toBe("Thanh toán");
  });
});
