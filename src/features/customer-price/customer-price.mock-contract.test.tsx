/**
 * Contract test: mock `/catalog/customer-prices` nói đúng hợp đồng BE `CustomerPriceController` +
 * `CustomerPriceService` + `CustomerPrice` + `SellingPrice` (origin/develop 92bcd760) để `api.ts` /
 * `mutations.ts` của Step 4A chạy y hệt trên mock và BE thật. Gọi hàm FE thật qua mock adapter.
 */
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  OTHER_PRICED_CUSTOMER as B,
  PRICED_CUSTOMER as A,
  UNPRICED_CUSTOMER as C,
  resetCustomerPriceMockStore,
  seedMockCustomerPrice,
} from "@/lib/api/mock-customer-price-store";
import { resetCustomerMockStore } from "@/lib/api/mock-customer-store";
import { resetVariantMockStore } from "@/lib/api/mock-routes-variants";

import {
  createCustomerPrice,
  getCustomerPrice,
  listCustomerPrices,
  updateCustomerPrice,
} from "./api";
import { useCreateCustomerPrice, useUpdateCustomerPrice } from "./mutations";
import { customerPriceKeys } from "./queries";

import type { ReactNode } from "react";
import type { CustomerPriceValues } from "./schemas";

// Mỗi request mock trễ ~350ms (Math.random = 0.5 → không có lỗi 500 ngẫu nhiên).
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => {
  resetCustomerMockStore();
  resetCustomerPriceMockStore();
  resetVariantMockStore();
});
afterAll(() => vi.restoreAllMocks());

const BASE = "/catalog/customer-prices";
const SKU_SHARED = "SKU-001-BLK-L";
const SKU_FREE = "SKU-001-WHT-L";

const values = (tiers: [number, string][], note: string | null = null): CustomerPriceValues => ({
  tiers: tiers.map(([minQuantity, unitPrice]) => ({ minQuantity, unitPrice })),
  note,
});

async function apiError(p: Promise<unknown>): Promise<ApiError> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  if (!(e instanceof ApiError)) throw new Error(`expected ApiError, got ${String(e)}`);
  return e;
}
/** Gửi thẳng qua adapter (bỏ kiểm phía FE) để thấy lỗi của "BE". */
const rawPut = (customerId: string, sku: string, body: unknown) =>
  api.put(`${BASE}/${customerId}/${sku}`, body);
const rawPost = (customerId: string, sku: string, body: unknown) =>
  api.post(`${BASE}/${customerId}/${sku}`, body);

describe("GET danh sách (mock)", () => {
  it("13 khách không có giá → mảng rỗng (không phải trang)", async () => {
    const { data } = await api.get<unknown>(BASE, {
      params: new URLSearchParams({ customerId: C }),
    });
    expect(data).toEqual([]);
    expect(await listCustomerPrices(C)).toEqual([]);
  });

  it("14 + 18 nhiều giá của một khách, sắp theo SKU; MOQ = bậc đầu", async () => {
    const prices = await listCustomerPrices(A);
    expect(prices.map((p) => p.sku)).toEqual(["SKU-001-BLK-L", "SKU-002-WHT", "SKU-003-WHT-L"]);
    expect(prices.map((p) => p.moq)).toEqual([10, 1, 1]);
  });

  it("15 + 35 hai khách cùng SKU: giá độc lập, không lẫn khách", async () => {
    const [a] = await listCustomerPrices(A, [SKU_SHARED]);
    const [b] = await listCustomerPrices(B, [SKU_SHARED]);
    expect(a?.tiers.map((t) => t.unitPrice)).toEqual(["95000", "90000"]);
    expect(b?.tiers.map((t) => t.unitPrice)).toEqual(["99000"]);
    expect((await listCustomerPrices(B)).every((p) => p.customerId === B)).toBe(true);
  });

  it("16 + 17 lọc SKU lặp được, chuẩn hoá như BE (in hoa, bỏ khoảng trắng); SKU không có giá thì vắng", async () => {
    const prices = await listCustomerPrices(A, [" sku-003-wht-l ", "SKU-002-WHT", "SKU-001-WHT-L"]);
    expect(prices.map((p) => p.sku)).toEqual(["SKU-002-WHT", "SKU-003-WHT-L"]);
  });

  it("thiếu customerId → 400; customerId sai dạng → UNSUPPORTED_PARAMETER; khách không có → 404", async () => {
    const missing = await apiError(api.get(BASE));
    expect([missing.status, missing.code]).toEqual([400, "VALIDATION_FAILED"]);
    expect((await apiError(listCustomerPrices("CUS-0012"))).code).toBe("UNSUPPORTED_PARAMETER");
    // BE `list` gọi `resolver.customer` trước → 404, không phải mảng rỗng
    const unknown = await apiError(listCustomerPrices("c0de9999-0000-4000-8000-000000009999"));
    expect([unknown.status, unknown.code]).toEqual([404, "CUSTOMER_NOT_FOUND"]);
    expect((await apiError(listCustomerPrices(A, ["bad sku!"]))).code).toBe("VALIDATION_FAILED");
  });

  it("wire không có field FE (unitPriceExact) hay field bịa (tiền tệ, ngày hiệu lực)", async () => {
    const { data } = await api.get<Record<string, unknown>[]>(BASE, {
      params: new URLSearchParams({ customerId: A }),
    });
    const first = data[0] ?? {};
    expect(Object.keys(first).sort()).toEqual([
      "customerId",
      "moq",
      "note",
      "sku",
      "tiers",
      "version",
    ]);
    expect(Object.keys((first.tiers as Record<string, unknown>[])[0] ?? {}).sort()).toEqual([
      "minQuantity",
      "unitPrice",
    ]);
  });
});

