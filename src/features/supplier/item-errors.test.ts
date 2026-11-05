import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import { supplierItemErrorMessage, supplierItemFieldErrors } from "./item-errors";

const RAW = "raw english message";
const apiError = (status: number, code: string, fields?: Record<string, string>) =>
  new ApiError(status, code, RAW, fields);

describe("supplierItemFieldErrors", () => {
  it.each(["SUPPLIER_ITEM_DUPLICATE", "SKU_NOT_PURCHASABLE", "INVENTORY_ITEM_NOT_FOUND"])(
    "%s → lỗi ở sku",
    (code) => {
      const errors = supplierItemFieldErrors(apiError(409, code));
      expect(Object.keys(errors)).toEqual(["sku"]);
      expect(errors.sku).not.toBe(RAW);
    },
  );

  it("400 field moq → câu tiếng Việt về MOQ", () => {
    const errors = supplierItemFieldErrors(
      apiError(400, "VALIDATION_FAILED", { moq: "moq must be ≥ 1" }),
    );
    expect(errors.moq).toMatch(/tối thiểu/i);
  });

  it("bỏ qua field lạ", () => {
    expect(supplierItemFieldErrors(apiError(400, "VALIDATION_FAILED", { zzz: "x" }))).toEqual({});
  });
});

describe("supplierItemErrorMessage", () => {
  it("SUPPLIER_ITEM_IN_USE → câu riêng, không phải message thô", () => {
    const text = supplierItemErrorMessage(apiError(409, "SUPPLIER_ITEM_IN_USE"));
    expect(text).not.toBe(RAW);
    expect(text).toMatch(/đơn đặt hàng/i);
  });

  it.each(["SUPPLIER_INACTIVE", "OPTIMISTIC_LOCK", "SUPPLIER_ITEM_NOT_FOUND"])(
    "%s → tiếng Việt",
    (code) => {
      expect(supplierItemErrorMessage(apiError(409, code))).not.toBe(RAW);
    },
  );

  it("lỗi field → nêu câu của field; lỗi lạ → câu chung", () => {
    expect(supplierItemErrorMessage(apiError(400, "VALIDATION_FAILED", { price: "bad" }))).toMatch(
      /giá/i,
    );
    expect(supplierItemErrorMessage(new Error("boom"))).toMatch(/\S/);
  });
});
