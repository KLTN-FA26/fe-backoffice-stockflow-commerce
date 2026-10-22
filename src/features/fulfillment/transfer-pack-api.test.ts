import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import {
  KIT_LINE_ID,
  PACK_ID,
  PARCEL_1_ID,
  TRANSFER_ORDER_ID,
  cartonResponse,
  kitResponse,
  sealedParcel,
  tParcel,
  tSession,
} from "./__fixtures__/transfer-pack";
import {
  completeTransferPack,
  getTransferPack,
  openTransferKit,
  openTransferPack,
  openTransferPackage,
  scanIntoTransferPackage,
  sealTransferPackage,
  shipTransferCarton,
  voidTransferPackage,
} from "./transfer-pack-api";

afterEach(() => vi.restoreAllMocks());

const PACK = `/fulfillment/transfer-packs/${PACK_ID}`;
const PKG = `${PACK}/packages/${PARCEL_1_ID}`;
const SCAN_ID = "5ca17e5c-0000-4000-8000-000000000001";

describe("transfer-pack API — hợp đồng BE TransferPackController (BE PR #164)", () => {
  it("mở phiên: POST /fulfillment/transfer-packs {transferOrderId}; packStatus đổi sang tên hiển thị", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: tSession() });
    const session = await openTransferPack(TRANSFER_ORDER_ID);
    expect(post).toHaveBeenCalledWith("/fulfillment/transfer-packs", {
      transferOrderId: TRANSFER_ORDER_ID,
    });
    expect(session.packStatus).toBe("Packing");
  });

  it("đọc phiên: GET …/{packId}; phiên đã đóng xong → Packed; giá trị lạ → Unknown", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({ data: tSession({ packStatus: "PACKED" }) })
      .mockResolvedValueOnce({ data: { ...tSession(), packStatus: "WEIRD" } });
    expect((await getTransferPack(PACK_ID)).packStatus).toBe("Packed");
    expect(get.mock.calls[0]?.[0]).toBe(PACK);
    expect((await getTransferPack(PACK_ID)).packStatus).toBe("Unknown");
  });

  it("mở kiện: POST …/packages {packageType}; không loại thì body rỗng", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: tParcel() });
    await openTransferPackage({ packId: PACK_ID, packageType: "PALLET" });
    await openTransferPackage({ packId: PACK_ID });
    expect(post.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [`${PACK}/packages`, { packageType: "PALLET" }],
      [`${PACK}/packages`, {}],
    ]);
  });

  it("đóng bộ: POST …/package-kits {transferLineId, partCount?, packageType?}; partCount trống/0 bị bỏ", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: kitResponse() });
    const kit = await openTransferKit({
      packId: PACK_ID,
      transferLineId: KIT_LINE_ID,
      partCount: 0,
    });
    await openTransferKit({
      packId: PACK_ID,
      transferLineId: KIT_LINE_ID,
      partCount: 2,
      packageType: "CRATE",
    });
    expect(kit.packages).toHaveLength(2);
    expect(post.mock.calls.map((c) => c[1])).toEqual([
      { transferLineId: KIT_LINE_ID, partCount: undefined, packageType: undefined },
      { transferLineId: KIT_LINE_ID, partCount: 2, packageType: "CRATE" },
    ]);
  });

  it("quét: POST …/packages/{id}/scans với scanId, mã, số lượng, lô, dòng; trả phiên", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: tSession() });
    const scan = {
      scanId: SCAN_ID,
      scannedCode: "TEE-BLK-M",
      quantity: 2,
      lotNumber: "LOT-A",
      transferLineId: KIT_LINE_ID,
    };
    const session = await scanIntoTransferPackage({
      packId: PACK_ID,
      packageId: PARCEL_1_ID,
      scan,
    });
    expect(post).toHaveBeenCalledWith(`${PKG}/scans`, scan);
    expect(session.packId).toBe(PACK_ID);
  });

  it("niêm phong: POST …/seal với số đo thực (và kitOverrideReason); trả kiện", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: sealedParcel() });
    const values = {
      weightKg: 4.5,
      lengthCm: 40,
      widthCm: 30,
      heightCm: 20,
      packageType: "CARTON" as const,
      rotatable: undefined,
      fragile: undefined,
      kitOverrideReason: "x",
    };
    const parcel = await sealTransferPackage({ packId: PACK_ID, packageId: PARCEL_1_ID, values });
    expect(post).toHaveBeenCalledWith(`${PKG}/seal`, values);
    expect(parcel.status).toBe("SEALED");
  });

  it("huỷ kiện: DELETE …/packages/{id} trả phiên", async () => {
    const del = vi.spyOn(api, "delete").mockResolvedValueOnce({ data: tSession() });
    expect((await voidTransferPackage({ packId: PACK_ID, packageId: PARCEL_1_ID })).packId).toBe(
      PACK_ID,
    );
    expect(del.mock.calls[0]?.[0]).toBe(PKG);
  });

  it("nguyên thùng: POST …/cartons {lpn (đã trim), packageType}; trả kiện + số đo gợi ý", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValueOnce({ data: cartonResponse() });
    const carton = await shipTransferCarton({
      packId: PACK_ID,
      lpn: "  LPN-0001 ",
      packageType: "BAG",
    });
    expect(post).toHaveBeenCalledWith(`${PACK}/cartons`, { lpn: "LPN-0001", packageType: "BAG" });
    expect(carton.suggested?.weightKg).toBe(6.2);
    expect(carton.parcel.stockPackageId).toBeDefined();
  });

  it("hoàn tất: POST …/completion {partial, note}; note chỉ gửi khi partial, đã trim", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: tSession({ packStatus: "PACKED" }) });
    await completeTransferPack({ packId: PACK_ID, partial: false, note: "bỏ qua" });
    await completeTransferPack({ packId: PACK_ID, partial: true, note: "  Hỏng 4 cái " });
    expect(post.mock.calls.map((c) => c[1])).toEqual([
      { partial: false, note: undefined },
      { partial: true, note: "Hỏng 4 cái" },
    ]);
  });

  it("response sai hợp đồng (deliveryMode lạ) → ném lỗi parse, không đưa dữ liệu hỏng vào UI", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { ...tSession(), deliveryMode: "DRONE" } });
    await expect(openTransferPack(TRANSFER_ORDER_ID)).rejects.toThrow();
  });
});
