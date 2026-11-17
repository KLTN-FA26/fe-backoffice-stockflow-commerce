import { describe, expect, it } from "vitest";

import { inventoryItemDtoSchema, inventoryItemPageSchema } from "./schemas";

describe("inventoryItemDtoSchema", () => {
  const logistics = {
    unitOfMeasure: "PCS",
    packageCount: 1,
    packSize: 1,
  };
  const withLogistics = (l: Record<string, unknown>) => ({
    id: "i1",
    sku: "SKU-1",
    version: 2,
    logistics: l,
  });

  it("BE #121 logistics.rotatable: giữ false; response cũ thiếu trường → true", () => {
    const off = inventoryItemDtoSchema.parse(withLogistics({ ...logistics, rotatable: false }));
    expect(off.logistics.rotatable).toBe(false);
    expect(inventoryItemDtoSchema.parse(withLogistics(logistics)).logistics.rotatable).toBe(true);
  });

  it("BE InventoryItemResponse không còn chính sách tồn / đánh giá / lớp lưu trữ (docs 01 BR-17)", () => {
    expect(
      inventoryItemDtoSchema.safeParse(withLogistics({ ...logistics, rotatable: true })).success,
    ).toBe(true);
    expect(
      inventoryItemPageSchema.safeParse({
        items: [{ id: "i1", sku: "SKU-1", unitOfMeasure: "EACH" }],
        page: 0,
        size: 15,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      }).success,
    ).toBe(true);
  });

  it("bỏ qua field lạ (rotatable) từ BE", () => {
    const dto = {
      id: "i1",
      sku: "SKU-1",
      version: 2,
      logistics: {
        unitOfMeasure: "PCS",
        packageCount: 1,
        packSize: 1,
      },
      rotatable: true,
    };
    expect(() => inventoryItemDtoSchema.parse(dto)).not.toThrow();
  });
});
