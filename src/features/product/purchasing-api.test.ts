import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { getSkuPurchasing, saveSkuPurchasing } from "./purchasing-api";

import type { SkuPurchasingValues } from "./purchasing-schemas";

afterEach(() => vi.restoreAllMocks());

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const VARIANT = "22222222-2222-4222-8222-222222222222";
const OTHER_VARIANT = "44444444-4444-4444-8444-444444444444";
const SUPPLIER = "33333333-3333-4333-8333-333333333333";
const PATH = `/products/${PRODUCT}/variants/${VARIANT}/purchasing`;

const response = {
  variantId: VARIANT,
  sku: "CUP-12OZ",
  version: 5,
  defaultSupplierId: SUPPLIER,
  referencePurchasePrice: 12345678901234.56,
  referencePurchaseCurrency: "VND",
  leadTimeDays: 0,
  moq: 12,
};

const values: SkuPurchasingValues = {
  defaultSupplierId: SUPPLIER,
  referencePurchasePrice: "12345678901234.56",
  referencePurchaseCurrency: "VND",
  leadTimeDays: 0,
  moq: 12,
};

describe("GET /products/{productId}/variants/{variantId}/purchasing", () => {
  it("gọi đúng route /variants/ theo UUID, truyền AbortSignal, parse response", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({ data: response });
    const signal = new AbortController().signal;
    const result = await getSkuPurchasing(PRODUCT, VARIANT, signal);
    expect(get).toHaveBeenCalledWith(PATH, { signal });
    expect(result.referencePurchasePrice).toBe("12345678901234.56");
    expect(result.leadTimeDays).toBe(0);
  });

  it("200 với mọi field mua hàng vắng mặt là cấu hình trống, không phải lỗi", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { variantId: VARIANT, sku: "CUP-12OZ", version: 0 },
    });
    await expect(getSkuPurchasing(PRODUCT, VARIANT)).resolves.toMatchObject({
      version: 0,
      defaultSupplierId: null,
      referencePurchasePrice: null,
      referencePurchaseCurrency: null,
      leadTimeDays: null,
      moq: null,
    });
  });

  it("response của biến thể khác là lỗi hợp đồng", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { ...response, variantId: OTHER_VARIANT } });
    await expect(getSkuPurchasing(PRODUCT, VARIANT)).rejects.toThrow(/another variant/);
  });

  it("id là chuỗi mờ: nhận id kiểu mock (PRD-001 / mã biến thể) và so đúng nguyên văn", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: { ...response, variantId: "SKU-001-BLK-L", defaultSupplierId: "SUP-001" },
    });
    await expect(getSkuPurchasing("PRD-001", "SKU-001-BLK-L")).resolves.toMatchObject({
      defaultSupplierId: "SUP-001",
    });
    expect(get).toHaveBeenCalledWith("/products/PRD-001/variants/SKU-001-BLK-L/purchasing", {
      signal: undefined,
    });
  });

  it("response hỏng bị từ chối", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { ...response, version: "5" } });
    await expect(getSkuPurchasing(PRODUCT, VARIANT)).rejects.toThrow();
  });

  it("id rỗng bị chặn trước khi gọi BE", async () => {
    const get = vi.spyOn(api, "get");
    await expect(getSkuPurchasing(PRODUCT, "  ")).rejects.toThrow(/variant id/);
    await expect(getSkuPurchasing("", VARIANT)).rejects.toThrow(/product id/);
    expect(get).not.toHaveBeenCalled();
  });
});

describe("PUT /products/{productId}/variants/{variantId}/purchasing", () => {
  it("gửi body thay toàn bộ, version nguyên vẹn; nhận version mới từ BE", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: { ...response, version: 6 } });
    const saved = await saveSkuPurchasing({
      productId: PRODUCT,
      variantId: VARIANT,
      version: 5,
      values,
    });
    expect(put).toHaveBeenCalledWith(PATH, {
      version: 5,
      defaultSupplierId: SUPPLIER,
      referencePurchasePrice: 12345678901234.56,
      referencePurchaseCurrency: "VND",
      leadTimeDays: 0,
      moq: 12,
    });
    expect(saved.version).toBe(6);
  });

  it("giá đi trên dây đúng chữ số đã nhập", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({ data: response });
    await saveSkuPurchasing({ productId: PRODUCT, variantId: VARIANT, version: 5, values });
    expect(JSON.stringify(put.mock.calls[0]?.[1])).toContain(
      '"referencePurchasePrice":12345678901234.56',
    );
  });

  it("xoá bằng null tường minh — body vẫn đủ mọi key", async () => {
    const put = vi.spyOn(api, "put").mockResolvedValueOnce({
      data: { variantId: VARIANT, sku: "CUP-12OZ", version: 6 },
    });
    const cleared: SkuPurchasingValues = {
      defaultSupplierId: null,
      referencePurchasePrice: null,
      referencePurchaseCurrency: null,
      leadTimeDays: null,
      moq: null,
    };
    await saveSkuPurchasing({
      productId: PRODUCT,
      variantId: VARIANT,
      version: 5,
      values: cleared,
    });
    const body = put.mock.calls[0]?.[1];
    expect(body).toEqual({ version: 5, ...cleared });
    expect(Object.keys(body ?? {}).sort()).toEqual([
      "defaultSupplierId",
      "leadTimeDays",
      "moq",
      "referencePurchaseCurrency",
      "referencePurchasePrice",
      "version",
    ]);
  });

  it.each([
    ["giá thiếu tiền tệ", { ...values, referencePurchaseCurrency: null }, 5],
    ["lead time quá 365", { ...values, leadTimeDays: 366 }, 5],
    ["giá vượt độ chính xác JSON", { ...values, referencePurchasePrice: "9999999999999999.99" }, 5],
    ["version âm", values, -1],
  ])("dữ liệu sai (%s) không rời trình duyệt", async (_, bad, version) => {
    const put = vi.spyOn(api, "put");
    await expect(
      saveSkuPurchasing({ productId: PRODUCT, variantId: VARIANT, version, values: bad }),
    ).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });

  it("giữ nguyên ApiError của BE (mã + fieldErrors)", async () => {
    const error = new ApiError(400, "VALIDATION_FAILED", "bad", { moq: "moq must be at least 1" });
    vi.spyOn(api, "put").mockRejectedValueOnce(error);
    await expect(
      saveSkuPurchasing({ productId: PRODUCT, variantId: VARIANT, version: 5, values }),
    ).rejects.toBe(error);
  });

  it("response PUT của biến thể khác là lỗi hợp đồng", async () => {
    vi.spyOn(api, "put").mockResolvedValueOnce({ data: { ...response, variantId: OTHER_VARIANT } });
    await expect(
      saveSkuPurchasing({ productId: PRODUCT, variantId: VARIANT, version: 5, values }),
    ).rejects.toThrow(/another variant/);
  });
});
