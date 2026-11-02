import { describe, expect, it } from "vitest";

import { CARTON_UNITS, apiLine, cartonLine, cartonPackage } from "./__fixtures__/receipt";
import {
  cartonUnitOptions,
  countLineCartonContexts,
  countedIntoCartons,
  defaultCartonUnit,
  lineLockedByCartons,
  liveSelection,
  liveCartons,
  looseRemainder,
  newCartons,
  unitFactorOf,
  unitsBySku,
} from "./carton-selectors";

import type { ReceiptUnitDto } from "./types";

const PCS = CARTON_UNITS[0] as ReceiptUnitDto;
const CARTON = CARTON_UNITS[1] as ReceiptUnitDto;
const PACK = CARTON_UNITS[2] as ReceiptUnitDto;
const retired = (unit: ReceiptUnitDto) => ({ ...unit, active: false });

describe("cartonUnitOptions — đơn vị thùng chọn được (BE spec SCRUM-473 §3 rule 3)", () => {
  it("chỉ đơn vị đóng gói đang dùng, bỏ đơn vị cơ sở", () => {
    expect(cartonUnitOptions({ units: CARTON_UNITS }).map((u) => u.unitOfMeasure)).toEqual([
      "CARTON",
      "PACK",
    ]);
  });

  it("giữ đơn vị đã ngưng dùng khi là đơn vị của dòng hoặc đơn vị đặt trên PO (BE #219)", () => {
    const units = [PCS, retired(CARTON), retired(PACK)];
    expect(
      cartonUnitOptions({ units, unitOfMeasure: "CARTON" }).map((u) => u.unitOfMeasure),
    ).toEqual(["CARTON"]);
    expect(
      cartonUnitOptions({ units, orderedUnitOfMeasure: "PACK" }).map((u) => u.unitOfMeasure),
    ).toEqual(["PACK"]);
  });
});

describe("defaultCartonUnit — thứ tự chọn sẵn", () => {
  it("đơn vị của dòng thắng, kể cả khi đã ngưng dùng", () => {
    const units = [PCS, retired(CARTON), PACK];
    expect(
      defaultCartonUnit({ units, unitOfMeasure: "CARTON", orderedUnitOfMeasure: "PACK" }),
    ).toBe("CARTON");
  });

  it("dòng chưa có đơn vị → đơn vị đặt trên PO", () => {
    expect(defaultCartonUnit({ units: CARTON_UNITS, orderedUnitOfMeasure: "PACK" })).toBe("PACK");
  });

  it("→ đơn vị mua mặc định nếu không phải đơn vị cơ sở", () => {
    expect(defaultCartonUnit({ units: CARTON_UNITS })).toBe("CARTON");
  });

  it("→ đơn vị đóng gói duy nhất", () => {
    expect(defaultCartonUnit({ units: [PCS, { ...PACK, defaultPurchase: false }] })).toBe("PACK");
  });

  it("mặt hàng không có đơn vị đóng gói → null", () => {
    expect(defaultCartonUnit({ units: [PCS] })).toBeNull();
    expect(defaultCartonUnit({ units: [] })).toBeNull();
  });

  it("nhiều đơn vị đóng gói, không có mặc định → null (người dùng tự chọn)", () => {
    const units = [PCS, { ...CARTON, defaultPurchase: false }, PACK];
    expect(defaultCartonUnit({ units })).toBeNull();
  });
});

describe("số lượng thùng / hàng lẻ (BE spec §3 rule 5)", () => {
  it("ví dụ issue #104: 4.990 − (1.000 + 980) = 3.010 lẻ", () => {
    const packages = [{ quantity: 1000 }, { quantity: 980 }];
    expect(countedIntoCartons(packages)).toBe(1980);
    expect(looseRemainder(4990, packages)).toBe(3010);
  });

  it("thùng vượt dòng → phần lẻ âm (form báo lỗi)", () => {
    expect(looseRemainder(100, [{ quantity: 120 }])).toBe(-20);
  });

  it("newCartons(3, 1000) → 3 thùng mới (chưa có LPN) điền sẵn factor", () => {
    expect(newCartons(3, 1000)).toEqual([
      { lpn: "", quantity: 1000 },
      { lpn: "", quantity: 1000 },
      { lpn: "", quantity: 1000 },
    ]);
  });

  it("unitFactorOf: theo mã, không phân biệt hoa thường", () => {
    expect(unitFactorOf(CARTON_UNITS, "carton")).toBe(1000);
    expect(unitFactorOf(CARTON_UNITS, "BOX")).toBeNull();
  });
});

