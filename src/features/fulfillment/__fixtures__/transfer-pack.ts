/**
 * Fixture đúng hình dạng response BE `TransferPackController` (SCRUM-287 PR T, BE PR #164). Field chưa có giá trị được
 * BỎ khỏi object (Jackson non_null) chứ không gán null.
 */

import { PICKER_ID } from "./task";

import type {
  TransferCarton,
  TransferKit,
  TransferPackLine,
  TransferPackSessionDto,
  TransferParcel,
} from "../transfer-pack-types";

export const TRANSFER_ORDER_ID = "9b1f7c1e-1111-4c1a-9a51-0000000000a1";
export const PACK_ID = "cccccccc-0001-4ddd-8eee-000000000001";
export const PACKER_ID = PICKER_ID;
export const OTHER_PACKER_ID = "6b0d9e8f-2c3a-4b4c-8d5e-7f6a5b4c3d2e";
export const FROM_WH = "d99123fd-2997-4751-6bb9-e10a2e6d9949";
export const TO_WH = "a1b2c3d4-0000-4000-8000-0000000000b2";
export const PLAIN_LINE_ID = "dddddddd-0001-4000-8000-000000000001";
export const KIT_LINE_ID = "dddddddd-0002-4000-8000-000000000002";
export const LOT_A_LINE_ID = "dddddddd-0003-4000-8000-000000000003";
export const LOT_B_LINE_ID = "dddddddd-0004-4000-8000-000000000004";
export const PARCEL_1_ID = "eeeeeeee-0001-4000-8000-000000000001";
export const PARCEL_2_ID = "eeeeeeee-0002-4000-8000-000000000002";

export const PACK_PATH = `/fulfillment/transfer-packs/${PACK_ID}`;
export const PACKS_PATH = "/fulfillment/transfer-packs";

/** Dòng thường: cần 10, chưa đóng. */
export function tLine(overrides: Partial<TransferPackLine> = {}): TransferPackLine {
  return {
    transferLineId: PLAIN_LINE_ID,
    lineNo: 1,
    sku: "TEE-BLK-M",
    barcode: "8930000000011",
    requested: 10,
    packed: 0,
    remaining: 10,
    packageCount: 1,
    kitSuggested: false,
    ...overrides,
  };
}

/** Dòng đi nhiều thùng (đóng bộ): cần 2, mỗi đơn vị 2 thùng. */
export const kitLine = (overrides: Partial<TransferPackLine> = {}) =>
  tLine({
    transferLineId: KIT_LINE_ID,
    lineNo: 2,
    sku: "DESK-OAK",
    barcode: "8930000000028",
    requested: 2,
    remaining: 2,
    packageCount: 2,
    kitSuggested: true,
    ...overrides,
  });

/** Hai dòng cùng SKU khác lô (quét phải chọn dòng). */
export const lotALine = () =>
  tLine({
    transferLineId: LOT_A_LINE_ID,
    lineNo: 3,
    sku: "MUG-WHT",
    barcode: "8930000000035",
    lotNumber: "LOT-A",
    requested: 4,
    remaining: 4,
  });

export const lotBLine = () =>
  tLine({
    transferLineId: LOT_B_LINE_ID,
    lineNo: 4,
    sku: "MUG-WHT",
    barcode: "8930000000035",
    lotNumber: "LOT-B",
    requested: 4,
    remaining: 4,
  });

export function tParcel(overrides: Partial<TransferParcel> = {}): TransferParcel {
  return {
    packageId: PARCEL_1_ID,
    packageNo: 1,
    labelCode: "PKG-TO-20261012-0001-1",
    packageType: "CARTON",
    status: "OPEN",
    rotatable: true,
    fragile: false,
    contents: [],
    labelOutdated: false,
    ...overrides,
  };
}

export const sealedParcel = (overrides: Partial<TransferParcel> = {}) =>
  tParcel({
    status: "SEALED",
    weightKg: 4.5,
    lengthCm: 40,
    widthCm: 30,
    heightCm: 20,
    dimWeightKg: 4.8,
    sealedAt: "2026-10-22T03:00:00Z",
    contents: [{ transferLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 10 }],
    ...overrides,
  });

