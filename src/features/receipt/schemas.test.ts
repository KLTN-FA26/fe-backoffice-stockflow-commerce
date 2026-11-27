import { describe, expect, it } from "vitest";

import { apiLine, apiReceipt, cartonLine } from "./__fixtures__/receipt";
import { beGoodsReceiptSchema, beReceiptLineSchema } from "./schemas";

describe("beReceiptLineSchema — thùng có LPN (BE GoodsReceiptResponse.Line, SCRUM-473)", () => {
  it("parse dòng có 2 thùng + đơn vị (ví dụ issue #104: 4.990 = 1.000 + 980 + 3.010 lẻ)", () => {
    const line = beReceiptLineSchema.parse(cartonLine());
    expect(line.unitOfMeasure).toBe("CARTON");
    expect(line.looseQuantity).toBe(3010);
    expect(line.packages.map((p) => [p.lpn, p.quantity, p.nominalQty, p.countedAt])).toEqual([
      ["LPN-20261024-000001", 1000, 1000, "2026-10-24T03:00:00Z"],
      ["LPN-20261024-000002", 980, 1000, "2026-10-24T03:00:00Z"],
    ]);
    expect(line.units[0]).toMatchObject({ unitOfMeasure: "PCS", base: true, factor: 1 });
  });

  // ADR-0011 (BE, issue #305): `countedAt` thay `receivedQty`; null khi thùng mới dán nhãn.
  it("thùng mới dán nhãn chưa đếm → countedAt null", () => {
    const labelled = cartonLine();
    const [first] = labelled.packages;
    const line = beReceiptLineSchema.parse({
      ...labelled,
      packages: [{ ...first, countedAt: null }],
    });
    expect(line.packages[0]?.countedAt).toBeNull();
  });

  it("dòng không gửi packages / units → mảng rỗng", () => {
    const { packages: _p, units: _u, ...legacy } = apiLine();
    const line = beReceiptLineSchema.parse(legacy);
    expect(line.packages).toEqual([]);
    expect(line.units).toEqual([]);
  });

  it("status thùng ngoài enum BE (vd VOID — BE không bao giờ trả) → lỗi hợp đồng", () => {
    const bad = cartonLine();
    const [first] = bad.packages;
    expect(() =>
      beReceiptLineSchema.parse({ ...bad, packages: [{ ...first, status: "VOID" }] }),
    ).toThrow();
  });
});

describe("beReceiptLineSchema — dòng theo Đơn sản xuất (4A-5)", () => {
  it("parse tiến độ thùng / cái của dòng Đơn sản xuất", () => {
    const line = beReceiptLineSchema.parse(apiLine());
    expect(line.production).toMatchObject({
      unitsPerCarton: 50,
      orderedCartons: 10,
      receivedCartons: 4,
      thisReceiptCartons: 2,
      remainingCartons: 4,
    });
  });

  it("dòng phiếu mua hàng cũ: productionOrderLineId / production null", () => {
    const line = beReceiptLineSchema.parse(
      apiLine({ productionOrderLineId: null, production: null }),
    );
    expect(line.productionOrderLineId).toBeNull();
    expect(line.production).toBeNull();
  });

  it("field cũ của BE (QC, dòng PO) bị bỏ qua, không lọt vào model", () => {
    const line = beReceiptLineSchema.parse({
      ...apiLine(),
      qcRequired: true,
      purchaseOrderLineId: "x",
    });
    expect(line).not.toHaveProperty("qcRequired");
    expect(line).not.toHaveProperty("purchaseOrderLineId");
  });
});

describe("beGoodsReceiptSchema — loại phiếu", () => {
  it("receiptType ngoài enum BE → lỗi hợp đồng", () => {
    expect(() =>
      beGoodsReceiptSchema.parse(apiReceipt({ receiptType: "BLIND" as never })),
    ).toThrow();
  });

  it("trạng thái IN_QC đã bỏ cùng QC ở kho (BR-07) → lỗi hợp đồng", () => {
    expect(() => beGoodsReceiptSchema.parse(apiReceipt({ status: "IN_QC" as never }))).toThrow();
  });
});
