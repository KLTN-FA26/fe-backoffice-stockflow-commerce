import { describe, expect, it } from "vitest";

import {
  PackError,
  applyRemove,
  applyScan,
  openParcel,
  packedOf,
  planCompletion,
  sealParcel,
  voidParcel,
} from "./mock-packing-session";

import type { PackLineState, PackSessionState } from "./mock-packing-session";

const line = (over: Partial<PackLineState> = {}): PackLineState => ({
  orderLineId: "L1",
  sku: "MUG",
  barcode: "893",
  printLine: false,
  wanted: 4,
  available: 4,
  lots: { "LOT-A": 2, "LOT-B": 2 },
  serials: [],
  unitPrice: 1000,
  ...over,
});

const session = (lines: PackLineState[] = [line()]): PackSessionState => ({
  taskId: "T",
  orderNumber: "SO-1",
  lines,
  parcels: [],
  shipments: [],
  scans: new Map(),
});

const code = (run: () => void): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof PackError) return error.code;
    throw error;
  }
  return "OK";
};

let n = 0;
const scan = (s: PackSessionState, packageId: string, over: Record<string, unknown> = {}) =>
  applyScan(s, { scanId: `S${(n += 1)}`, packageId, scannedCode: "MUG", quantity: 1, ...over });

describe("mock PackingSession — lô, serial và luật quét (chép BE PR #136)", () => {
  it("dòng theo lô: thiếu lô → 400; lô lạ / hết lô → PACK_LOT_MISMATCH; đúng lô thì gộp vào kiện", () => {
    const s = session();
    const p = openParcel(s, "P1", "CARTON");
    expect(code(() => scan(s, p.packageId))).toBe("VALIDATION_FAILED");
    expect(code(() => scan(s, p.packageId, { lotNumber: "LOT-Z" }))).toBe("PACK_LOT_MISMATCH");
    scan(s, p.packageId, { lotNumber: "lot-a", quantity: 2 });
    expect(code(() => scan(s, p.packageId, { lotNumber: "LOT-A" }))).toBe("PACK_LOT_MISMATCH");
    scan(s, p.packageId, { lotNumber: "LOT-B" });
    expect(p.contents).toEqual([
      { orderLineId: "L1", lotNumber: "LOT-A", serialNumber: undefined, quantity: 2 },
      { orderLineId: "L1", lotNumber: "LOT-B", serialNumber: undefined, quantity: 1 },
    ]);
    expect(packedOf(s, "L1")).toBe(3);
  });

  it("dòng không theo lô mà gửi lô → PACK_LOT_MISMATCH; vượt số cần / số đã về → hai mã riêng", () => {
    const s = session([line({ lots: {}, wanted: 3, available: 2 })]);
    const p = openParcel(s, "P1", "CARTON");
    expect(code(() => scan(s, p.packageId, { lotNumber: "X" }))).toBe("PACK_LOT_MISMATCH");
    expect(code(() => scan(s, p.packageId, { quantity: 4 }))).toBe("PACK_QUANTITY_EXCEEDS_ORDER");
    expect(code(() => scan(s, p.packageId, { quantity: 3 }))).toBe("PACK_QUANTITY_EXCEEDS_PICKED");
    scan(s, p.packageId, { quantity: 2 });
  });

  it("mã trên hai dòng: một dòng còn thiếu thì chọn dòng đó; cả hai còn thiếu → PACK_SCAN_AMBIGUOUS", () => {
    const a = line({ orderLineId: "A", lots: {}, wanted: 1, available: 1 });
    const b = line({ orderLineId: "B", lots: {}, wanted: 1, available: 1, printLine: true });
    const s = session([a, b]);
    const p = openParcel(s, "P1", "CARTON");
    expect(code(() => scan(s, p.packageId))).toBe("PACK_SCAN_AMBIGUOUS");
    scan(s, p.packageId, { orderLineId: "B" });
    scan(s, p.packageId);
    expect(packedOf(s, "A")).toBe(1);
    expect(code(() => scan(s, p.packageId, { orderLineId: "ZZ" }))).toBe("PACK_ITEM_NOT_IN_ORDER");
  });

  it("scanId: cùng kiện → không đổi; kiện khác → PACK_SCAN_ID_CONFLICT; số lượng ngoài 1..1.000.000 → 400", () => {
    const s = session([line({ lots: {}, wanted: 5, available: 5 })]);
    const p1 = openParcel(s, "P1", "CARTON");
    const p2 = openParcel(s, "P2", "CARTON");
    scan(s, p1.packageId, { scanId: "same" });
    scan(s, p1.packageId, { scanId: "same" });
    expect(packedOf(s, "L1")).toBe(1);
    expect(code(() => scan(s, p2.packageId, { scanId: "same" }))).toBe("PACK_SCAN_ID_CONFLICT");
    expect(code(() => scan(s, p1.packageId, { quantity: 0 }))).toBe("VALIDATION_FAILED");
    expect(code(() => scan(s, p1.packageId, { quantity: 1_000_001 }))).toBe("VALIDATION_FAILED");
  });

  it("bớt hàng: cùng scanId không bớt hai lần; kiện giữ nhiều lô mà không nêu lô → 400", () => {
    const s = session();
    const p = openParcel(s, "P1", "CARTON");
    scan(s, p.packageId, { lotNumber: "LOT-A" });
    scan(s, p.packageId, { lotNumber: "LOT-B" });
    const input = { packageId: p.packageId, orderLineId: "L1", quantity: 1, scanId: "R1" };
    expect(code(() => applyRemove(s, input))).toBe("VALIDATION_FAILED");
    applyRemove(s, { ...input, lotNumber: "LOT-A" });
    applyRemove(s, { ...input, lotNumber: "LOT-A" });
    expect(packedOf(s, "L1")).toBe(1);
    expect(code(() => applyRemove(s, { ...input, scanId: "R2", lotNumber: "LOT-A" }))).toBe(
      "PACK_STATE_CONFLICT",
    );
  });

  it("niêm phong → kiện không nhận thêm hàng; huỷ kiện trả hàng về chưa đóng; hoàn tất chỉ ship kiện niêm phong", () => {
    const s = session([line({ lots: {}, wanted: 2, available: 2 })]);
    const p = openParcel(s, "P1", "CARTON");
    expect(code(() => sealParcel(s, p.packageId, {}, "t"))).toBe("PACKAGE_EMPTY");
    scan(s, p.packageId, { quantity: 2 });
    expect(code(() => sealParcel(s, p.packageId, {}, "t"))).toBe("VALIDATION_FAILED");
    expect(code(() => planCompletion(s, false, undefined))).toBe("PACKAGE_NOT_SEALED");
    const sealed = sealParcel(
      s,
      p.packageId,
      { weightKg: 2, lengthCm: 60, widthCm: 20, heightCm: 10 },
      "t",
    );
    expect(sealed.dimWeightKg).toBe(2);
    expect(code(() => scan(s, p.packageId))).toBe("PACKAGE_SEALED");
    const plan = planCompletion(s, false, undefined);
    expect(plan).toMatchObject({ partial: false });
    expect([...plan.lineTotals]).toEqual([["L1", 2]]);
    voidParcel(s, p.packageId);
    expect(packedOf(s, "L1")).toBe(0);
    expect(code(() => planCompletion(s, false, undefined))).toBe("PACK_NOTHING_TO_SHIP");
  });
});
