import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHARED_QUERY_ROOTS } from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { inventoryItemKeys } from "@/lib/references/inventory-item-keys";
import { skuSupplierKeys } from "@/lib/references/sku-suppliers";
import { supplierItemKeys } from "@/lib/references/supplier-items";

import { isPurchasingVersionConflict } from "./purchasing-errors";
import { skuPurchasingKeys, useSaveSkuPurchasing, useSkuPurchasing } from "./purchasing-queries";
import { beSkuPurchasingSchema } from "./purchasing-schemas";
import { PRODUCT_HISTORY_ROOT } from "./queries";

import type { ReactNode } from "react";
import type { SaveSkuPurchasingInput } from "./purchasing-api";
import type { SkuPurchasing } from "./purchasing-schemas";

afterEach(() => vi.restoreAllMocks());

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const VARIANT = "22222222-2222-4222-8222-222222222222";
const OLD_SUPPLIER = "33333333-3333-4333-8333-333333333333";
const NEW_SUPPLIER = "55555555-5555-4555-8555-555555555555";
const KEY = skuPurchasingKeys.detail(PRODUCT, VARIANT);

const dto = (patch: Record<string, unknown> = {}) => ({
  variantId: VARIANT,
  sku: "CUP-12OZ",
  version: 5,
  defaultSupplierId: OLD_SUPPLIER,
  leadTimeDays: 3,
  ...patch,
});
const current: SkuPurchasing = beSkuPurchasingSchema.parse(dto());

