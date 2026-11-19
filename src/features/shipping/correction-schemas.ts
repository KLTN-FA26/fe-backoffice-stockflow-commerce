/**
 * Shipping — sửa tay kết quả giao (docs 09 §4.3 bước 5, E17; BE `DeliveryOutcomeCorrectionRequest`): ĐÃ GIAO ↔ GIAO THẤT BẠI
 * với lý do sửa bắt buộc. Giao thất bại thì kèm lý do + ghi chú như lúc ghi nhận (OTHER bắt buộc ghi chú); sửa thành đã
 * giao thì có thể kèm thời điểm giao. Backend phải re-check mọi rule dưới đây.
 */

import { z } from "zod";

import {
  ORDER_DELIVERY_FAILURE_REASONS,
  SHIPPING_CORRECTION_LABELS as C,
  SHIPPING_FIELD_MESSAGES as MSG,
  SHIPPING_LIMITS,
} from "@/constants";
import { PACK_SHIPMENT_STATUS } from "@/constants/statuses";

import { optionalText } from "./input-schemas";

/** Kết quả mà BE cho sửa thành (`DeliveryOutcomeCorrectionRequest.outcome`). */
export const CORRECTION_OUTCOMES = [
  PACK_SHIPMENT_STATUS.DELIVERED,
  PACK_SHIPMENT_STATUS.DELIVERY_FAILED,
] as const;
export type CorrectionOutcome = (typeof CORRECTION_OUTCOMES)[number];

/** Kết quả đối nghịch: một lô đã giao thì sửa thành giao thất bại và ngược lại. */
export function correctionTarget(current: string): CorrectionOutcome | null {
  if (current === PACK_SHIPMENT_STATUS.DELIVERED) return PACK_SHIPMENT_STATUS.DELIVERY_FAILED;
  if (current === PACK_SHIPMENT_STATUS.DELIVERY_FAILED) return PACK_SHIPMENT_STATUS.DELIVERED;
  return null;
}

const correctionShape = z.object({
  outcome: z.enum(CORRECTION_OUTCOMES),
  failureReason: z.enum(ORDER_DELIVERY_FAILURE_REASONS).optional(),
  note: optionalText(SHIPPING_LIMITS.noteMax),
  reason: z
    .string()
    .trim()
    .min(1, C.reasonRequired)
    .max(SHIPPING_LIMITS.cancelReasonMax, MSG.tooLong),
  deliveredAt: z.string().optional(),
});
type CorrectionBody = z.output<typeof correctionShape>;

export const deliveryCorrectionInputSchema = correctionShape
  .superRefine((value, ctx) => {
    if (value.outcome !== PACK_SHIPMENT_STATUS.DELIVERY_FAILED) return;
    if (!value.failureReason) {
      ctx.addIssue({ code: "custom", path: ["failureReason"], message: MSG.reasonRequired });
    } else if (value.failureReason === "OTHER" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: MSG.noteRequiredForOther });
    }
  })
  // BE: lý do / ghi chú chỉ với giao thất bại; thời điểm giao chỉ với đã giao (kèm kia là 400)
  .transform((value): CorrectionBody =>
    value.outcome === PACK_SHIPMENT_STATUS.DELIVERY_FAILED
      ? { ...value, deliveredAt: undefined }
      : { ...value, failureReason: undefined, note: undefined },
  );

export type DeliveryCorrectionFormInput = z.input<typeof deliveryCorrectionInputSchema>;
export type DeliveryCorrectionValues = z.output<typeof deliveryCorrectionInputSchema>;

export interface CorrectOutcomeInput {
  shipmentId: string;
  values: DeliveryCorrectionValues;
}
