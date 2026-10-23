/**
 * Store + view của mock đóng gói chuyển kho (BE `TransferPackController`, BE PR #164), chỉ dùng khi USE_MOCK=true.
 * Lệnh seed `TO-2026-0006` đã có phiên `PACKED` với hai kiện niêm phong (xem `mock-transfer-pack-seed.ts`); các lệnh
 * khác tạo phiên khi người dùng mở.
 */

import { packedOf } from "./mock-transfer-pack-session";
import {
  MOCK_BOXES_PER_UNIT,
  SEED_PACKED_TRANSFER_ID,
  SEED_PACKED_TRANSFER_LINE_ID,
  SEED_PACKED_TRANSFER_PACKED_AT,
  SEED_PACKED_TRANSFER_PACK_ID,
  SEED_PACKED_TRANSFER_PARCELS,
  mockBarcodeOf,
} from "./mock-transfer-pack-seed";
import { MOCK_SUBMITTER } from "./mock-routes-purchase-orders-store";

import type { MockTransfer } from "./mock-routes-transfer-orders-store";
import type { MockTransferPack, MockTransferParcel } from "./mock-transfer-pack-session";

let packs: Map<string, MockTransferPack> | null = null;

function seedPacked(): MockTransferPack {
  const parcels = SEED_PACKED_TRANSFER_PARCELS.map((p): MockTransferParcel => ({
    packageId: `${SEED_PACKED_TRANSFER_PACK_ID}-p${p.n}`,
    packageNo: p.n,
    labelCode: `PKG-${SEED_PACKED_TRANSFER_ID}-${p.n}`,
    packageType: "CARTON",
    status: "SEALED",
    weightKg: p.kg,
    lengthCm: p.lengthCm,
    widthCm: p.widthCm,
    heightCm: p.heightCm,
    dimWeightKg: Math.round(((p.lengthCm * p.widthCm * p.heightCm) / 5000) * 1000) / 1000,
    rotatable: true,
    fragile: false,
    sealedAt: SEED_PACKED_TRANSFER_PACKED_AT,
    contents: [{ transferLineId: SEED_PACKED_TRANSFER_LINE_ID, quantity: p.units }],
  }));
  return {
    packId: SEED_PACKED_TRANSFER_PACK_ID,
    transferOrderId: SEED_PACKED_TRANSFER_ID,
    // Cùng người seed ở mọi phiên khác của mock: phiên đã xong nên không ai cần là chủ
    packerId: MOCK_SUBMITTER,
    packerName: "Nhân viên kho (mock)",
    packStatus: "PACKED",
    startedAt: "2026-10-22T03:00:00Z",
    packedAt: SEED_PACKED_TRANSFER_PACKED_AT,
    parcels,
    scans: new Map(),
    serial: parcels.length,
  };
}

export function getTransferPacks(): Map<string, MockTransferPack> {
  packs ??= new Map([[SEED_PACKED_TRANSFER_PACK_ID, seedPacked()]]);
  return packs;
}

export function resetTransferPackMockStore(): void {
  packs = null;
}

/** Phiên còn sống (đang đóng hoặc đã đóng xong) của lệnh — phiên đã huỷ không tính. */
export function livePackOf(transferId: string): MockTransferPack | undefined {
  return [...getTransferPacks().values()]
    .filter((pack) => pack.transferOrderId === transferId && pack.packStatus !== "CANCELLED")
    .at(-1);
}

export function parcelView(parcel: MockTransferParcel, transfer: MockTransfer) {
  const skuOf = (lineId: string) => transfer.lines.find((l) => l.lineId === lineId)?.sku ?? "";
  return {
    packageId: parcel.packageId,
    packageNo: parcel.packageNo,
    labelCode: parcel.labelCode,
    packageType: parcel.packageType,
    status: parcel.status,
    weightKg: parcel.weightKg,
    lengthCm: parcel.lengthCm,
    widthCm: parcel.widthCm,
    heightCm: parcel.heightCm,
    dimWeightKg: parcel.dimWeightKg,
    rotatable: parcel.rotatable,
    fragile: parcel.fragile,
    sealedAt: parcel.sealedAt,
    contents: parcel.contents.map((c) => ({ ...c, sku: skuOf(c.transferLineId) })),
    kit: parcel.kit,
    kitOverrideReason: parcel.kitOverrideReason,
    stockPackageId: parcel.stockPackageId,
    labelOutdated: parcel.labelOutdated === true,
    labelOutdatedAt: parcel.labelOutdated ? "2026-10-22T05:00:00Z" : undefined,
  };
}

export function sessionView(pack: MockTransferPack, transfer: MockTransfer) {
  return {
    packId: pack.packId,
    transferOrderId: transfer.transferId,
    transferNumber: transfer.number,
    fromWarehouseId: transfer.fromWarehouseId,
    toWarehouseId: transfer.toWarehouseId,
    transferStatus: transfer.status,
    deliveryMode: transfer.deliveryMode,
    packStatus: pack.packStatus,
    packerId: pack.packerId,
    packerName: pack.packerName,
    startedAt: pack.startedAt,
    packedAt: pack.packedAt,
    lines: transfer.lines.map((line) => {
      const packed = packedOf(pack, line.lineId);
      const boxes = MOCK_BOXES_PER_UNIT[line.sku] ?? 1;
      return {
        transferLineId: line.lineId,
        lineNo: line.lineNo,
        sku: line.sku,
        barcode: mockBarcodeOf(line.sku),
        lotNumber: line.lotNumber,
        requested: line.requested,
        packed,
        remaining: line.requested - packed,
        packageCount: boxes,
        kitSuggested: boxes > 1,
      };
    }),
    packages: pack.parcels.map((parcel) => parcelView(parcel, transfer)),
  };
}