const input = (defaultSupplierId: string | null, version = 5): SaveSkuPurchasingInput => ({
  productId: PRODUCT,
  variantId: VARIANT,
  version,
  values: {
    defaultSupplierId,
    referencePurchasePrice: null,
    referencePurchaseCurrency: null,
    leadTimeDays: 3,
    moq: null,
  },
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

/** Khoá đã invalidate, dạng chuỗi JSON để so sánh. */
function invalidatedKeys(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.map((c) => JSON.stringify((c[0] as { queryKey: unknown }).queryKey));
}
const k = (key: readonly unknown[]) => JSON.stringify(key);

describe("skuPurchasingKeys", () => {
  it("ổn định theo productId + variantId và nằm dưới root dùng chung", () => {
    expect(skuPurchasingKeys.detail(PRODUCT, VARIANT)).toEqual(KEY);
    expect(KEY.slice(0, 1)).toEqual([...skuPurchasingKeys.all]);
    expect(skuPurchasingKeys.all).toEqual([SHARED_QUERY_ROOTS.skuPurchasing]);
    expect(skuPurchasingKeys.detail(PRODUCT, NEW_SUPPLIER)).not.toEqual(KEY);
  });
});

describe("useSkuPurchasing", () => {
  it("thiếu quyền đọc hoặc thiếu id thì không gọi API", () => {
    const get = vi.spyOn(api, "get");
    const { wrapper } = setup();
    const denied = renderHook(() => useSkuPurchasing(PRODUCT, VARIANT, false), { wrapper });
    const noVariant = renderHook(() => useSkuPurchasing(PRODUCT, undefined, true), { wrapper });
    expect(denied.result.current.fetchStatus).toBe("idle");
    expect(noVariant.result.current.fetchStatus).toBe("idle");
    expect(get).not.toHaveBeenCalled();
  });

  it("có quyền thì đọc đúng route kèm AbortSignal", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: dto() });
    const { wrapper } = setup();
    const { result } = renderHook(() => useSkuPurchasing(PRODUCT, VARIANT, true), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(current));
    expect(get).toHaveBeenCalledWith(`/products/${PRODUCT}/variants/${VARIANT}/purchasing`, {
      signal: expect.any(AbortSignal),
    });
  });

  it("lỗi đọc vẫn là lỗi — không bịa cấu hình trống", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new ApiError(404, "INVENTORY_ITEM_NOT_FOUND", "x"));
    const { wrapper } = setup();
    const { result } = renderHook(() => useSkuPurchasing(PRODUCT, VARIANT, true), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe("useSaveSkuPurchasing", () => {
  it("ghi response vào cache, làm mới hồ sơ hàng tồn + lịch sử + danh mục hai NCC khi đổi NCC mặc định", async () => {
    vi.spyOn(api, "put").mockResolvedValue({
      data: dto({ version: 6, defaultSupplierId: NEW_SUPPLIER }),
    });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, current);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSaveSkuPurchasing(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input(NEW_SUPPLIER));
    });
    expect(queryClient.getQueryData<SkuPurchasing>(KEY)).toMatchObject({
      version: 6,
      defaultSupplierId: NEW_SUPPLIER,
    });
    const keys = invalidatedKeys(invalidate);
    expect(keys).toEqual(
      expect.arrayContaining([
        k(inventoryItemKeys.all),
        k([...PRODUCT_HISTORY_ROOT, PRODUCT]),
        k(skuSupplierKeys.bySku("CUP-12OZ")),
        k(supplierItemKeys.lists(OLD_SUPPLIER)),
        k(supplierItemKeys.lists(NEW_SUPPLIER)),
        k(supplierItemKeys.catalog(OLD_SUPPLIER)),
        k(supplierItemKeys.catalog(NEW_SUPPLIER)),
      ]),
    );
    // không invalidate chính khoá vừa ghi, cũng không quét mọi danh mục NCC
    expect(keys).not.toContain(k(KEY));
    expect(keys).not.toContain(k(supplierItemKeys.all));
  });

  it("NCC mặc định không đổi → không đụng danh mục NCC", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: dto({ version: 6 }) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, current);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSaveSkuPurchasing(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input(OLD_SUPPLIER));
    });
    const keys = invalidatedKeys(invalidate);
    expect(keys).toEqual([k(inventoryItemKeys.all), k([...PRODUCT_HISTORY_ROOT, PRODUCT])]);
  });

  it("không có bản trước trong cache → làm mới mọi danh mục NCC cho chắc", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: dto({ version: 6 }) });
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSaveSkuPurchasing(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input(OLD_SUPPLIER));
    });
    expect(invalidatedKeys(invalidate)).toContain(k(supplierItemKeys.all));
  });

  it("lần đọc nền đang chạy không ghi đè kết quả PUT", async () => {
    let resolveStale: (value: { data: unknown }) => void = () => undefined;
    vi.spyOn(api, "get").mockImplementation(
      () => new Promise((resolve) => (resolveStale = resolve)),
    );
    vi.spyOn(api, "put").mockResolvedValue({ data: dto({ version: 6, leadTimeDays: 9 }) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, current);
    const reading = renderHook(() => useSkuPurchasing(PRODUCT, VARIANT, true), { wrapper });
    void reading.result.current.refetch();
    // đọc trạng thái ở cache: kết quả hook chỉ render lại theo field đã đọc lúc render (tracked props)
    await waitFor(() => expect(queryClient.getQueryState(KEY)?.fetchStatus).toBe("fetching"));
    const { result } = renderHook(() => useSaveSkuPurchasing(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input(OLD_SUPPLIER));
      resolveStale({ data: dto({ version: 5, leadTimeDays: 3 }) });
    });
    expect(queryClient.getQueryData<SkuPurchasing>(KEY)).toMatchObject({
      version: 6,
      leadTimeDays: 9,
    });
  });

  it("cache đã có bản mới hơn (version lớn hơn) thì giữ bản đó", async () => {
    vi.spyOn(api, "put").mockResolvedValue({ data: dto({ version: 6 }) });
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, current);
    const { result } = renderHook(
      () =>
        useSaveSkuPurchasing({
          // giả lập một lần ghi khác của người khác đã về cache trước khi PUT này trả
          onMutate: () => {
            queryClient.setQueryData(KEY, { ...current, version: 9 });
          },
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync(input(OLD_SUPPLIER));
    });
    expect(queryClient.getQueryData<SkuPurchasing>(KEY)?.version).toBe(9);
  });

  it("OPTIMISTIC_LOCK: giữ nguyên ApiError, tải lại thông tin mua hàng, phân biệt với 409 khác", async () => {
    const lock = new ApiError(409, "OPTIMISTIC_LOCK", "stale");
    vi.spyOn(api, "put").mockRejectedValue(lock);
    const { queryClient, wrapper } = setup();
    queryClient.setQueryData(KEY, current);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const onError = vi.fn();
    const { result } = renderHook(() => useSaveSkuPurchasing({ onError }), { wrapper });
    let thrown: unknown;
    await act(async () => {
      await result.current.mutateAsync(input(OLD_SUPPLIER)).catch((e: unknown) => (thrown = e));
    });
    expect(thrown).toBe(lock);
    expect(onError.mock.calls[0]?.[0]).toBe(lock);
    expect(isPurchasingVersionConflict(thrown)).toBe(true);
    expect(invalidatedKeys(invalidate)).toContain(k(KEY));
    // cache không bị ghi bằng bất cứ gì
    expect(queryClient.getQueryData(KEY)).toEqual(current);
  });

  it("409 không phải lệch version (SUPPLIER_INACTIVE) không tải lại và không bị nhầm là OPTIMISTIC_LOCK", async () => {
    const inactive = new ApiError(409, "SUPPLIER_INACTIVE", "inactive");
    vi.spyOn(api, "put").mockRejectedValue(inactive);
    const { queryClient, wrapper } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSaveSkuPurchasing(), { wrapper });
    let thrown: unknown;
    await act(async () => {
      await result.current.mutateAsync(input(NEW_SUPPLIER)).catch((e: unknown) => (thrown = e));
    });
    expect(thrown).toBe(inactive);
    expect(isPurchasingVersionConflict(thrown)).toBe(false);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
