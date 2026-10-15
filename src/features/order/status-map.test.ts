import { describe, expect, it } from "vitest";

import { ORDER_PAYMENT_STATUS_DISPLAY, ORDER_STATUSES } from "@/constants";
import { STATUS_LABEL_VI, toneOf } from "@/lib/status-map";

import { BACKEND_ORDER_STATUSES } from "./schemas";
import { mapBackendOrderStatus, toBackendOrderStatuses } from "./status-map";

describe("order status-map — đọc dung thứ, gửi chỉ mã đã biết", () => {
  it("mọi mã BE đã biết ↔ trạng thái FE 1-1, đi về không mất giá trị", () => {
    const fe = BACKEND_ORDER_STATUSES.map(mapBackendOrderStatus);
    expect(fe).toEqual([...ORDER_STATUSES]);
    expect(toBackendOrderStatuses(ORDER_STATUSES)).toEqual([...BACKEND_ORDER_STATUSES]);
  });

  it("UNKNOWN đọc về giữ nguyên UNKNOWN", () => {
    expect(mapBackendOrderStatus("UNKNOWN")).toBe("UNKNOWN");
    expect(BACKEND_ORDER_STATUSES).not.toContain("UNKNOWN");
  });

  it("UNKNOWN đơn + thanh toán dùng quy ước chung: tone muted, nhãn 'Không rõ'", () => {
    for (const status of [mapBackendOrderStatus("UNKNOWN"), ORDER_PAYMENT_STATUS_DISPLAY.UNKNOWN]) {
      expect(toneOf(status)).toBe("muted");
      expect(STATUS_LABEL_VI[status]).toBe("Không rõ");
    }
  });
});