describe("GET chi tiết (mock)", () => {
  it("19 đúng bản ghi; 20 không có giá → 404 CUSTOMER_PRICE_NOT_FOUND (không kiểm khách, như BE)", async () => {
    const price = await getCustomerPrice(A, "sku-001-blk-l");
    expect(price).toMatchObject({ sku: SKU_SHARED, moq: 10, note: "Giá đại lý cấp 1", version: 2 });
    const missing = await apiError(getCustomerPrice(C, SKU_SHARED));
    expect([missing.status, missing.code]).toEqual([404, "CUSTOMER_PRICE_NOT_FOUND"]);
    const ghost = await apiError(
      getCustomerPrice("c0de9999-0000-4000-8000-000000009999", SKU_SHARED),
    );
    expect(ghost.code).toBe("CUSTOMER_PRICE_NOT_FOUND");
  });
});

describe("POST tạo (mock)", () => {
  it("21 + 31 + 32 + 33 + 34 tạo: bậc sắp lại, bậc đầu > 1, giá tăng dần được; version 0; GET lại thấy đúng", async () => {
    const created = await createCustomerPrice({
      customerId: C,
      sku: "sku-001-wht-l",
      values: values(
        [
          [50, "21000"],
          [5, "20000"],
        ],
        "  Giá thử  ",
      ),
    });
    expect(created).toMatchObject({ sku: SKU_FREE, moq: 5, version: 0, note: "Giá thử" });
    expect(created.tiers.map((t) => [t.minQuantity, t.unitPrice])).toEqual([
      [5, "20000"],
      [50, "21000"],
    ]);
    expect(await getCustomerPrice(C, SKU_FREE)).toEqual(created);
  });

  it("22 tạo trùng → 409 CONFLICT", async () => {
    const e = await apiError(
      createCustomerPrice({ customerId: A, sku: SKU_SHARED, values: values([[1, "1000"]]) }),
    );
    expect([e.status, e.code]).toEqual([409, "CONFLICT"]);
  });

  it("khách không có → CUSTOMER_NOT_FOUND; SKU không có → VARIANT_NOT_FOUND; SKU sai dạng → VALIDATION_FAILED", async () => {
    const v = values([[1, "1000"]]);
    expect(
      (
        await apiError(
          createCustomerPrice({
            customerId: "c0de9999-0000-4000-8000-000000009999",
            sku: SKU_FREE,
            values: v,
          }),
        )
      ).code,
    ).toBe("CUSTOMER_NOT_FOUND");
    expect(
      (await apiError(createCustomerPrice({ customerId: C, sku: "NO-SUCH-SKU", values: v }))).code,
    ).toBe("VARIANT_NOT_FOUND");
    expect(
      (await apiError(rawPost(C, "bad%20sku!", { tiers: [{ minQuantity: 1, unitPrice: 1 }] })))
        .code,
    ).toBe("VALIDATION_FAILED");
  });

  it("28 + 29 + 30 bean / domain như BE: fieldErrors theo đường dẫn BE; lỗi domain không có fieldErrors", async () => {
    const empty = await apiError(rawPost(C, SKU_FREE, { tiers: [] }));
    expect(empty.fieldCodes).toEqual({ tiers: "NotEmpty" });
    const tooMany = await apiError(
      rawPost(C, SKU_FREE, {
        tiers: Array.from({ length: 21 }, (_, i) => ({ minQuantity: i + 1, unitPrice: 1 })),
      }),
    );
    expect(tooMany.fieldCodes).toEqual({ tiers: "Size" });
    const fields = await apiError(
      rawPost(C, SKU_FREE, { tiers: [{ minQuantity: 0 }], note: "x".repeat(501), version: -1 }),
    );
    expect(fields.fieldCodes).toEqual({
      "tiers[0].minQuantity": "Min",
      "tiers[0].unitPrice": "NotNull",
      note: "Size",
      version: "PositiveOrZero",
    });
    const dup = await apiError(
      rawPost(C, SKU_FREE, {
        tiers: [
          { minQuantity: 5, unitPrice: 1 },
          { minQuantity: 5, unitPrice: 2 },
        ],
      }),
    );
    expect([dup.code, dup.fieldErrors]).toEqual(["VALIDATION_FAILED", undefined]);
    for (const unitPrice of [0, -5, 10.5, 99999999999999999]) {
      const bad = await apiError(rawPost(C, SKU_FREE, { tiers: [{ minQuantity: 1, unitPrice }] }));
      expect([bad.code, bad.fieldErrors]).toEqual(["VALIDATION_FAILED", undefined]);
    }
    const malformed = await apiError(
      rawPost(C, SKU_FREE, { tiers: [{ minQuantity: 1, unitPrice: "abc" }] }),
    );
    expect(malformed.code).toBe("MALFORMED_REQUEST");
  });

  it("'100.00' hợp lệ như BE (bỏ 0 cuối) và lưu là 100", async () => {
    const created = await createCustomerPrice({
      customerId: C,
      sku: SKU_FREE,
      values: values([[1, "100.00"]]),
    });
    expect(created.tiers[0]?.unitPrice).toBe("100");
  });
});

