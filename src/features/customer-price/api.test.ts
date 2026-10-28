import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import {
  createCustomerPrice,
  getCustomerPrice,
  listCustomerPrices,
  updateCustomerPrice,
} from "./api";
import { customerPriceErrorKind, customerPriceFieldErrors } from "./errors";

import type { CustomerPriceValues } from "./schemas";

afterEach(() => vi.restoreAllMocks());

const CUSTOMER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BASE = "/catalog/customer-prices";

const dto = (sku: string, over: Record<string, unknown> = {}) => ({
  customerId: CUSTOMER,
  sku,
  moq: 10,
  tiers: [{ minQuantity: 10, unitPrice: 95000 }],
  version: 2,
  ...over,
});
const values: CustomerPriceValues = {
  tiers: [
    { minQuantity: 100, unitPrice: "90000" },
    { minQuantity: 10, unitPrice: "95000.00" },
  ],
  note: "Đại lý cấp 1",
};

describe("GET /catalog/customer-prices", () => {
  it("11 + 12 customerId bắt buộc; mảng thường (không phân trang); không gửi page/size", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: [dto("A-1"), dto("B-2")] });
    const signal = new AbortController().signal;
    const prices = await listCustomerPrices(CUSTOMER, [], signal);
    expect(prices.map((p) => p.sku)).toEqual(["A-1", "B-2"]);
    const [url, config] = get.mock.calls[0] ?? [];
    expect(url).toBe(BASE);
    const params = (config as { params: URLSearchParams; signal: AbortSignal }).params;
    expect(params.toString()).toBe(`customerId=${CUSTOMER}`);
    expect((config as { signal: AbortSignal }).signal).toBe(signal);
    await expect(listCustomerPrices("")).rejects.toThrow(/customer id/);
  });

  it("13 bộ lọc sku tuỳ chọn, lặp được (`?sku=A&sku=B`)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: [] });
    await listCustomerPrices(CUSTOMER, ["CUP-1", "cup 2"]);
    const params = (get.mock.calls[0]?.[1] as { params: URLSearchParams }).params;
    expect(params.getAll("sku")).toEqual(["CUP-1", "cup 2"]);
    expect(params.toString()).toBe(`customerId=${CUSTOMER}&sku=CUP-1&sku=cup+2`);
  });

  it("dòng của khách khác / response không phải mảng → lỗi hợp đồng", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: [dto("A", { customerId: OTHER })] });
    await expect(listCustomerPrices(CUSTOMER)).rejects.toThrow(/another customer/);
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { items: [] } });
    await expect(listCustomerPrices(CUSTOMER)).rejects.toThrow();
  });

  it("customerId so không phân biệt hoa thường (UUID): gửi chữ hoa, BE trả chữ thường", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: [dto("A-1")] });
    await expect(listCustomerPrices(CUSTOMER.toUpperCase())).resolves.toHaveLength(1);
  });

  it("14 path mã hoá an toàn; SKU so như BE (in hoa, bỏ khoảng trắng)", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: dto("A/B#1") });
    await getCustomerPrice(CUSTOMER, "a/b#1");
    expect(get.mock.calls[0]?.[0]).toBe(`${BASE}/${CUSTOMER}/a%2Fb%231`);
  });

  it("17 note vắng → null; không có field bịa", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: dto("CUP") });
    const price = await getCustomerPrice(CUSTOMER, "CUP");
    expect(price.note).toBeNull();
    expect(price).not.toHaveProperty("currency");
    expect(price).not.toHaveProperty("validFrom");
  });
});

describe("POST / PUT /catalog/customer-prices/{customerId}/{sku}", () => {
  it("15 tạo: đủ bậc + ghi chú, KHÔNG có version; đơn giá đúng chữ số", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: dto("CUP", { version: 0 }) });
    await createCustomerPrice({ customerId: CUSTOMER, sku: "CUP", values });
    expect(post).toHaveBeenCalledWith(`${BASE}/${CUSTOMER}/CUP`, {
      tiers: [
        { minQuantity: 100, unitPrice: 90000 },
        { minQuantity: 10, unitPrice: 95000 },
      ],
      note: "Đại lý cấp 1",
    });
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("version");
  });

  it("16 thay: toàn bộ bậc + ghi chú (null để xoá) + version nguyên vẹn", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: dto("CUP", { version: 3 }) });
    const saved = await updateCustomerPrice({
      customerId: CUSTOMER,
      sku: "CUP",
      version: 2,
      values: { tiers: [{ minQuantity: 1, unitPrice: "100" }], note: null },
    });
    expect(put).toHaveBeenCalledWith(`${BASE}/${CUSTOMER}/CUP`, {
      tiers: [{ minQuantity: 1, unitPrice: 100 }],
      note: null,
      version: 2,
    });
    expect(saved.version).toBe(3);
  });

  it("dữ liệu sai / version thiếu không rời trình duyệt", async () => {
    const put = vi.spyOn(api, "put");
    const post = vi.spyOn(api, "post");
    await expect(
      updateCustomerPrice({ customerId: CUSTOMER, sku: "CUP", version: -1, values }),
    ).rejects.toThrow();
    await expect(
      createCustomerPrice({
        customerId: CUSTOMER,
        sku: "CUP",
        values: { tiers: [{ minQuantity: 1, unitPrice: "9999999999999999" }], note: null },
      }),
    ).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("18 ApiError giữ nguyên (mã + fieldErrors) và phân loại được", async () => {
    const cases: [ApiError, string][] = [
      [
        new ApiError(400, "VALIDATION_FAILED", "x", { "tiers[0].unitPrice": "must not be null" }),
        "VALIDATION_FAILED",
      ],
      [new ApiError(404, "CUSTOMER_NOT_FOUND", "x"), "CUSTOMER_NOT_FOUND"],
      [new ApiError(404, "CUSTOMER_PRICE_NOT_FOUND", "x"), "CUSTOMER_PRICE_NOT_FOUND"],
      [new ApiError(404, "VARIANT_NOT_FOUND", "x"), "VARIANT_NOT_FOUND"],
      [new ApiError(409, "CONFLICT", "x"), "CONFLICT"],
      [new ApiError(409, "OPTIMISTIC_LOCK", "x"), "OPTIMISTIC_LOCK"],
      [new ApiError(403, "FORBIDDEN", "x"), "FORBIDDEN"],
      [new ApiError(400, "MALFORMED_REQUEST", "x"), "VALIDATION_FAILED"],
      [new ApiError(500, "INTERNAL_ERROR", "x"), "unexpected"],
    ];
    for (const [error, kind] of cases) {
      vi.spyOn(api, "put").mockRejectedValueOnce(error);
      const thrown = await updateCustomerPrice({
        customerId: CUSTOMER,
        sku: "CUP",
        version: 1,
        values,
      })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(thrown).toBe(error);
      expect(customerPriceErrorKind(thrown)).toBe(kind);
    }
    expect(customerPriceErrorKind(new Error("network"))).toBe("unexpected");
    expect(
      customerPriceFieldErrors(new ApiError(400, "VALIDATION_FAILED", "x", { note: "too long" })),
    ).toEqual({ note: "too long" });
  });
});
