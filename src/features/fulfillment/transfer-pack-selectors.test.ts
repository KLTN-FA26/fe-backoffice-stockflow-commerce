import { describe, expect, it } from "vitest";

import {
  PARCEL_2_ID,
  kitLine,
  lotALine,
  lotBLine,
  sealedParcel,
  tLine,
  tParcel,
  tSession,
} from "./__fixtures__/transfer-pack";
import {
  isAsIsCarton,
  isKitPart,
  isCartonAsIsReason,
  kitCandidateLines,
  parcelReasonText,
  openTransferParcels,
  planTransferScan,
  transferCompletionReadiness,
  transferParcelUnits,
  visibleTransferParcels,
  voidedTransferParcels,
} from "./transfer-pack-selectors";

describe("kiện của phiên", () => {
  const session = tSession({
    packages: [
      tParcel({ packageNo: 3, status: "OPEN" }),
      sealedParcel({ packageNo: 1 }),
      tParcel({ packageNo: 2, packageId: PARCEL_2_ID, status: "VOIDED", labelCode: "X" }),
    ],
  });

  it("kiện chưa huỷ theo số kiện; kiện huỷ riêng; kiện mở là chỗ nhận lần quét", () => {
    expect(visibleTransferParcels(session).map((p) => p.packageNo)).toEqual([1, 3]);
    expect(voidedTransferParcels(session).map((p) => p.packageNo)).toEqual([2]);
    expect(openTransferParcels(session).map((p) => p.packageNo)).toEqual([3]);
  });

  it("số đơn vị trong kiện, kiện nguyên thùng (stockPackageId), kiện của bộ (kit)", () => {
    expect(transferParcelUnits(sealedParcel())).toBe(10);
    expect(transferParcelUnits(tParcel())).toBe(0);
    expect(isAsIsCarton(tParcel({ stockPackageId: "s" }))).toBe(true);
    expect(isAsIsCarton(tParcel())).toBe(false);
    expect(isKitPart(tParcel({ kit: { groupId: "g", partNo: 1, partCount: 2 } }))).toBe(true);
    expect(isKitPart(tParcel())).toBe(false);
  });

  it("dòng nên đóng bộ: kitSuggested và còn cần đóng", () => {
    const lines = [tLine(), kitLine(), kitLine({ transferLineId: "k2", remaining: 0, packed: 2 })];
    expect(kitCandidateLines({ lines }).map((l) => l.transferLineId)).toEqual([
      lines[1]?.transferLineId,
    ]);
  });
});

describe("planTransferScan — mã quét rơi vào dòng nào (cùng thứ tự với BE)", () => {
  it("mã SKU hoặc mã vạch (không phân biệt hoa thường, bỏ khoảng trắng) khớp đúng một dòng → dòng đó", () => {
    const lines = [tLine(), kitLine()];
    expect(planTransferScan(lines, " tee-blk-m ")).toMatchObject({
      kind: "line",
      line: { sku: "TEE-BLK-M" },
    });
    expect(planTransferScan(lines, "8930000000028")).toMatchObject({
      kind: "line",
      line: { sku: "DESK-OAK" },
    });
  });

  it("không dòng nào khớp → unknown (vẫn gửi cho BE quyết)", () => {
    expect(planTransferScan([tLine()], "NOPE")).toEqual({ kind: "unknown" });
  });

  it("hai dòng cùng SKU khác lô: chọn dòng DUY NHẤT còn cần đóng; còn cả hai → phải chọn dòng", () => {
    const a = lotALine();
    const b = lotBLine();
    expect(planTransferScan([a, b], "MUG-WHT")).toEqual({ kind: "ambiguous", candidates: [a, b] });
    const aFull = { ...a, packed: 4, remaining: 0 };
    expect(planTransferScan([aFull, b], "MUG-WHT")).toEqual({ kind: "line", line: b });
    const bothFull = { ...b, packed: 4, remaining: 0 };
    expect(planTransferScan([aFull, bothFull], "MUG-WHT")).toMatchObject({ kind: "ambiguous" });
  });
});

describe("transferCompletionReadiness — điều kiện hoàn tất (BE TransferPackService#complete)", () => {
  it("đóng đủ + mọi kiện niêm phong → hoàn tất đủ được, không cần ghi chú", () => {
    const r = transferCompletionReadiness(
      tSession({ lines: [tLine({ packed: 10, remaining: 0 })], packages: [sealedParcel()] }),
    );
    expect(r).toMatchObject({ canFull: true, canPartial: false, missing: [] });
    expect(r.sealed).toHaveLength(1);
  });

  it("thiếu so với yêu cầu → chỉ chuyển được phần đã đóng (partial)", () => {
    const r = transferCompletionReadiness(
      tSession({ lines: [tLine({ packed: 6, remaining: 4 })], packages: [sealedParcel()] }),
    );
    expect(r).toMatchObject({ canFull: false, canPartial: true });
    expect(r.missing.map((l) => l.remaining)).toEqual([4]);
  });

  it("còn kiện mở có hàng → không hoàn tất được dù đủ số lượng; kiện mở rỗng thì không chặn", () => {
    const withGoods = tParcel({ contents: [{ transferLineId: "x", sku: "A", quantity: 1 }] });
    const lines = [tLine({ packed: 10, remaining: 0 })];
    expect(
      transferCompletionReadiness(tSession({ lines, packages: [sealedParcel(), withGoods] })),
    ).toMatchObject({
      canFull: false,
      canPartial: false,
    });
    expect(
      transferCompletionReadiness(
        tSession({ lines, packages: [sealedParcel(), tParcel({ packageNo: 2 })] }),
      ),
    ).toMatchObject({
      canFull: true,
    });
  });

  it("chưa có kiện niêm phong nào → không hoàn tất được; kiện đã huỷ không tính", () => {
    expect(transferCompletionReadiness(tSession({ packages: [] }))).toMatchObject({
      canFull: false,
      canPartial: false,
    });
    const voided = { ...sealedParcel(), status: "VOIDED" as const };
    expect(transferCompletionReadiness(tSession({ packages: [voided] })).sealed).toHaveLength(0);
  });
});

describe("lý do của kiện nguyên thùng (BE ghi sẵn tiếng Anh)", () => {
  const BE_REASON = "Unopened stock carton shipped as it is (LP2-8)";

  it("nhận ra lý do tự động của kiện nguyên thùng (không phân biệt hoa thường, kèm hậu tố)", () => {
    expect(isCartonAsIsReason(BE_REASON)).toBe(true);
    expect(isCartonAsIsReason("unopened stock carton shipped as it is")).toBe(true);
    expect(isCartonAsIsReason("Khách lấy rời")).toBe(false);
  });

  it("hiện tiếng Việt cho lý do của BE; lý do người đóng gõ giữ nguyên", () => {
    expect(parcelReasonText(BE_REASON, "Thùng nguyên chưa mở, gửi nguyên trạng")).toBe(
      "Thùng nguyên chưa mở, gửi nguyên trạng",
    );
    expect(parcelReasonText("Khách lấy rời", "x")).toBe("Khách lấy rời");
  });
});
