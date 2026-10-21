import { describe, expect, it } from "vitest";

import { shouldFlagOrderRow } from "./selectors";

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