describe("PUT thay (mock)", () => {
  it("23 + 26 + 27 + 34 thay toàn bộ: bậc cũ bị bỏ, ghi chú xoá được, version + 1; GET lại thấy đúng", async () => {
    const saved = await updateCustomerPrice({
      customerId: A,
      sku: SKU_SHARED,
      version: 2,
      values: values([[20, "88000"]], null),
    });
    expect(saved).toMatchObject({ moq: 20, note: null, version: 3 });
    expect(saved.tiers.map((t) => t.minQuantity)).toEqual([20]);
    expect(await getCustomerPrice(A, SKU_SHARED)).toEqual(saved);
    // khách khác cùng SKU không đổi
    expect((await getCustomerPrice(B, SKU_SHARED)).version).toBe(0);
  });

  it("thay mà không đổi gì vẫn tăng version (BE save luôn version + 1)", async () => {
    const before = await getCustomerPrice(A, "SKU-002-WHT");
    const same = await updateCustomerPrice({
      customerId: A,
      sku: "SKU-002-WHT",
      version: before.version,
      values: values([[1, "150000"]]),
    });
    expect(same.version).toBe(before.version + 1);
  });

  it("24 thay bản không có → 404 CUSTOMER_PRICE_NOT_FOUND", async () => {
    const e = await apiError(
      updateCustomerPrice({
        customerId: C,
        sku: SKU_SHARED,
        version: 0,
        values: values([[1, "1"]]),
      }),
    );
    expect([e.status, e.code]).toEqual([404, "CUSTOMER_PRICE_NOT_FOUND"]);
  });

  it("25 version cũ → 409 OPTIMISTIC_LOCK, không ghi", async () => {
    const e = await apiError(
      updateCustomerPrice({
        customerId: A,
        sku: SKU_SHARED,
        version: 1,
        values: values([[1, "1"]]),
      }),
    );
    expect([e.status, e.code]).toEqual([409, "OPTIMISTIC_LOCK"]);
    expect((await getCustomerPrice(A, SKU_SHARED)).version).toBe(2);
  });

  it("thứ tự BE: thiếu version → 400; giá sai báo TRƯỚC lệch version; trùng bậc báo SAU lệch version", async () => {
    const noVersion = await apiError(
      rawPut(A, SKU_SHARED, { tiers: [{ minQuantity: 1, unitPrice: 1 }] }),
    );
    expect([noVersion.code, noVersion.fieldErrors]).toEqual(["VALIDATION_FAILED", undefined]);
    const badPriceStale = await apiError(
      rawPut(A, SKU_SHARED, { tiers: [{ minQuantity: 1, unitPrice: 0.5 }], version: 0 }),
    );
    expect(badPriceStale.code).toBe("VALIDATION_FAILED");
    const dupStale = await apiError(
      rawPut(A, SKU_SHARED, {
        tiers: [
          { minQuantity: 1, unitPrice: 1 },
          { minQuantity: 1, unitPrice: 2 },
        ],
        version: 0,
      }),
    );
    expect(dupStale.code).toBe("OPTIMISTIC_LOCK");
  });
});

