import { describe, expect, it } from "vitest";

import { ORDER_CANCELLATION_REQUEST_EXPIRED_NOTE } from "@/constants";

import {
  cancellationRequestNote,
  cancellationRequestStatusLabel,
  shouldFlagOrderRow,
} from "./selectors";

import type { OrderStatus } from "./types";

describe("shouldFlagOrderRow — ngoại lệ chờ nhân viên quyết (lead 22/10)", () => {
  it.each<OrderStatus>(["On Hold", "Delivery Failed", "Partially Fulfilled", "Return Requested"])(
    "%s → có viền cảnh báo",
    (status) => {
      expect(shouldFlagOrderRow({ status })).toBe(true);
    },
  );

  it.each<OrderStatus>([
    "Pending Payment",
    "Confirmed",
    "Picking",
    "Packed",
    "Shipped",
    "Delivered",
    "Returned",
    "Cancelled",
    "Completed",
  ])("%s → không cảnh báo", (status) => {
    expect(shouldFlagOrderRow({ status })).toBe(false);
  });
});

describe("yêu cầu huỷ đơn — nhãn trạng thái (BE CancellationRequestStatus, EXPIRED từ BE PR #144)", () => {
  it("có nhãn tiếng Việt cho cả bốn trạng thái", () => {
    expect(cancellationRequestStatusLabel("PENDING")).toBe("Chờ xử lý");
    expect(cancellationRequestStatusLabel("APPROVED")).toBe("Đã duyệt");
    expect(cancellationRequestStatusLabel("REJECTED")).toBe("Đã từ chối");
    expect(cancellationRequestStatusLabel("EXPIRED")).toBe("Đã hết hạn");
  });

  it("mã lạ BE thêm sau hiện nguyên văn thay vì lỗi", () => {
    expect(cancellationRequestStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
    expect(cancellationRequestStatusLabel("toString")).toBe("toString");
  });

  it("EXPIRED hiện câu tiếng Việt thay cho ghi chú tiếng Anh của hệ thống; trạng thái khác giữ ghi chú", () => {
    expect(
      cancellationRequestNote(
        "EXPIRED",
        "Closed: the order is PACKED and can no longer be cancelled",
      ),
    ).toBe(ORDER_CANCELLATION_REQUEST_EXPIRED_NOTE);
    expect(cancellationRequestNote("EXPIRED", null)).toBe(ORDER_CANCELLATION_REQUEST_EXPIRED_NOTE);
    expect(cancellationRequestNote("REJECTED", "Khách đã nhận hàng")).toBe("Khách đã nhận hàng");
    expect(cancellationRequestNote("PENDING", null)).toBeNull();
  });
});
