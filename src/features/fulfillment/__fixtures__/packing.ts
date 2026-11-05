/**
 * Fixture đúng hình dạng response BE PR #136 (`PackingController`). Field chưa có giá trị được BỎ khỏi
 * object (Jackson non_null) chứ không gán null.
 */

import { DESIGN_LINE_ID, ORDER_ID, PICKER_ID, PLAIN_LINE_ID, SNAPSHOT_ID, TASK_ID } from "./task";

import type {
  PackLine,
  PackPackage,
  PackShipment,
  PackageLabel,
  PackingQueueRowDto,
  PackingSessionDto,
} from "../packing-types";

export const PACKER_ID = PICKER_ID;
export const OTHER_PACKER_ID = "6b0d9e8f-2c3a-4b4c-8d5e-7f6a5b4c3d2e";
export const PACKAGE_ID = "aaaaaaaa-0001-4bbb-8ccc-000000000001";
export const SECOND_PACKAGE_ID = "aaaaaaaa-0002-4bbb-8ccc-000000000002";
export const SHIPMENT_ID = "bbbbbbbb-0001-4ccc-8ddd-000000000001";
export const LOT_LINE_ID = "33333333-aaaa-4bbb-8ccc-000000000003";
export const SERIAL_LINE_ID = "44444444-aaaa-4bbb-8ccc-000000000004";

export const PACKING_PATH = `/fulfillment/tasks/${TASK_ID}`;

/** Dòng hàng thường không theo dõi gì: cần 3, đã về bàn đủ. */
export function packLine(overrides: Partial<PackLine> = {}): PackLine {
  return {
    orderLineId: PLAIN_LINE_ID,
    sku: "TEE-BLK-M",
    barcode: "8930000000011",
    printLine: false,
    wanted: 3,
    available: 3,
    packed: 0,
    shipped: 0,
    remaining: 3,
    lotTracked: false,
    serialTracked: false,
    lots: [],
    ...overrides,
  };
}

export const printLine = (overrides: Partial<PackLine> = {}) =>
  packLine({
    orderLineId: DESIGN_LINE_ID,
    sku: "TEE-CUSTOM-L",
    barcode: "8930000000028",
    printLine: true,
    designSnapshotId: SNAPSHOT_ID,
    wanted: 2,
    available: 2,
    remaining: 2,
    ...overrides,
  });

export const lotLine = (overrides: Partial<PackLine> = {}) =>
  packLine({
    orderLineId: LOT_LINE_ID,
    sku: "MUG-WHT",
    barcode: "8930000000035",
    wanted: 4,
    available: 4,
    remaining: 4,
    lotTracked: true,
    lots: [
      { lotNumber: "LOT-A", available: 2, packed: 0 },
      { lotNumber: "LOT-B", available: 2, packed: 0 },
    ],
    ...overrides,
  });

export const serialLine = (overrides: Partial<PackLine> = {}) =>
  packLine({
    orderLineId: SERIAL_LINE_ID,
    sku: "HOODIE-BLK-L",
    barcode: "8930000000042",
    wanted: 1,
    available: 1,
    remaining: 1,
    serialTracked: true,
    ...overrides,
  });

export function packPackage(overrides: Partial<PackPackage> = {}): PackPackage {
  return {
    packageId: PACKAGE_ID,
    packageNo: 1,
    labelCode: "PKG-SO-20261010-000431-1",
    packageType: "CARTON",
    status: "OPEN",
    rotatable: true,
    rotatableOverridden: false,
    fragile: false,
    fragileOverridden: false,
    contents: [],
    ...overrides,
  };
}

/** Kiện đã niêm phong chứa 3 áo thường. */
export const sealedPackage = (overrides: Partial<PackPackage> = {}) =>
  packPackage({
    status: "SEALED",
    weightKg: 1.25,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 10,
    dimWeightKg: 1,
    sealedAt: "2026-10-10T03:30:00Z",
    contents: [{ orderLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 3 }],
    ...overrides,
  });

export function packShipment(overrides: Partial<PackShipment> = {}): PackShipment {
  return {
    shipmentId: SHIPMENT_ID,
    code: "SO-20261010-000431-S1",
    status: "READY_TO_DISPATCH",
    deliveryMode: "PARCEL",
    packageCount: 1,
    codAmount: 0,
    currency: "VND",
    partial: false,
    readyAt: "2026-10-10T03:40:00Z",
    ...overrides,
  };
}

/** Phiên đang đóng (PACKING) bởi `PACKER_ID`, chưa có kiện. */
export function apiSession(overrides: Partial<PackingSessionDto> = {}): PackingSessionDto {
  return {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    orderNumber: "SO-20261010-000431",
    warehouseId: "wh-1",
    packStatus: "PACKING",
    packerId: PACKER_ID,
    packerName: "Hoàng Anh Tuấn",
    startedAt: "2026-10-10T03:00:00Z",
    lines: [packLine()],
    packages: [],
    shipments: [],
    ...overrides,
  };
}

export const pendingSession = (overrides: Partial<PackingSessionDto> = {}) => {
  const {
    packerId: _packerId,
    packerName: _packerName,
    startedAt: _startedAt,
    ...rest
  } = apiSession();
  return { ...rest, packStatus: "PENDING" as const, ...overrides };
};

export function queueRow(overrides: Partial<PackingQueueRowDto> = {}): PackingQueueRowDto {
  return {
    taskId: TASK_ID,
    orderId: ORDER_ID,
    orderNumber: "SO-20261010-000431",
    warehouseId: "wh-1",
    packStatus: "PENDING",
    pickedAt: "2026-10-10T02:00:00Z",
    pickerName: "Hoàng Anh Tuấn",
    packageCount: 0,
    sealedPackageCount: 0,
    shipmentCount: 0,
    ...overrides,
  };
}

export function apiLabel(overrides: Partial<PackageLabel> = {}): PackageLabel {
  return {
    labelCode: "PKG-SO-20261010-000431-1",
    packageId: PACKAGE_ID,
    orderNumber: "SO-20261010-000431",
    packageNo: 1,
    packageCount: 2,
    provisional: true,
    codAmount: 450000,
    currency: "VND",
    recipient: {
      name: "Vũ Đức Long",
      phone: "+84 966 777 888",
      line1: "15 Quang Trung",
      wardName: "Phường Quang Trung",
      provinceName: "Hà Nội",
      countryCode: "VN",
      postalCode: "121000",
    },
    returnWarehouseName: "Kho Hà Nội — Trung tâm",
    returnAddress: "Lô CN2, KCN Bắc Thăng Long, Đông Anh, Hà Nội",
    packageType: "CARTON",
    weightKg: 1.25,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 10,
    dimWeightKg: 1,
    fragile: true,
    rotatable: false,
    contents: [{ orderLineId: PLAIN_LINE_ID, sku: "TEE-BLK-M", quantity: 3 }],
    ...overrides,
  };
}
