import { renderHook } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it } from "vitest";

import { useOrderExtraFilters } from "./useOrderExtraFilters";

const CUSTOMER_UUID = "550e8400-e29b-41d4-a716-446655440000";

/** `params` là đầu vào của `useOrders` → cũng là query key của danh sách. */
function filtersAt(searchParams: string) {
  const { result } = renderHook(() => useOrderExtraFilters(() => {}), {
    wrapper: withNuqsTestingAdapter({ searchParams }),
  });
  return result.current;
}

describe("useOrderExtraFilters — chỉ tham số BE GET /orders nhận mới vào params / query key", () => {
  it("customer UUID hợp lệ → vào params, bộ lọc đang bật", () => {
    const extra = filtersAt(`?customer=${CUSTOMER_UUID}`);
    expect(extra.params.customerId).toBe(CUSTOMER_UUID);
    expect(extra.customerIdInvalid).toBe(false);
    expect(extra.active).toBe(true);
  });

  it("customer sai trên URL → giữ để ô nhập báo lỗi, nhưng KHÔNG vào params / query key", () => {
    const extra = filtersAt("?customer=CUS-0007");
    expect(extra.customerInput).toBe("CUS-0007");
    expect(extra.customerIdInvalid).toBe(true);
    expect(extra.params.customerId).toBeUndefined();
    expect(extra.customerId).toBe("");
    expect(extra.active).toBe(false);
  });

  it("không có customer → không lỗi, không lọc", () => {
    const extra = filtersAt("");
    expect(extra.customerIdInvalid).toBe(false);
    expect(extra.params.customerId).toBeUndefined();
  });

  it("?term / ?paymentTerm cũ bị bỏ qua — không có trong params, không bật bộ lọc", () => {
    const extra = filtersAt("?term=CREDIT&paymentTerm=NET_30");
    expect(Object.keys(extra.params).sort()).toEqual(["customerId", "placedFrom", "placedTo"]);
    expect(Object.values(extra.params).every((value) => value === undefined)).toBe(true);
    expect(extra.active).toBe(false);
  });
});
