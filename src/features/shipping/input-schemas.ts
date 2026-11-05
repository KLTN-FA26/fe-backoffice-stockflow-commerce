/**
 * Shipping — Input schemas (quét kiện, mở chuyến, bàn giao, huỷ chuyến, kết quả giao). Giới hạn độ
 * dài theo BE `LoadScanRequest` / `OpenLoadRequest` / `HandoverRequest` / `CancelLoadRequest` /
 * `DeliveryOutcomeRequest` (PR #137). Backend phải re-check mọi rule dưới đây.
 */

import { z } from "zod";

import {
  DELIVERY_OUTCOMES,
  UNLOAD_REASON_CODES,
  ORDER_DELIVERY_FAILURE_REASONS,
  SHIPPING_FIELD_MESSAGES as MSG,
  SHIPPING_LIMITS,
} from "@/constants";

/** Mã vạch kiện chỉ gồm ký tự ASCII in được, không khoảng trắng. */
const PRINTABLE_ASCII = /^[\x21-\x7E]+$/;
const L = SHIPPING_LIMITS;

/** Ô tuỳ chọn: cắt khoảng trắng, rỗng → `undefined` (BE bỏ qua field vắng, không nhận chuỗi rỗng). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, MSG.tooLong)
    .optional()
    .transform((value) => value || undefined);

/**
 * Mã kiện quét lên xe — BE so khớp không phân biệt hoa thường. Bộ gõ tiếng Việt đang bật có thể biến
 * ký tự máy quét gửi thành chữ có dấu → chặn sớm, báo rõ cách sửa thay vì để BE trả "không tìm thấy kiện".
 */
export const scanPackageInputSchema = z.object({
  packageCode: z
    .string()
    .trim()
    .min(1, MSG.scanRequired)
    .max(L.scanCodeMax, MSG.scanTooLong)
    .regex(PRINTABLE_ASCII, MSG.scanNotAscii)
    .transform((code) => code.toUpperCase()),
});

/** Mở chuyến khi tài xế hãng tới (docs 09 §4.1 bước 3): kho + hãng bắt buộc, xe và tài xế tuỳ chọn. */
export const openLoadInputSchema = z.object({
  warehouseId: z.string().min(1, MSG.warehouseRequired),
  carrierId: z.string().min(1, MSG.carrierRequired),
  vehiclePlate: optionalText(L.vehiclePlateMax),
  driverName: optionalText(L.driverNameMax),
  driverPhone: optionalText(L.driverPhoneMax),
});

/**
 * Xác nhận bàn giao: biên bản giấy hai bên ký (docs 09 §4.1 bước 3) — hệ thống ghi người ký bên hãng
 * và xác nhận đã ký, không có chữ ký số. Biển số bắt buộc trừ khi chuyến đã ghi biển số lúc mở
 * (BE `DispatchLoad.handOver`).
 */
export function handoverInputSchema(plateRequired: boolean) {
  return z.object({
    carrierRepresentative: z
      .string()
      .trim()
      .min(1, MSG.carrierRepresentativeRequired)
      .max(L.carrierRepresentativeMax, MSG.tooLong),
    vehiclePlate: plateRequired
      ? z.string().trim().min(1, MSG.vehiclePlateRequired).max(L.vehiclePlateMax, MSG.tooLong)
      : optionalText(L.vehiclePlateMax),
    driverPhone: optionalText(L.driverPhoneMax),
    signatureRef: optionalText(L.signatureRefMax),
    note: optionalText(L.noteMax),
    // 400 HANDOVER_NOT_SIGNED nếu không ký — chặn sớm ở form
    signed: z.literal(true, { message: MSG.signedRequired }),
  });
}

/** Huỷ chuyến chưa rời kho (BE `CancelLoadRequest`): bắt buộc nêu lý do. */
export const cancelLoadInputSchema = z.object({
  reason: z.string().trim().min(1, MSG.cancelReasonRequired).max(L.cancelReasonMax, MSG.tooLong),
});

/**
 * Đặt xe của một xe trong kế hoạch xếp xe (BE `BookingRequest`, PR #162): hãng bắt buộc; biển số và tài
 * xế có thể bổ sung sau (chậm nhất lúc ký bàn giao). Đặt lại khi còn VEHICLE_BOOKED = thay thông tin.
 */
export const bookingInputSchema = z.object({
  carrierId: z.string().min(1, MSG.carrierRequired),
  vehiclePlate: optionalText(L.vehiclePlateMax),
  driverName: optionalText(L.driverNameMax),
  driverPhone: optionalText(L.driverPhoneMax),
});

/** Đặt xe không thành trước khi xếp hàng (BE `CancelLoadRequest`): bắt buộc nêu lý do. */
export const cancelBookingInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, MSG.cancelBookingReasonRequired)
    .max(L.cancelReasonMax, MSG.tooLong),
});

/**
 * Huỷ có kiểm soát một xe đang xếp hàng (BE `ControlledCancelRequest`, SCRUM-474 UNLOAD-DESIGN điểm 7): một trong bốn mã
 * lý do và ghi chú bắt buộc (≤ 500 ký tự).
 */
export const controlledCancelInputSchema = z.object({
  reasonCode: z.enum(UNLOAD_REASON_CODES, { error: MSG.controlledReasonCodeRequired }),
  note: z.string().trim().min(1, MSG.controlledNoteRequired).max(L.cancelReasonMax, MSG.tooLong),
});

/** Xác nhận dỡ kiện không quét (BE `UnloadOverrideRequest`): ghi chú tuỳ chọn, ≤ 500 ký tự. */
export const overrideUnloadInputSchema = z.object({
  note: optionalText(L.noteMax),
});

/**
 * Kết quả hãng báo lại (docs 09 §4.3, BR-02; BE `DeliveryOutcomeRequest`): giao thất bại phải có lý do,
 * lý do "Khác" phải có ghi chú.
 */
export const deliveryOutcomeInputSchema = z
  .object({
    outcome: z.enum(DELIVERY_OUTCOMES),
    failureReason: z.enum(ORDER_DELIVERY_FAILURE_REASONS).optional(),
    note: optionalText(L.noteMax),
  })
  .superRefine((value, ctx) => {
    if (value.outcome !== "DELIVERY_FAILED") return;
    if (!value.failureReason) {
      ctx.addIssue({ code: "custom", path: ["failureReason"], message: MSG.reasonRequired });
    } else if (value.failureReason === "OTHER" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: MSG.noteRequiredForOther });
    }
  })
  // BE chỉ lưu lý do / ghi chú của lần GIAO THẤT BẠI (`Shipment#recordFailed`); kết quả khác bỏ cả hai
  .transform((value) =>
    value.outcome === "DELIVERY_FAILED"
      ? value
      : { outcome: value.outcome, failureReason: undefined, note: undefined },
  );
