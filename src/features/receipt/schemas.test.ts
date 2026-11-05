import { describe, expect, it } from "vitest";

import { apiLine, cartonLine } from "./__fixtures__/receipt";
import { beReceiptLineSchema } from "./schemas";

describe("beReceiptLineSchema — thùng có LPN (BE GoodsReceiptResponse.Line, SCRUM-473)", () => {
  it("parse dòng có 2 thùng + đơn vị (ví dụ issue #104: 4.990 = 1.000 + 980 + 3.010 lẻ)", () => {
    const line = beReceiptLineSchema.parse(cartonLine());
    expect(line.unitOfMeasure).toBe("CARTON");
    expect(line.looseQuantity).toBe(3010);
    expect(line.packages.map((p) => [p.lpn, p.receivedQty, p.nominalQty])).toEqual([
      ["LPN-20261024-000001", 1000, 1000],
      ["LPN-20261024-000002", 980, 1000],
    ]);
    expect(line.units[0]).toMatchObject({ unitOfMeasure: "PCS", base: true, factor: 1 });
    expect(line.orderedUnitOfMeasure).toBe("CARTON");
  });

  it("dòng không gửi packages / units (phiếu cũ) → mảng rỗng", () => {
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
