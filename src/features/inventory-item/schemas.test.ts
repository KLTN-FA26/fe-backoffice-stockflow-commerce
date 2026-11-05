import { describe, expect, it } from "vitest";

import { inventoryItemDtoSchema, policyFormSchema } from "./schemas";

const validPolicy = {
  reorderPoint: "10",
  safetyStock: "5",
  maxQty: "100",
  maxShelfLifeDays: "",
  removalStrategy: "FIFO",
  trackingMode: "NONE",
  expiryTracked: false,
} as const;

function pathsOf(input: Record<string, unknown>): string[] {
  const r = policyFormSchema.safeParse({ ...validPolicy, ...input });
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

describe("policyFormSchema (BE PR #119 StockPolicy.validate)", () => {
  it("chính sách hợp lệ", () => {
    expect(policyFormSchema.safeParse(validPolicy).success).toBe(true);
  });

  it("BR StockPolicy: tồn an toàn > điểm đặt lại → lỗi ở safetyStock", () => {
    expect(pathsOf({ reorderPoint: "10", safetyStock: "11", maxQty: "" })).toEqual(["safetyStock"]);
  });

  it("maxQty < reorderPoint hoặc < safetyStock → lỗi ở maxQty", () => {
    expect(pathsOf({ maxQty: "5", reorderPoint: "10" })).toContain("maxQty");
    expect(pathsOf({ maxQty: "3", reorderPoint: "", safetyStock: "4" })).toContain("maxQty");
  });

  it("expiryTracked + trackingMode NONE → lỗi ở expiryTracked", () => {
    expect(pathsOf({ expiryTracked: true, trackingMode: "NONE", removalStrategy: "FEFO" })).toEqual(
      ["expiryTracked"],
    );
  });

  it("expiryTracked + LOT + FIFO → lỗi", () => {
    expect(pathsOf({ expiryTracked: true, trackingMode: "LOT", removalStrategy: "FIFO" })).toEqual([
      "expiryTracked",
    ]);
  });

  it("expiryTracked + LOT + FEFO → hợp lệ", () => {
    expect(pathsOf({ expiryTracked: true, trackingMode: "LOT", removalStrategy: "FEFO" })).toEqual(
      [],
    );
  });

  it("maxShelfLifeDays 0 / 36501 → lỗi; 1 và 36500 hợp lệ", () => {
    const base = { expiryTracked: true, trackingMode: "LOT", removalStrategy: "FEFO" };
    expect(pathsOf({ ...base, maxShelfLifeDays: "0" })).toEqual(["maxShelfLifeDays"]);
    expect(pathsOf({ ...base, maxShelfLifeDays: "36501" })).toEqual(["maxShelfLifeDays"]);
    expect(pathsOf({ ...base, maxShelfLifeDays: "1" })).toEqual([]);
    expect(pathsOf({ ...base, maxShelfLifeDays: "36500" })).toEqual([]);
  });

  it("maxShelfLifeDays có số khi tắt theo dõi hạn dùng → form chấp nhận (toPolicyRequest gửi null)", () => {
    expect(pathsOf({ maxShelfLifeDays: "30", expiryTracked: false })).toEqual([]);
  });

  it("'1e2' / '0x10' không phải số nguyên → lỗi ở đúng ô", () => {
    expect(pathsOf({ reorderPoint: "1e2", safetyStock: "", maxQty: "" })).toEqual(["reorderPoint"]);
    expect(pathsOf({ maxQty: "0x10" })).toEqual(["maxQty"]);
    const base = { expiryTracked: true, trackingMode: "LOT", removalStrategy: "FEFO" };
    expect(pathsOf({ ...base, maxShelfLifeDays: "1e2" })).toEqual(["maxShelfLifeDays"]);
  });

  it("'1.5' và '-1' là lỗi ở đúng ô; rỗng / khoảng trắng hợp lệ", () => {
    expect(pathsOf({ reorderPoint: "1.5", safetyStock: "", maxQty: "" })).toEqual(["reorderPoint"]);
    expect(pathsOf({ safetyStock: "-1" })).toEqual(["safetyStock"]);
    expect(pathsOf({ maxQty: "1.5" })).toEqual(["maxQty"]);
    expect(pathsOf({ reorderPoint: "", safetyStock: "  ", maxQty: "" })).toEqual([]);
  });
});

describe("inventoryItemDtoSchema", () => {
  const logistics = {
    unitOfMeasure: "PCS",
    packageCount: 1,
    packSize: 1,
    storageClass: "NORMAL",
    requiresAdultSignature: false,
    qcRequired: false,
  };
  const withLogistics = (l: Record<string, unknown>) => ({
    id: "i1",
    sku: "SKU-1",
    version: 2,
    logistics: l,
    policy: { removalStrategy: "FIFO", trackingMode: "NONE", expiryTracked: false },
    evaluation: { usableOnHand: 0 },
  });

  it("BE #121 logistics.rotatable: giữ false; response cũ thiếu trường → true", () => {
    const off = inventoryItemDtoSchema.parse(withLogistics({ ...logistics, rotatable: false }));
    expect(off.logistics.rotatable).toBe(false);
    expect(inventoryItemDtoSchema.parse(withLogistics(logistics)).logistics.rotatable).toBe(true);
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
        storageClass: "NORMAL",
        requiresAdultSignature: false,
        qcRequired: false,
      },
      policy: {
        reorderPoint: null,
        safetyStock: null,
        removalStrategy: "FIFO",
        trackingMode: "NONE",
        expiryTracked: false,
      },
      evaluation: { usableOnHand: 0 },
      rotatable: true,
    };
    expect(() => inventoryItemDtoSchema.parse(dto)).not.toThrow();
  });
});
