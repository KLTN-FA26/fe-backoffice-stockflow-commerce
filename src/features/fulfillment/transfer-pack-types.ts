import type { z } from "zod";

import type {
  beTransferCartonSchema,
  beTransferKitSchema,
  beTransferMeasuresSchema,
  beTransferPackContentSchema,
  beTransferPackKitSchema,
  beTransferPackLineSchema,
  beTransferPackSessionSchema,
  beTransferParcelSchema,
} from "./transfer-pack-schemas";
import type { PackageType, SessionPackStatus } from "./packing-types";
import type { PackingSealValues } from "./packing-input-schemas";

/* ── DTO trên wire ───────────────────────────────────────────────────── */

export type TransferPackSessionDto = z.infer<typeof beTransferPackSessionSchema>;
export type TransferPackLine = z.infer<typeof beTransferPackLineSchema>;
export type TransferParcel = z.infer<typeof beTransferParcelSchema>;
export type TransferPackContent = z.infer<typeof beTransferPackContentSchema>;
export type TransferPackKitPart = z.infer<typeof beTransferPackKitSchema>;
export type TransferKit = z.infer<typeof beTransferKitSchema>;
export type TransferCarton = z.infer<typeof beTransferCartonSchema>;
export type TransferMeasures = z.infer<typeof beTransferMeasuresSchema>;

/** Model FE: `packStatus` đổi sang tên hiển thị như phiên đóng gói đơn (giá trị lạ → "Unknown"). */
export type TransferPackSession = Omit<TransferPackSessionDto, "packStatus"> & {
  packStatus: SessionPackStatus;
};

/* ── Input của các thao tác ──────────────────────────────────────────── */

export interface TransferPackRef {
  packId: string;
}

export interface TransferPackageRef extends TransferPackRef {
  packageId: string;
}

export interface OpenTransferPackageInput extends TransferPackRef {
  packageType?: PackageType;
}

export interface OpenTransferKitInput extends TransferPackRef {
  transferLineId: string;
  /** Để trống = BE lấy theo số thùng của hàng trong danh mục. */
  partCount?: number;
  packageType?: PackageType;
}

/** Một lần quét vào kiện; `scanId` MỚI cho mỗi lần quét, gửi lại cùng id thì BE không đổi gì. */
export interface TransferScan {
  scanId: string;
  scannedCode: string;
  quantity: number;
  lotNumber?: string;
  /** Chỉ khi mã nằm trên hai dòng của lệnh (cùng SKU khác lô). */
  transferLineId?: string;
  kitOverrideReason?: string;
}

export interface ScanTransferPackageInput extends TransferPackageRef {
  scan: TransferScan;
}

export interface SealTransferPackageInput extends TransferPackageRef {
  values: Omit<PackingSealValues, "rotatable" | "fragile"> & {
    rotatable?: boolean;
    fragile?: boolean;
    /** KIT-FORCE: lý do đóng hàng đi nhiều thùng vào kiện thường. */
    kitOverrideReason?: string;
  };
}

export interface ShipCartonInput extends TransferPackRef {
  lpn: string;
  packageType?: PackageType;
}

export interface CompleteTransferPackInput extends TransferPackRef {
  partial: boolean;
  note?: string;
}
