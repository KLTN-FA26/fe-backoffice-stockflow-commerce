import type { z } from "zod";

import type { PACKAGE_API_STATUSES, PACKAGE_TYPES, PackStatus } from "@/constants";
import type {
  bePackContentSchema,
  bePackLabelRecipientSchema,
  bePackLineSchema,
  bePackLotSchema,
  bePackShipmentSchema,
  bePackageLabelSchema,
  bePackageSchema,
  bePackingQueueRowSchema,
  bePackingSessionSchema,
} from "./packing-schemas";
import type { PackingSealValues } from "./packing-input-schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type PackingQueueRowDto = z.infer<typeof bePackingQueueRowSchema>;
export type PackingSessionDto = z.infer<typeof bePackingSessionSchema>;
export type PackLot = z.infer<typeof bePackLotSchema>;
export type PackLine = z.infer<typeof bePackLineSchema>;
export type PackContent = z.infer<typeof bePackContentSchema>;
export type PackPackage = z.infer<typeof bePackageSchema>;
export type PackShipment = z.infer<typeof bePackShipmentSchema>;
export type PackageLabel = z.infer<typeof bePackageLabelSchema>;
export type PackLabelRecipient = z.infer<typeof bePackLabelRecipientSchema>;

export type PackageApiStatus = (typeof PACKAGE_API_STATUSES)[number] | "UNKNOWN";
export type PackageType = (typeof PACKAGE_TYPES)[number];

/* ── Model FE: `packStatus` đổi 1-1 sang tên hiển thị (như `FulfillmentTask`), giá trị lạ → "Unknown" ── */

export type SessionPackStatus = PackStatus | "Unknown";

export type PackingSession = Omit<PackingSessionDto, "packStatus"> & {
  packStatus: SessionPackStatus;
};

export type PackingQueueRow = Omit<PackingQueueRowDto, "packStatus"> & {
  packStatus: SessionPackStatus;
};

/* ── Input của các thao tác ──────────────────────────────────────────── */

export interface PackingQueueParams {
  /** Trang đánh số từ 0 (BE PageResponse). */
  page?: number;
  size?: number;
  warehouseId?: string;
  /** `PackStatus` BE; bỏ trống = mọi đơn đang chờ (PENDING, PACKING, ON_HOLD). */
  status?: string;
  [key: string]: unknown;
}

/** Một lần quét vào kiện. `scanId` do máy quét sinh, MỚI cho mỗi lần quét; gửi lại cùng id thì BE không đổi gì. */
export interface PackScan {
  scanId: string;
  scannedCode: string;
  quantity: number;
  lotNumber?: string;
  serialNumber?: string;
  /** Chỉ khi mã nằm trên hai dòng của đơn (cốc trơn và cốc in cùng một SKU). */
  orderLineId?: string;
}

export interface PackageRef {
  taskId: string;
  packageId: string;
}

export interface OpenPackageInput {
  taskId: string;
  packageType?: PackageType;
  /** `Idempotency-Key`: gửi lại sau lỗi mạng không mở thêm một kiện. */
  idempotencyKey: string;
}

export interface ScanPackageInput extends PackageRef {
  scan: PackScan;
}

export interface RemoveUnitsInput extends PackageRef {
  orderLineId: string;
  quantity: number;
  lotNumber?: string;
  serialNumber?: string;
  /** Gửi lại cùng id sau lỗi mạng thì BE không bớt hai lần. */
  scanId: string;
}

export interface SealPackageInput extends PackageRef {
  values: PackingSealValues;
}

export interface CompletePackingInput {
  taskId: string;
  /** Id lần hoàn tất — gửi lại cùng id thì BE trả lại lô đã tạo. */
  requestId: string;
  partial: boolean;
  note?: string;
}