describe("độ chính xác tiền (mock)", () => {
  it("36 đơn giá vượt số nguyên an toàn → FE đánh dấu không chính xác, không giả là chữ số gốc", async () => {
    seedMockCustomerPrice({
      customerId: C,
      sku: SKU_FREE,
      tiers: [
        { minQuantity: 1, unitPrice: "9999999999999999" },
        { minQuantity: 10, unitPrice: "9007199254740991" },
      ],
      note: null,
      version: 0,
    });
    const price = await getCustomerPrice(C, SKU_FREE);
    expect(price.tiers[0]?.unitPriceExact).toBe(false);
    expect(price.tiers[0]?.unitPrice).not.toBe("9999999999999999");
    expect(price.tiers[1]).toEqual({
      minQuantity: 10,
      unitPrice: "9007199254740991",
      unitPriceExact: true,
    });
    // ghi: giá BE nhận nhưng không đi qua JSON nguyên vẹn bị FE chặn, không làm tròn
    const put = vi.spyOn(api, "put");
    await expect(
      updateCustomerPrice({
        customerId: C,
        sku: SKU_FREE,
        version: 0,
        values: values([[1, "9999999999999999"]]),
      }),
    ).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
    put.mockRestore();
  });
});

describe("tích hợp query (mock)", () => {
  function setup() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    return { queryClient, wrapper };
  }
  async function load(qc: QueryClient) {
    for (const c of [A, B]) {
      await qc.fetchQuery({
        queryKey: customerPriceKeys.list(c),
        queryFn: () => listCustomerPrices(c),
      });
      await qc.fetchQuery({
        queryKey: customerPriceKeys.detail(c, SKU_SHARED),
        queryFn: () => getCustomerPrice(c, SKU_SHARED),
      });
    }
  }
  const stale = (qc: QueryClient, key: readonly unknown[]) =>
    qc.getQueryState(key)?.isInvalidated ?? false;

  it("37 + 39 tạo làm mới đúng danh sách của khách đó; khách khác giữ nguyên cache", async () => {
    const { queryClient, wrapper } = setup();
    await load(queryClient);
    const { result } = renderHook(() => useCreateCustomerPrice(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        customerId: A,
        sku: SKU_FREE,
        values: values([[1, "5000"]]),
      });
    });
    expect(stale(queryClient, customerPriceKeys.list(A))).toBe(true);
    expect(stale(queryClient, customerPriceKeys.detail(A, SKU_SHARED))).toBe(false);
    expect(stale(queryClient, customerPriceKeys.list(B))).toBe(false);
    expect(stale(queryClient, customerPriceKeys.detail(B, SKU_SHARED))).toBe(false);
    expect(queryClient.getQueryData(customerPriceKeys.detail(A, SKU_FREE))).toMatchObject({
      version: 0,
    });
  });

  it("38 thay: bản ghi nhận version mới, danh sách khách đó làm mới; khách khác không đụng", async () => {
    const { queryClient, wrapper } = setup();
    await load(queryClient);
    const { result } = renderHook(() => useUpdateCustomerPrice(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        customerId: A,
        sku: SKU_SHARED,
        version: 2,
        values: values([[1, "70000"]]),
      });
    });
    expect(queryClient.getQueryData(customerPriceKeys.detail(A, SKU_SHARED))).toMatchObject({
      version: 3,
      moq: 1,
    });
    expect(stale(queryClient, customerPriceKeys.list(A))).toBe(true);
    expect(stale(queryClient, customerPriceKeys.list(B))).toBe(false);
    expect(queryClient.getQueryData(customerPriceKeys.detail(B, SKU_SHARED))).toMatchObject({
      version: 0,
    });
  });

  it("40 thay với version cũ: lỗi OPTIMISTIC_LOCK, không ghi đè cache lẫn server, chỉ tải lại khách đó", async () => {
    const { queryClient, wrapper } = setup();
    await load(queryClient);
    const { result } = renderHook(() => useUpdateCustomerPrice(), { wrapper });
    let thrown: unknown;
    await act(async () => {
      await result.current
        .mutateAsync({ customerId: A, sku: SKU_SHARED, version: 1, values: values([[1, "1"]]) })
        .catch((e: unknown) => (thrown = e));
    });
    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).code).toBe("OPTIMISTIC_LOCK");
    expect(queryClient.getQueryData(customerPriceKeys.detail(A, SKU_SHARED))).toMatchObject({
      version: 2,
    });
    expect(stale(queryClient, customerPriceKeys.detail(A, SKU_SHARED))).toBe(true);
    expect(stale(queryClient, customerPriceKeys.list(B))).toBe(false);
    expect((await getCustomerPrice(A, SKU_SHARED)).tiers[0]?.unitPrice).toBe("95000");
  });
});
