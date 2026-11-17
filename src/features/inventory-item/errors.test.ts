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
    expect(inventoryItemErrorMessage(err(code), "load")).toBe(message);
  });

  it("INVENTORY_POLICY_STOCK_CONFLICT: logistics → câu đổi ĐVT; nơi khác → câu của mã", () => {
    const e = err("INVENTORY_POLICY_STOCK_CONFLICT", 409);
    expect(inventoryItemErrorMessage(e, "logistics")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.UOM_STOCK_CONFLICT,
    );
    expect(inventoryItemErrorMessage(e, "load")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.INVENTORY_POLICY_STOCK_CONFLICT,
    );
  });

  it("VARIANT_OBSOLETE (BE #121: SKU ngừng dùng) → câu riêng, không phải câu chung", () => {
    const message = inventoryItemErrorMessage(err("VARIANT_OBSOLETE", 409), "logistics");
    expect(message).not.toBe(INVENTORY_ITEM_ERROR_MESSAGES.generic);
    expect(message).toMatch(/ngừng dùng/);
  });

  it("mã lạ → câu chung", () => {
    expect(inventoryItemErrorMessage(err("HTTP_500", 500), "load")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.generic,
    );
    expect(inventoryItemErrorMessage(new Error("boom"), "load")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.generic,
    );
  });

  it("403 → FORBIDDEN", () => {
    expect(inventoryItemErrorMessage(err("HTTP_403", 403), "logistics")).toBe(
      INVENTORY_ITEM_ERROR_MESSAGES.FORBIDDEN,
    );
  });
});

describe("inventoryItemFieldErrors", () => {
  it("BE #121 UOM_CONVERSION_DUPLICATE khi lưu logistics → lỗi trên ô đơn vị tính", () => {
    const e = err("UOM_CONVERSION_DUPLICATE", 409);
    const message = INVENTORY_ITEM_ERROR_MESSAGES.UOM_CONVERSION_DUPLICATE;
    expect(message).toMatch(/đơn vị/);
    expect(inventoryItemFieldErrors(e, "logistics")).toEqual({ unitOfMeasure: message });
    expect(inventoryItemFieldErrors(e, "load")).toEqual({});
  });

  it("không có fieldErrors → rỗng", () => {
    expect(inventoryItemFieldErrors(err("CONFLICT", 409))).toEqual({});
    expect(inventoryItemFieldErrors(null)).toEqual({});
  });
});

describe("isStaleItemError", () => {
  it("OPTIMISTIC_LOCK và INVENTORY_ITEM_NOT_FOUND là stale", () => {
    expect(isStaleItemError(err("OPTIMISTIC_LOCK", 409))).toBe(true);
    expect(isStaleItemError(err("INVENTORY_ITEM_NOT_FOUND", 404))).toBe(true);
    expect(isStaleItemError(err("CONFLICT", 409))).toBe(false);
  });
});
