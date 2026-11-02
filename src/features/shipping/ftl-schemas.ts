/**
 * Shipping — phần DTO chuyến nguyên xe (FTL) BE PR #162 (SCRUM-392) thêm vào `LoadRowResponse`,
 * `LoadResponse`, `ManifestResponse` và các kiện. Mọi trường khai `.nullish()`: BE bỏ null khỏi JSON và
 * chuyến gửi kiện (PARCEL) không có kế hoạch / xe / đặt xe.
 */

import { z } from "zod";

import { deliveryModeSchema, isoInstant } from "./schemas";

/** BE `KitPartResponse` — kiện là phần `partNo/partCount` của một bộ (SCRUM-287 LP2-6). */
export const kitPartSchema = z.object({
  groupId: z.string(),
  partNo: z.number().int().min(1),
  partCount: z.number().int().min(1),
  orderLineId: z.string().nullish(),
});

/** BE `LoadResponse.PendingUnload` — kiện của đơn đã huỷ còn nằm trên xe, phải quét dỡ xuống trước bàn giao. */
export const pendingUnloadSchema = z.object({
  packageId: z.string(),
  /** `PKG-<số đơn>-<n>` — mã quét. */
  labelCode: z.string(),
  shipmentId: z.string(),
  shipmentCode: z.string(),
  reason: z.string().nullish(),
  requestedAt: isoInstant.nullish(),
});

/**
 * Kiện: bộ (n/N) và cờ nhãn đã cũ (BE PR #165: `labelOutdated` luôn có mặt — kiện chuyển lô hoặc đổi n/N sau khi
 * in nhãn; `labelOutdatedAt` bị bỏ khi null). Thiếu cờ (BE cũ) = nhãn còn đúng.
 */
export const parcelFtlFields = {
  kit: kitPartSchema.nullish(),
  labelOutdated: z.boolean().default(false),
  labelOutdatedAt: isoInstant.nullish(),
};

/** `LoadRowResponse`: kế hoạch của xe và số thứ tự xe. */
export const ftlRowFields = {
  loadPlanId: z.string().nullish(),
  loadPlanCode: z.string().nullish(),
  vehicleSeq: z.number().int().nullish(),
};

/** `LoadResponse`: thêm đặt xe, kiện cần dỡ và cờ "huỷ xe đã đặt ở ngoài". */
export const ftlLoadFields = {
  ...ftlRowFields,
  vehicleTypeCode: z.string().nullish(),
  bookedAt: isoInstant.nullish(),
  bookedBy: z.string().nullish(),
  bookingCancelledAt: isoInstant.nullish(),
  bookingCancelReason: z.string().nullish(),
  pendingUnloads: z.array(pendingUnloadSchema).nullish(),
  /** Chuyến CANCELLED sau khi đã đặt xe: đặt xe ngoài hệ thống vẫn còn → điều phối phải huỷ. */
  carrierBookingToCancel: z.boolean().nullish(),
};

/** `ManifestResponse`: biên bản theo xe (chỉ kiện của xe, COD 0). */
export const ftlManifestFields = {
  mode: deliveryModeSchema.optional(),
  loadPlanCode: z.string().nullish(),
  vehicleSeq: z.number().int().nullish(),
  vehicleTypeCode: z.string().nullish(),
};
