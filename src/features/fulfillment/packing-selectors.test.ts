import { describe, expect, it } from "vitest";

import {
  LOT_LINE_ID,
  apiSession,
  lotLine,
  packLine,
  packPackage,
  printLine,
  sealedPackage,
  serialLine,
} from "./__fixtures__/packing";
import {
  completionReadiness,
  leftToPack,
  linesMatchingCode,
  lotChoices,
  matchLot,
  openPackages,
  planScan,
  printLinesWaiting,
  visiblePackages,
  voidedPackages,
} from "./packing-selectors";
import { toPackingSession } from "./packing-api";

const session = (overrides: Parameters<typeof apiSession>[0] = {}) =>
  toPackingSession(apiSession(overrides));

describe("planScan — mã quét rơi vào dòng nào (cùng thứ tự với BE PackingSession.lineFor)", () => {
  it("khớp SKU hoặc mã vạch, không phân biệt hoa thường / khoảng trắng", () => {
    const lines = [packLine()];
    expect(planScan(lines, "tee-blk-m")).toMatchObject({ kind: "line" });
    expect(planScan(lines, " 8930000000011 ")).toMatchObject({ kind: "line" });
    expect(linesMatchingCode(lines, "khong-co")).toEqual([]);
  });

  it("không dòng nào khớp → unknown (vẫn gửi cho BE quyết)", () => {
    expect(planScan([packLine()], "XYZ")).toEqual({ kind: "unknown" });
  });

  it("một mã nằm trên hai dòng (cốc trơn + cốc in cùng SKU): lấy dòng DUY NHẤT còn thiếu, hai dòng cùng còn thiếu → phải chọn", () => {
    const plain = packLine({
      sku: "MUG",
      barcode: "1",
      orderLineId: "L-plain",
      wanted: 2,
      remaining: 2,
    });
    const printed = printLine({
      sku: "MUG",
      barcode: "1",
      orderLineId: "L-print",
      wanted: 2,
      remaining: 2,
    });
    expect(planScan([plain, printed], "MUG")).toMatchObject({ kind: "ambiguous" });
    const plainDone = { ...plain, packed: 2, remaining: 0 };
    expect(planScan([plainDone, printed], "MUG")).toMatchObject({
      kind: "line",
      line: { orderLineId: "L-print" },
    });
  });
});

describe("leftToPack / lotChoices", () => {
  it("còn đóng được = min(cần, đã về bàn) − đã đóng", () => {
    expect(leftToPack({ wanted: 5, available: 3, packed: 1 })).toBe(2);
    expect(leftToPack({ wanted: 2, available: 9, packed: 2 })).toBe(0);
  });

  it("chỉ gợi ý lô còn số chưa đóng", () => {
    const line = lotLine({
      lots: [
        { lotNumber: "LOT-A", available: 2, packed: 2 },
        { lotNumber: "LOT-B", available: 2, packed: 1 },
      ],
    });
    expect(lotChoices(line).map((c) => [c.lot.lotNumber, c.left])).toEqual([["LOT-B", 1]]);
  });
});

describe("kiện của phiên", () => {
  const s = session({
    packages: [
      sealedPackage({ packageId: "p2", packageNo: 2, shipmentId: "s1" }),
      packPackage({ packageId: "p1", packageNo: 1 }),
      packPackage({ packageId: "p3", packageNo: 3, status: "VOIDED" }),
    ],
  });

  it("visible: không tính kiện đã huỷ, theo số kiện; open / voided tách riêng", () => {
    expect(visiblePackages(s).map((p) => p.packageNo)).toEqual([1, 2]);
    expect(openPackages(s).map((p) => p.packageNo)).toEqual([1]);
    expect(voidedPackages(s).map((p) => p.packageNo)).toEqual([3]);
  });
});

