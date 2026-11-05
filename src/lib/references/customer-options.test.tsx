import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CUSTOMER_OPTIONS_PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { fetchCustomerOptions, fetchCustomerRef, useCustomerOptions } from "./customer-options";

import type { ReactNode } from "react";

afterEach(() => vi.restoreAllMocks());

/** BE `CustomerResponse` (danh sách: mã số thuế bị che; null bị Jackson bỏ). */
const customer = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  customerId: id,
  userId: `u-${id}`,
  fullName: `Khách ${id}`,
  email: `${id}@ex.vn`,
  taxCode: "****5678",
  status,
  version: 0,
  createdAt: "2026-10-01T00:00:00Z",
  ...over,
});
const page = (items: unknown[], over: Record<string, unknown> = {}) => ({
  items,
  page: 0,
  size: CUSTOMER_OPTIONS_PAGE_SIZE,
  totalElements: items.length,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
  ...over,
});
const paramsOf = (get: { mock: { calls: unknown[][] } }) =>
  (get.mock.calls[0]?.[1] as { params: URLSearchParams }).params;

describe("customer lookup (BE GET /customers)", () => {
  it("24 đọc envelope phân trang chuẩn; hasMore theo hasNext", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: page([customer("c1", "ACTIVE")], { totalElements: 41, hasNext: true }),
    });
    const result = await fetchCustomerOptions("an");
    expect(result).toMatchObject({ page: 0, hasMore: true, totalElements: 41 });
    expect(result.items[0]).toEqual({
      customerId: "c1",
      fullName: "Khách c1",
      email: "c1@ex.vn",
      phone: null,
      segmentId: null,
      status: "ACTIVE",
    });
  });

  it("25 q (đã trim), trang 0-based, cỡ trang nhỏ, sắp theo tên; q rỗng thì không gửi", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: page([]) });
    await fetchCustomerOptions("  0901 ", 2);
    expect(get.mock.calls[0]?.[0]).toBe("/customers");
    expect(Object.fromEntries(paramsOf(get))).toEqual({
      page: "2",
      size: String(CUSTOMER_OPTIONS_PAGE_SIZE),
      sort: "fullName,asc",
      q: "0901",
    });
    get.mockClear();
    await fetchCustomerOptions("   ");
    expect(paramsOf(get).has("q")).toBe(false);
    expect(CUSTOMER_OPTIONS_PAGE_SIZE).toBeLessThanOrEqual(200);
  });

  it("26 không tự lọc ACTIVE; giữ nguyên trạng thái của từng khách", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: page([
        customer("c1", "ACTIVE"),
        customer("c2", "PENDING_ACTIVATION"),
        customer("c3", "INACTIVE"),
        customer("c4", "BLOCKED"),
      ]),
    });
    const { items } = await fetchCustomerOptions("");
    expect(paramsOf(get).has("status")).toBe(false);
    expect(items.map((c) => c.status)).toEqual([
      "ACTIVE",
      "PENDING_ACTIVATION",
      "INACTIVE",
      "BLOCKED",
    ]);
  });

  it("27 không giả định mã khách / loại khách sỉ; không đọc mã số thuế", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: customer("c9", "ACTIVE", { phone: "0901" }),
    });
    const ref = await fetchCustomerRef("c9");
    expect(Object.keys(ref).sort()).toEqual(
      ["customerId", "email", "fullName", "phone", "segmentId", "status"].sort(),
    );
    expect(ref).not.toHaveProperty("customerCode");
    expect(ref).not.toHaveProperty("type");
    expect(ref).not.toHaveProperty("taxCode");
  });

  it("thiếu customer-customers:READ → không gọi API", () => {
    const get = vi.spyOn(api, "get");
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    renderHook(() => useCustomerOptions("an", false), { wrapper });
    expect(get).not.toHaveBeenCalled();
  });

  it("có quyền → hook tải trang gợi ý", async () => {
    vi.spyOn(api, "get").mockResolvedValue({ data: page([customer("c1", "BLOCKED")]) });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCustomerOptions("c", true), { wrapper });
    await waitFor(() => expect(result.current.data?.items[0]?.status).toBe("BLOCKED"));
  });
});
