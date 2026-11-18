import { describe, expect, it } from "vitest";

import { toLogisticsRequest } from "./api";
import {
  inventoryItemDtoSchema,
  inventoryItemSummaryDtoSchema,
  logisticsFormSchema,
} from "./schemas";
import { logisticsToForm } from "./selectors";

/** BE `InventoryItemResponse` hiện tại: chỉ còn logistics (không policy / evaluation / storageClass). */
const dto = (logistics: Record<string, unknown> = {}) => ({
  id: "i1",
  sku: "SKU-1",
  version: 2,
  logistics: { unitOfMeasure: "EACH", packageCount: 1, packSize: 1, rotatable: true, ...logistics },
});

describe("inventoryItemDtoSchema (BE InventoryItemResponse)", () => {
  it("parse response không có policy / evaluation / storageClass; số đo vắng là undefined", () => {
    const item = inventoryItemDtoSchema.parse(dto({ weightKg: "0.020" }));
    expect(item).toMatchObject({ id: "i1", version: 2, logistics: { weightKg: 0.02 } });
    expect(item.logistics.lengthCm).toBeUndefined();
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

  it("số đo dương hoặc trống; số kiện / quy cách nguyên ≥ 1", () => {
    expect(paths({ weightKg: "0" })).toEqual(["weightKg"]);
    expect(paths({ lengthCm: "", packSize: "" })).toEqual([]);
    expect(paths({ packageCount: "0" })).toEqual(["packageCount"]);
    expect(paths({ packSize: "1.5" })).toEqual(["packSize"]);
  });

  it("request: trống → null, luôn gửi rotatable, không còn trường lưu kho / QC / ký nhận", () => {
    const body = toLogisticsRequest({ ...values, barcode: " ", weightKg: "2.5" }, 3);
    expect(body).toMatchObject({ version: 3, barcode: null, weightKg: 2.5, rotatable: true });
    for (const gone of ["storageClass", "qcRequired", "requiresAdultSignature"]) {
      expect(body).not.toHaveProperty(gone);
    }
  });
});
