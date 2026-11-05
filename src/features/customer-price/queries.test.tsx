import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { useCreateCustomerPrice, useUpdateCustomerPrice } from "./mutations";
import { customerPriceKeys, useCustomerPrice, useCustomerPrices } from "./queries";
import { beCustomerPriceSchema } from "./schemas";

import type { ReactNode } from "react";
import type { CustomerPriceValues } from "./schemas";

afterEach(() => vi.restoreAllMocks());

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const dto = (customerId: string, sku: string, version = 1) => ({
  customerId,
  sku,
  moq: 1,
  tiers: [{ minQuantity: 1, unitPrice: 100 }],
  version,
});
const values: CustomerPriceValues = { tiers: [{ minQuantity: 1, unitPrice: "120" }], note: null };

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

/** Đổ sẵn danh sách + chi tiết của hai khách. */
function seed(queryClient: QueryClient) {
  for (const c of [A, B]) {
    queryClient.setQueryData(customerPriceKeys.list(c), [
      beCustomerPriceSchema.parse(dto(c, "CUP")),
    ]);
    queryClient.setQueryData(
      customerPriceKeys.detail(c, "CUP"),
      beCustomerPriceSchema.parse(dto(c, "CUP")),
    );
  }
}
const invalidated = (qc: QueryClient, key: readonly unknown[]) =>
  qc.getQueryState(key)?.isInvalidated ?? false;

describe("customerPriceKeys", () => {
  it("19 khoá riêng từng khách; danh sách + chi tiết nằm dưới khoá khách; SKU chuẩn hoá", () => {
    expect(customerPriceKeys.list(A)).not.toEqual(customerPriceKeys.list(B));
    expect(customerPriceKeys.list(A).slice(0, 2)).toEqual([...customerPriceKeys.customer(A)]);
    expect(customerPriceKeys.detail(A, " cup-1 ")).toEqual(customerPriceKeys.detail(A, "CUP-1"));
    // cùng bộ SKU, khác thứ tự → cùng khoá
    expect(customerPriceKeys.list(A, ["b", "a", "A"])).toEqual(
      customerPriceKeys.list(A, ["A", "B"]),
    );
  });
});

describe("useCustomerPrices / useCustomerPrice", () => {
  it("23 thiếu quyền hoặc chưa chọn khách / SKU → không gọi API", () => {
    const get = vi.spyOn(api, "get");
    const { wrapper } = setup();
    renderHook(() => useCustomerPrices(A, false), { wrapper });
    renderHook(() => useCustomerPrices(null, true), { wrapper });
    renderHook(() => useCustomerPrice(A, null, true), { wrapper });
    renderHook(() => useCustomerPrice(A, "CUP", false), { wrapper });
    expect(get).not.toHaveBeenCalled();
  });

  it("có quyền → đọc mảng của đúng khách, kèm AbortSignal", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: [dto(A, "CUP")] });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCustomerPrices(A, true), { wrapper });
    await waitFor(() => expect(result.current.data?.[0]?.sku).toBe("CUP"));
    expect((get.mock.calls[0]?.[1] as { signal: unknown }).signal).toBeInstanceOf(AbortSignal);
  });
});

describe("mutations", () => {
  it("20 tạo: ghi chi tiết, làm mới danh sách của khách đó; 22 khách khác không đụng", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: dto(A, "NEW", 0) });
    const { queryClient, wrapper } = setup();
    seed(queryClient);
    const { result } = renderHook(() => useCreateCustomerPrice(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ customerId: A, sku: "new", values });
    });
    expect(queryClient.getQueryData(customerPriceKeys.detail(A, "NEW"))).toMatchObject({
      version: 0,
    });
    expect(invalidated(queryClient, customerPriceKeys.list(A))).toBe(true);
    expect(invalidated(queryClient, customerPriceKeys.list(B))).toBe(false);
    expect(invalidated(queryClient, customerPriceKeys.detail(B, "CUP"))).toBe(false);
  });

  it("21 thay: chi tiết nhận bản mới, danh sách của khách làm mới; khách khác giữ nguyên", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: dto(A, "CUP", 2) });
    const { queryClient, wrapper } = setup();
    seed(queryClient);
    const { result } = renderHook(() => useUpdateCustomerPrice(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ customerId: A, sku: "CUP", version: 1, values });
    });
    expect(queryClient.getQueryData(customerPriceKeys.detail(A, "CUP"))).toMatchObject({
      version: 2,
    });
    expect(invalidated(queryClient, customerPriceKeys.detail(A, "CUP"))).toBe(false);
    expect(invalidated(queryClient, customerPriceKeys.list(A))).toBe(true);
    expect(invalidated(queryClient, customerPriceKeys.list(B))).toBe(false);
  });

  it("OPTIMISTIC_LOCK: giữ ApiError, tải lại giá của khách đó, không ghi cache, không tự gửi lại", async () => {
    const lock = new ApiError(409, "OPTIMISTIC_LOCK", "stale");
    const put = vi.spyOn(api, "put").mockRejectedValue(lock);
    const { queryClient, wrapper } = setup();
    seed(queryClient);
    const { result } = renderHook(() => useUpdateCustomerPrice(), { wrapper });
    let thrown: unknown;
    await act(async () => {
      await result.current
        .mutateAsync({ customerId: A, sku: "CUP", version: 1, values })
        .catch((e: unknown) => (thrown = e));
    });
    expect(thrown).toBe(lock);
    expect(put).toHaveBeenCalledTimes(1);
    expect(invalidated(queryClient, customerPriceKeys.detail(A, "CUP"))).toBe(true);
    expect(invalidated(queryClient, customerPriceKeys.list(B))).toBe(false);
    expect(queryClient.getQueryData(customerPriceKeys.detail(A, "CUP"))).toMatchObject({
      version: 1,
    });
  });
});