export function tSession(overrides: Partial<TransferPackSessionDto> = {}): TransferPackSessionDto {
  return {
    packId: PACK_ID,
    transferOrderId: TRANSFER_ORDER_ID,
    transferNumber: "TO-20261012-0001",
    fromWarehouseId: FROM_WH,
    toWarehouseId: TO_WH,
    transferStatus: "PICKING",
    deliveryMode: "FULL_TRUCKLOAD",
    packStatus: "PACKING",
    packerId: PACKER_ID,
    startedAt: "2026-10-22T02:00:00Z",
    lines: [tLine()],
    packages: [],
    ...overrides,
  };
}

/** Phiên sau khi `quantity` đơn vị của `line` vào kiện `packageId` (đúng như BE trả lại phiên mới). */
export function withScanned(
  session: TransferPackSessionDto,
  line: TransferPackLine,
  packageId: string,
  quantity = 1,
): TransferPackSessionDto {
  return {
    ...session,
    lines: session.lines.map((l) =>
      l.transferLineId === line.transferLineId
        ? { ...l, packed: l.packed + quantity, remaining: l.remaining - quantity }
        : l,
    ),
    packages: session.packages.map((pkg) =>
      pkg.packageId === packageId
        ? {
            ...pkg,
            contents: [
              ...pkg.contents,
              {
                transferLineId: line.transferLineId,
                sku: line.sku,
                lotNumber: line.lotNumber,
                quantity,
              },
            ],
          }
        : pkg,
    ),
  };
}

export function kitResponse(): TransferKit {
  return {
    kitGroupId: "ffffffff-0001-4000-8000-000000000001",
    transferLineId: KIT_LINE_ID,
    sku: "DESK-OAK",
    partCount: 2,
    packages: [
      tParcel({
        packageId: PARCEL_1_ID,
        kit: {
          groupId: "ffffffff-0001-4000-8000-000000000001",
          partNo: 1,
          partCount: 2,
          transferLineId: KIT_LINE_ID,
        },
      }),
      tParcel({
        packageId: PARCEL_2_ID,
        packageNo: 2,
        labelCode: "PKG-TO-20261012-0001-2",
        kit: { groupId: "ffffffff-0001-4000-8000-000000000001", partNo: 2, partCount: 2 },
      }),
    ],
  };
}

export function cartonResponse(withSuggestion = true): TransferCarton {
  return {
    parcel: tParcel({
      stockPackageId: "99999999-0001-4000-8000-000000000001",
      contents: [{ transferLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 10 }],
    }),
    lpn: "LPN-0001",
    unitOfMeasure: "CARTON",
    suggested: withSuggestion
      ? { weightKg: 6.2, lengthCm: 40, widthCm: 30, heightCm: 25 }
      : undefined,
  };
}

/** Nhãn kiện của lệnh chuyển kho (BE `TransferPacks.Label`): n/N trong các kiện đã niêm phong, kho đi / đến, không COD. */
export function transferLabel(
  overrides: Partial<import("../transfer-pack-types").TransferLabel> = {},
): import("../transfer-pack-types").TransferLabel {
  return {
    labelCode: "PKG-TO-20261012-0001-1",
    packageId: PARCEL_1_ID,
    transferOrderId: TRANSFER_ORDER_ID,
    transferNumber: "TO-20261012-0001",
    packageNo: 1,
    packageCount: 2,
    fromWarehouseName: "Kho Hà Nội",
    fromWarehouseAddress: "Lô CN2, Đông Anh, Hà Nội",
    toWarehouseName: "Kho HCM",
    toWarehouseAddress: "12 Nguyễn Văn Linh, TP.HCM",
    packageType: "CARTON",
    weightKg: 4.5,
    lengthCm: 40,
    widthCm: 30,
    heightCm: 20,
    dimWeightKg: 4.8,
    fragile: true,
    rotatable: true,
    contents: [{ transferLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 10 }],
    ...overrides,
  };
}
