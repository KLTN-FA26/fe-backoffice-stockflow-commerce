import { describe, expect, it } from "vitest";

import { toLogisticsRequest } from "./api";
import {
  inventoryItemDtoSchema,
  inventoryItemSummaryDtoSchema,
  logisticsFormSchema,
} from "./schemas";
import { logisticsToForm } from "./selectors";

/**
 * BE `InventoryItemResponse` sau BE #396 (V20261215000100, docs 01 BR-03): logistics chỉ còn đơn vị tính, mã vạch,
 * cờ xoay — số đo là của thùng, nằm ở quy cách thùng.
 */
const dto = (logistics: Record<string, unknown> = {}) => ({
  id: "i1",
  sku: "SKU-1",
  version: 2,
  logistics: { unitOfMeasure: "EACH", barcode: "893", rotatable: true, ...logistics },
});

/** 10 trường số đo BE cũ còn trả trước #396 — FE phải chạy được với cả BE cũ lẫn mới. */
const OLD_MEASURES = {
  weightKg: "0.020",
  lengthCm: 10,
  widthCm: 5,
  heightCm: 2,
  packageWeightKg: 1,
  packageLengthCm: 30,
  packageWidthCm: 20,
  packageHeightCm: 10,
  packageCount: 1,
  packSize: 50,
};

describe("inventoryItemDtoSchema (BE InventoryItemResponse)", () => {
  it("BE #396: logistics chỉ có đơn vị tính, mã vạch, cờ xoay — parse được, không còn số đo", () => {
    expect(inventoryItemDtoSchema.parse(dto())).toEqual({
      id: "i1",
      sku: "SKU-1",
      version: 2,
      logistics: { unitOfMeasure: "EACH", barcode: "893", rotatable: true },
    });
  });

  it("BE cũ còn trả 10 trường số đo: vẫn parse, bỏ các trường đó", () => {
    const item = inventoryItemDtoSchema.parse(dto(OLD_MEASURES));
    expect(item.logistics).toEqual({ unitOfMeasure: "EACH", barcode: "893", rotatable: true });
  });

  it("rotatable: giữ false; vắng → true như BE", () => {
    expect(inventoryItemDtoSchema.parse(dto({ rotatable: false })).logistics.rotatable).toBe(false);
    const { rotatable: _r, ...without } = dto().logistics;
    void _r;
    expect(inventoryItemDtoSchema.parse({ ...dto(), logistics: without }).logistics.rotatable).toBe(
      true,
    );
  });

  it("dòng danh sách chỉ có id, sku, đơn vị tính, mã vạch (BE non_null bỏ mã vạch trống)", () => {
    expect(
      inventoryItemSummaryDtoSchema.parse({ id: "i1", sku: "A", unitOfMeasure: "EACH" }),
    ).toEqual({ id: "i1", sku: "A", unitOfMeasure: "EACH" });
  });
});

describe("logisticsFormSchema (BE UpdateItemLogisticsRequest)", () => {
  const values = logisticsToForm(inventoryItemDtoSchema.parse(dto()).logistics);
  const paths = (over: Record<string, unknown>) => {
    const r = logisticsFormSchema.safeParse({ ...values, ...over });
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("đơn vị tính 1–16 chữ in hoa / số / _; mã vạch ≤ 64", () => {
    expect(paths({})).toEqual([]);
    expect(paths({ unitOfMeasure: "each" })).toEqual(["unitOfMeasure"]);
    expect(paths({ barcode: "x".repeat(65) })).toEqual(["barcode"]);
  });

  it("form chỉ còn đơn vị tính, mã vạch, cờ xoay", () => {
    expect(Object.keys(values).sort()).toEqual(["barcode", "rotatable", "unitOfMeasure"]);
  });

  it("request BE #396: đúng version, đơn vị tính, mã vạch (trống → null), cờ xoay — không gửi số đo", () => {
    const body = toLogisticsRequest({ ...values, unitOfMeasure: " EACH ", barcode: " " }, 3);
    expect(body).toEqual({ version: 3, unitOfMeasure: "EACH", barcode: null, rotatable: true });
  });
});