describe("completionReadiness (BE PackingSession.complete)", () => {
  it("không có kiện niêm phong chờ giao → không hoàn tất được (PACK_NOTHING_TO_SHIP)", () => {
    const r = completionReadiness(session());
    expect(r).toMatchObject({ canFull: false, canPartial: false });
    expect(r.sealed).toHaveLength(0);
  });

  it("kiện mở đã có hàng chặn mọi cách hoàn tất (PACKAGE_NOT_SEALED); kiện mở rỗng thì không", () => {
    const withGoods = session({
      packages: [
        sealedPackage(),
        packPackage({
          packageId: "p2",
          packageNo: 2,
          contents: [{ orderLineId: LOT_LINE_ID, sku: "X", quantity: 1 }],
        }),
      ],
      lines: [packLine({ packed: 3, remaining: 0 })],
    });
    expect(completionReadiness(withGoods)).toMatchObject({ canFull: false, canPartial: false });
    const withEmpty = session({
      packages: [sealedPackage(), packPackage({ packageId: "p2", packageNo: 2 })],
      lines: [packLine({ packed: 3, remaining: 0 })],
    });
    expect(completionReadiness(withEmpty).canFull).toBe(true);
  });

  it("đóng đủ → giao đủ; còn dòng thiếu → chỉ giao được một phần", () => {
    const full = session({
      packages: [sealedPackage()],
      lines: [packLine({ packed: 3, remaining: 0 })],
    });
    expect(completionReadiness(full)).toMatchObject({ canFull: true, canPartial: false });
    const partial = session({
      packages: [sealedPackage()],
      lines: [packLine({ packed: 3, remaining: 0 }), serialLine()],
    });
    const r = completionReadiness(partial);
    expect(r).toMatchObject({ canFull: false, canPartial: true });
    expect(r.missing.map((l) => l.sku)).toEqual(["HOODIE-BLK-L"]);
  });

  it("kiện đã vào lô giao không tính là chờ giao", () => {
    const shipped = session({
      packages: [sealedPackage({ shipmentId: "s1" })],
      lines: [packLine({ packed: 3, shipped: 3, remaining: 0 })],
    });
    expect(completionReadiness(shipped).sealed).toHaveLength(0);
  });
});

describe("matchLot — lô gõ / quét khớp lô đã lấy", () => {
  it("không phân biệt hoa thường, bỏ khoảng trắng; trả đúng tên lô BE; lô lạ / rỗng → undefined", () => {
    const line = lotLine();
    expect(matchLot(line, "  lot-b ")?.lotNumber).toBe("LOT-B");
    expect(matchLot(line, "LOT-Z")).toBeUndefined();
    expect(matchLot(line, "   ")).toBeUndefined();
  });
});

describe("printLinesWaiting — hàng in chưa về bàn đóng gói (BE PR #150, PACK-EARLY)", () => {
  const waiting = session({ lines: [packLine(), printLine({ available: 0, remaining: 2 })] });
  const ready = session({ lines: [packLine(), printLine()] });

  it("cờ printLinesReady của đơn là nguồn chính", () => {
    expect(printLinesWaiting(ready, false)).toBe(true);
    expect(printLinesWaiting(waiting, true)).toBe(false);
  });

  it("đơn không có dòng in thì không bao giờ 'chờ in' dù cờ false", () => {
    expect(printLinesWaiting(session({ lines: [packLine()] }), false)).toBe(false);
  });

  it("không có cờ (không đọc được đơn) → suy từ phiên: dòng in còn cần mà 'đã về bàn' = 0", () => {
    expect(printLinesWaiting(waiting)).toBe(true);
    expect(printLinesWaiting(waiting, null)).toBe(true);
    expect(printLinesWaiting(ready)).toBe(false);
    // Dòng in đã đóng hết (cần 0) không tính là đang chờ
    expect(
      printLinesWaiting(session({ lines: [printLine({ wanted: 0, available: 0, remaining: 0 })] })),
    ).toBe(false);
  });
});
