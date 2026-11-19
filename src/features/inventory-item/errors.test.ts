import { describe, expect, it } from "vitest";

import { INVENTORY_ITEM_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { inventoryItemErrorMessage, inventoryItemFieldErrors, isStaleItemError } from "./errors";

const err = (code: string, status = 400, fieldErrors?: Record<string, string>) =>
  new ApiError(status, code, "x", fieldErrors);

describe("inventoryItemErrorMessage", () => {
  it.each(
    Object.entries(INVENTORY_ITEM_ERROR_MESSAGES).filter(
      ([code]) => code !== "generic" && code !== "FORBIDDEN" && code !== "UOM_STOCK_CONFLICT",
    ),
  )("mã %s ra đúng câu", (code, message) => {
    expect(inventoryItemErrorMessage(err(code), "logistics")).toBe(message);
  });

  it("INVENTORY_POLICY_STOCK_CONFLICT khi lưu logistics → câu không đổi được ĐVT khi còn tồn", () => {
    expect(
      inventoryItemErrorMessage(err("INVENTORY_POLICY_STOCK_CONFLICT", 409), "logistics"),
    ).toBe(INVENTORY_ITEM_ERROR_MESSAGES.UOM_STOCK_CONFLICT);
  });

  it("mã lạ → câu chung; 403 → FORBIDDEN", () => {
    expect(inventoryItemErrorMessage(err("HTTP_500", 500), "load")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.generic,
    );
    expect(inventoryItemErrorMessage(new Error("boom"), "load")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.generic,
    );
    expect(inventoryItemErrorMessage(err("HTTP_403", 403), "logistics")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.FORBIDDEN,
    );
  });
});

describe("inventoryItemFieldErrors (BE InventoryItemsImpl.saveLogistics)", () => {
  it("UOM_CONVERSION_DUPLICATE → ô đơn vị tính; CONFLICT (mã vạch trùng) → ô mã vạch", () => {
    expect(inventoryItemFieldErrors(err("UOM_CONVERSION_DUPLICATE", 409), "logistics")).toEqual({
      unitOfMeasure: INVENTORY_ITEM_ERROR_MESSAGES.UOM_CONVERSION_DUPLICATE,
    });
    expect(inventoryItemFieldErrors(err("CONFLICT", 409), "logistics")).toEqual({
      barcode: INVENTORY_ITEM_ERROR_MESSAGES.CONFLICT,
    });
  });

  it("ngoài lúc lưu logistics / mã khác / không phải ApiError → rỗng", () => {
    expect(inventoryItemFieldErrors(err("CONFLICT", 409), "load")).toEqual({});
    expect(inventoryItemFieldErrors(err("VARIANT_OBSOLETE", 409), "logistics")).toEqual({});
    expect(inventoryItemFieldErrors(null, "logistics")).toEqual({});
  });
});

describe("isStaleItemError", () => {
  it("OPTIMISTIC_LOCK và INVENTORY_ITEM_NOT_FOUND là stale", () => {
    expect(isStaleItemError(err("OPTIMISTIC_LOCK", 409))).toBe(true);
    expect(isStaleItemError(err("INVENTORY_ITEM_NOT_FOUND", 404))).toBe(true);
    expect(isStaleItemError(err("CONFLICT", 409))).toBe(false);
  });
});
