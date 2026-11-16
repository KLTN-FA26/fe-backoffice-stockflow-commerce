/**
 * Shipping — phần DTO của chuyến xe (một xe của kế hoạch xếp xe) dùng chung cho `LoadRowResponse`, `LoadResponse`
 * và `ManifestResponse`. Mọi trường khai `.nullish()`: BE bỏ null khỏi JSON.
 */

import { z } from "zod";

import {
  CARRIER_BOOKING_STATUSES,
  CARRIER_CONNECTION_TYPES,
  UNLOAD_REASON_CODES,
} from "@/constants";

import { isoInstant, tolerantEnum } from "./schemas";

/** BE `UnloadReasonCode` — XE_HONG, SAI_XE, KIEN_KHONG_VUA, KHAC (SCRUM-474 UNLOAD-DESIGN điểm 7); tập đóng. */
export const unloadReasonCodeSchema = z.enum(UNLOAD_REASON_CODES);

/** Số tiền BE gửi dạng số JSON (`BigDecimal`) hoặc chuỗi (`details.orders[].amountDue`) → số. */
export const amountSchema = z.coerce.number().nonnegative();

/**
 * BE `LoadResponse.PendingUnload` — kiện còn nằm trên xe, phải quét dỡ xuống: của đơn đã huỷ (SCRUM-392, chặn bàn
 * giao) hoặc của xe đã huỷ có kiểm soát (SCRUM-474, kiện bị khoá; có `reasonCode`).
 */
export const pendingUnloadSchema = z.object({
  packageId: z.string(),
  /** `PKG-<số đơn>-<n>` — mã quét. */
  labelCode: z.string(),
  shipmentId: z.string().nullish(),
  shipmentCode: z.string().nullish(),
  reason: z.string().nullish(),
  requestedAt: isoInstant.nullish(),
  /** Chỉ có khi xe huỷ có kiểm soát; vắng = kiện của đơn đã huỷ. */
  reasonCode: unloadReasonCodeSchema.nullish(),
});

/**
 * BE `LoadResponse.HandoverWarning` (09 §4.2 bước 7): đơn trên xe chưa được phép đi — trả khi BẮT ĐẦU XẾP, không
 * chặn xếp; việc chặn nằm ở bước ký (BR-04). `reasonCode` là mã lỗi mà việc bàn giao riêng của đơn sẽ trả.
 */
export const handoverWarningSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  reasonCode: z.string(),
  amountDue: amountSchema.nullish(),
  currency: z.string().nullish(),
  deliveryBatchSeq: z.number().int().nullish(),
  /** Ngày đầu tiên của đợt giao được bàn giao (`yyyy-MM-dd`). */
  windowStart: z.string().nullish(),
});

/** BE `LoadResponse.CarrierBooking` — đơn đặt xe ở hãng tích hợp API (BR-29). */
export const carrierBookingSchema = z.object({
  status: tolerantEnum(CARRIER_BOOKING_STATUSES),
  carrierOrderId: z.string().nullish(),
  trackingLink: z.string().nullish(),
  requestedAt: isoInstant.nullish(),
  bookedAt: isoInstant.nullish(),
  lastError: z.string().nullish(),
});

/** Kiểu kết nối của hãng (docs 09 §4.1); giá trị lạ → UNKNOWN. */
export const carrierConnectionTypeSchema = tolerantEnum(CARRIER_CONNECTION_TYPES);

/** `LoadRowResponse`: kế hoạch của xe, số thứ tự xe và mã vận đơn. */
export const ftlRowFields = {
  loadPlanId: z.string().nullish(),
  loadPlanCode: z.string().nullish(),
  vehicleSeq: z.number().int().nullish(),
  waybillNo: z.string().nullish(),
};

/** `LoadResponse`: thêm đặt xe, mã vận đơn, kiện cần dỡ, cảnh báo bàn giao và cờ "huỷ xe đã đặt ở ngoài". */
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
  /**
   * Xe huỷ có kiểm soát: chuyến PLANNED đang thay nó (cùng xe của kế hoạch, cùng sơ đồ). Vắng khi không có chuyến thay thế
   * (huỷ cả kế hoạch, hoặc xe không còn gì để chở) và ở mọi chuyến khác.
   */
  replacementLoadId: z.string().nullish(),
  replacementLoadCode: z.string().nullish(),
  /** Chuyến CANCELLED sau khi đã đặt xe: đặt xe ngoài hệ thống vẫn còn → điều phối phải huỷ. */
  carrierBookingToCancel: z.boolean().nullish(),
  /** Kiểu kết nối của hãng đã đặt (vắng khi chưa đặt xe). */
  carrierConnectionType: carrierConnectionTypeSchema.nullish(),
  carrierBooking: carrierBookingSchema.nullish(),
  /** Chỉ có trong câu trả lời của "bắt đầu xếp" và khi còn đơn chưa được phép đi (BE bỏ khi rỗng). */
  handoverWarnings: z.array(handoverWarningSchema).nullish(),
};

/** `ManifestResponse`: biên bản theo xe (BR-15) — chỉ kiện kế hoạch xếp lên xe. */
export const ftlManifestFields = {
  loadPlanCode: z.string().nullish(),
  vehicleSeq: z.number().int().nullish(),
  vehicleTypeCode: z.string().nullish(),
  waybillNo: z.string().nullish(),
};