describe("thùng của dòng", () => {
  it("liveCartons: RECEIVING / IN_STOCK — thùng in nhãn được", () => {
    const line = cartonLine({
      packages: [
        cartonPackage({ status: "IN_STOCK" }),
        cartonPackage({ lpn: "LPN-20261024-000002", status: "CONSUMED" }),
        cartonPackage({ lpn: "LPN-20261024-000003", status: "LOST" }),
      ],
    });
    expect(liveCartons(line).map((p) => p.lpn)).toEqual(["LPN-20261024-000001"]);
  });

  it("lineLockedByCartons: dòng có thùng thì khoá lô / dòng PO / xoá dòng", () => {
    expect(lineLockedByCartons(cartonLine())).toBe(true);
    expect(lineLockedByCartons(apiLine())).toBe(false);
  });

  it("unitsBySku: đơn vị theo SKU của các dòng đã lưu (Q1 — dòng chưa lưu cùng SKU dùng lại)", () => {
    const map = unitsBySku([
      cartonLine(),
      apiLine({ sku: "SOFA-3S-GREY" }),
      apiLine({ sku: null }),
    ]);
    expect(map.get("TABLE-OAK-160")).toEqual(CARTON_UNITS);
    expect(map.has("SOFA-3S-GREY")).toBe(false);
    expect(map.size).toBe(1);
  });
});

describe("countLineCartonContexts — dòng form ↔ dòng đã lưu", () => {
  const saved = [cartonLine({ lotNumber: "L01" })];
  const poLineId = saved[0]?.purchaseOrderLineId ?? "";
  const contextOf = (row: Parameters<typeof countLineCartonContexts>[1][number]) =>
    countLineCartonContexts(saved, [row])[0];

  it("dòng đã lưu có thùng: đơn vị, thùng đã lưu, bị khoá", () => {
    const ctx = contextOf({
      purchaseOrderLineId: poLineId,
      lotNumber: "L01",
      sku: "TABLE-OAK-160",
    });
    expect(ctx).toMatchObject({
      unitOfMeasure: "CARTON",
      orderedUnitOfMeasure: "CARTON",
      locked: true,
    });
    expect(ctx?.savedPackages).toHaveLength(2);
    expect(ctx?.units).toEqual(CARTON_UNITS);
  });

  it("dòng chưa lưu cùng SKU (vd vừa tách lô) dùng lại đơn vị, không khoá, đơn vị đặt trên PO theo dòng PO", () => {
    const ctx = contextOf({
      purchaseOrderLineId: poLineId,
      lotNumber: "L02",
      sku: "TABLE-OAK-160",
    });
    expect(ctx).toMatchObject({
      unitOfMeasure: null,
      orderedUnitOfMeasure: "CARTON",
      locked: false,
    });
    expect(ctx?.units).toEqual(CARTON_UNITS);
  });

  it("SKU chưa có dòng nào lưu → chưa có đơn vị (phải lưu trước)", () => {
    expect(contextOf({ purchaseOrderLineId: "other", lotNumber: "", sku: "SOFA" })?.units).toEqual(
      [],
    );
  });

  it("phiếu không có PO: ghép theo SKU + lô", () => {
    const blind = [cartonLine({ purchaseOrderLineId: null, sku: "SOFA-3S-GREY", lotNumber: null })];
    const [ctx] = countLineCartonContexts(blind, [{ lotNumber: "", sku: "SOFA-3S-GREY" }]);
    expect(ctx?.locked).toBe(true);
  });
});

describe("countLineCartonContexts — chỉ dòng gốc nhận khoá của dòng đã lưu", () => {
  const saved = [cartonLine({ lotNumber: null })];
  const poLineId = saved[0]?.purchaseOrderLineId ?? "";
  const savedLpns = (saved[0]?.packages ?? []).map(({ lpn, quantity }) => ({ lpn, quantity }));
  const row = (lotNumber: string, packages: { lpn: string }[] = []) => ({
    purchaseOrderLineId: poLineId,
    lotNumber,
    sku: "TABLE-OAK-160",
    packages,
  });

  it("dòng 'Tách lô' cùng dòng PO, lô còn trống → không khoá, không mang thùng của dòng gốc", () => {
    const [original, split] = countLineCartonContexts(saved, [row("", savedLpns), row("")]);
    expect(original).toMatchObject({ locked: true, unitOfMeasure: "CARTON" });
    expect(split).toMatchObject({ locked: false, unitOfMeasure: null, savedPackages: [] });
    expect(split?.units).toEqual(CARTON_UNITS);
  });

  it("dòng đứng trước đổi lô trùng dòng gốc → khoá vẫn theo dòng giữ LPN", () => {
    const [earlier, original] = countLineCartonContexts(saved, [row(""), row("", savedLpns)]);
    expect(earlier?.locked).toBe(false);
    expect(original?.locked).toBe(true);
  });

  it("dòng gốc đã bỏ hết thùng trên form → vẫn khoá (BE giữ khoá dòng từng có thùng)", () => {
    const [original, split] = countLineCartonContexts(saved, [row(""), row("")]);
    expect(original?.locked).toBe(true);
    expect(split?.locked).toBe(false);
  });
});

describe("liveSelection — chỉ in lại thùng còn hiệu lực", () => {
  it("bỏ LPN đã tick nhưng nay đã dùng hết / không còn trên dòng", () => {
    const line = cartonLine({
      packages: [
        cartonPackage({ status: "IN_STOCK" }),
        cartonPackage({ lpn: "LPN-20261024-000002", status: "CONSUMED" }),
      ],
    });
    const ticked = new Set(["LPN-20261024-000001", "LPN-20261024-000002", "LPN-GONE"]);
    expect(liveSelection(ticked, line)).toEqual(["LPN-20261024-000001"]);
  });
});
