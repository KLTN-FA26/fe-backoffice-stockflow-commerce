/**
 * Đóng gói chuyển kho — zod DTO, khớp BE `TransferPackController` + `TransferPacks.*` (SCRUM-287 PR T, BE PR #164).
 *
 * BE bật Jackson `non_null` → field null bị BỎ khỏi JSON nên field tuỳ chọn khai `.nullish()`; kiểu nguyên thuỷ
 * Java (int, boolean) luôn có mặt. Enum khoan dung (`.catch("UNKNOWN")`): giá trị BE thêm sau không làm hỏng cả phiên.
 * Mã dòng là mã dòng của LỆNH CHUYỂN KHO (`transferLineId`), không phải dòng đơn hàng.
 */

import { z } from "zod";

import { DELIVERY_MODES, PACKAGE_API_STATUSES, PACKAGE_TYPES } from "@/constants";

import { packSessionStatusSchema } from "./packing-schemas";

const count = z.number().int().min(0);
const measure = z.number().nonnegative();

function tolerantEnum<const T extends readonly [string, ...string[]]>(values: T) {
  return z.enum([...values, "UNKNOWN"]).catch("UNKNOWN");
}

/** `TransferPacks.Line` — một dòng của lệnh tại bàn đóng gói. `packageCount` > 1: một đơn vị đi nhiều thùng (đóng bộ). */
export const beTransferPackLineSchema = z.object({
  transferLineId: z.string(),
  lineNo: z.number().int(),
  sku: z.string(),
  barcode: z.string().nullish(),
  /** Dòng nêu lô thì lần quét kèm đúng lô đó. */
  lotNumber: z.string().nullish(),
  requested: count,
  packed: count,
  remaining: z.number().int(),
  packageCount: z.number().int().min(1),
  kitSuggested: z.boolean(),
});

/** `TransferPacks.Content` — số đơn vị của một dòng lệnh nằm trong kiện. */
export const beTransferPackContentSchema = z.object({
  transferLineId: z.string(),
  sku: z.string(),
  lotNumber: z.string().nullish(),
  quantity: z.number().int().positive(),
});

/** `TransferPacks.KitView` — kiện là phần `partNo/partCount` của một bộ; phần 1 chứa một đơn vị của `transferLineId`. */
export const beTransferPackKitSchema = z.object({
  groupId: z.string(),
  partNo: z.number().int().min(1),
  partCount: z.number().int().min(1),
  transferLineId: z.string().nullish(),
});

/** `TransferPacks.Parcel` — một kiện: OPEN → SEALED (cân, đo) hoặc VOIDED; `stockPackageId` = thùng tồn kho giao nguyên. */
export const beTransferParcelSchema = z.object({
  packageId: z.string(),
  packageNo: z.number().int().positive(),
  /** `PKG-<số lệnh>-<n>` (đóng lại sau khi huỷ: `PKG-<số lệnh>-R<n>-<k>`). */
  labelCode: z.string(),
  packageType: tolerantEnum(PACKAGE_TYPES),
  status: tolerantEnum(PACKAGE_API_STATUSES),
  weightKg: measure.nullish(),
  lengthCm: measure.nullish(),
  widthCm: measure.nullish(),
  heightCm: measure.nullish(),
  dimWeightKg: measure.nullish(),
  rotatable: z.boolean(),
  fragile: z.boolean(),
  sealedAt: z.string().nullish(),
  contents: z.array(beTransferPackContentSchema),
  kit: beTransferPackKitSchema.nullish(),
  kitOverrideReason: z.string().nullish(),
  stockPackageId: z.string().nullish(),
  /** Nhãn không còn khớp kiện: in lại trước khi quét lên xe. */
  labelOutdated: z.boolean().default(false),
  labelOutdatedAt: z.string().nullish(),
});

/** `TransferPacks.Session` — câu trả lời của open / get / scan / void / completion. */
export const beTransferPackSessionSchema = z.object({
  packId: z.string(),
  transferOrderId: z.string(),
  transferNumber: z.string(),
  fromWarehouseId: z.string(),
  toWarehouseId: z.string(),
  /** PICKING khi đang đóng gói và xếp xe. */
  transferStatus: z.string(),
  deliveryMode: z.enum(DELIVERY_MODES),
  /** PACKING → PACKED (sẵn sàng lập kế hoạch xe); CANCELLED khi lệnh dừng lấy hàng. */
  packStatus: packSessionStatusSchema,
  packerId: z.string().nullish(),
  startedAt: z.string().nullish(),
  packedAt: z.string().nullish(),
  lines: z.array(beTransferPackLineSchema),
  packages: z.array(beTransferParcelSchema),
});

/** `POST …/package-kits` (201): các kiện của một bộ cho MỘT đơn vị của dòng lệnh. */
export const beTransferKitSchema = z.object({
  kitGroupId: z.string(),
  transferLineId: z.string(),
  sku: z.string(),
  partCount: z.number().int().min(2),
  packages: z.array(beTransferParcelSchema),
});

/** `TransferPacks.Measures` — kích thước (cm) và khối lượng (kg) gợi ý theo đơn vị đóng gói của thùng. */
export const beTransferMeasuresSchema = z.object({
  weightKg: measure.nullish(),
  lengthCm: measure.nullish(),
  widthCm: measure.nullish(),
  heightCm: measure.nullish(),
});

/** `POST …/cartons` (201): kiện nguyên thùng, kèm số đo gợi ý (vắng khi đơn vị không khai số đo) để người đóng xác nhận. */
export const beTransferCartonSchema = z.object({
  parcel: beTransferParcelSchema,
  lpn: z.string(),
  unitOfMeasure: z.string().nullish(),
  suggested: beTransferMeasuresSchema.nullish(),
});
