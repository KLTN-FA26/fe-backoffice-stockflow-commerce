import { describe, expect, it } from "vitest";

import { FILTERABLE_STATUSES, STATUS_OPTIONS } from "./constants";

describe("bộ lọc trạng thái danh sách đơn (BE PR #133)", () => {
  it("có đủ 19 trạng thái BE với nhãn tiếng Việt, gồm các trạng thái mới", () => {
    expect(STATUS_OPTIONS).toHaveLength(19);
    const labels = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
    expect(labels).toMatchObject({
      Picking: "Đang lấy hàng",
      Packed: "Đã đóng gói",
      "Partially Fulfilled": "Giao một phần",
      "Delivery Failed": "Giao thất bại",
      "Return Requested": "Yêu cầu trả hàng",
      Refunded: "Đã hoàn tiền",
      "Partially Refunded": "Hoàn tiền một phần",
      Closed: "Đã đóng",
      "On Hold": "Tạm giữ",
      Confirmed: "Đã xác nhận",
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
