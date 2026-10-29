/**
 * Shipping — phần DTO chuyến nguyên xe (FTL) BE PR #162 (SCRUM-392) thêm vào `LoadRowResponse`,
 * `LoadResponse`, `ManifestResponse` và các kiện. Mọi trường khai `.nullish()`: BE bỏ null khỏi JSON và
 * chuyến gửi kiện (PARCEL) không có kế hoạch / xe / đặt xe.
 */

import { z } from "zod";

import { UNLOAD_REASON_CODES } from "@/constants";

import { deliveryModeSchema, isoInstant } from "./schemas";

/** BE `UnloadReasonCode` — XE_HONG, SAI_XE, KIEN_KHONG_VUA, KHAC (SCRUM-474 UNLOAD-DESIGN điểm 7); tập đóng. */
export const unloadReasonCodeSchema = z.enum(UNLOAD_REASON_CODES);

/** BE `KitPartResponse` — kiện là phần `partNo/partCount` của một bộ (SCRUM-287 LP2-6). */
export const kitPartSchema = z.object({
  groupId: z.string(),
  partNo: z.number().int().min(1),
  partCount: z.number().int().min(1),
  orderLineId: z.string().nullish(),
});

/**
 * BE `LoadResponse.PendingUnload` — kiện còn nằm trên xe, phải quét dỡ xuống: của đơn đã huỷ (SCRUM-392, chặn bàn
 * giao) hoặc của xe đã huỷ có kiểm soát (SCRUM-474, kiện bị khoá; có `reasonCode`). Trên xe của kế hoạch nguồn TRANSFER
 * `shipmentId` vắng, `transferOrderId` có và `shipmentCode` là số lệnh.
 */
export const pendingUnloadSchema = z.object({
  packageId: z.string(),
  /** `PKG-<số đơn>-<n>` — mã quét. */
  labelCode: z.string(),
  shipmentId: z.string().nullish(),
  transferOrderId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  reason: z.string().nullish(),
  requestedAt: isoInstant.nullish(),
  /** Chỉ có khi xe huỷ có kiểm soát; vắng = kiện của đơn đã huỷ. */
  reasonCode: unloadReasonCodeSchema.nullish(),
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
  /** Mã lý do huỷ có kiểm soát (SCRUM-474); `cancelReason` là ghi chú. Vắng với mọi cách huỷ khác. */
  cancelReasonCode: unloadReasonCodeSchema.nullish(),
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
