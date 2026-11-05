import { describe, expect, it } from "vitest";

import {
  DASHBOARD_ORDER_PENDING_FILTER,
  DASHBOARD_ORDER_PENDING_STATUSES,
} from "@/constants/dashboard";

import { BACKEND_TO_FE_ORDER_STATUS } from "./status-map";

describe("tile 'Đơn chờ xử lý' (dashboard) ↔ bộ lọc danh sách đơn", () => {
  it("bộ lọc FE là đúng các trạng thái BE tile đang đếm, cùng thứ tự", () => {
    const expected = DASHBOARD_ORDER_PENDING_STATUSES.map(
      (status) => BACKEND_TO_FE_ORDER_STATUS[status],
    );
    expect(DASHBOARD_ORDER_PENDING_FILTER).toEqual(expected);
  });

  it("gồm ON_HOLD (quyết định 20/10)", () => {
    expect(DASHBOARD_ORDER_PENDING_STATUSES).toContain("ON_HOLD");
    expect(DASHBOARD_ORDER_PENDING_FILTER).toContain("On Hold");
  });
});
