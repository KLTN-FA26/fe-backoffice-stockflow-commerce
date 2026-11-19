/**
 * Sửa lý do giao thất bại (docs 09 edge "hoàn hàng khi còn Handed Over ... Quản lý kho sửa lý do thất bại nếu biết lý do
 * thật"; BE `FailureReasonCorrectionRequest`). Backend phải re-check mọi rule dưới đây.
 */

import { z } from "zod";

import {
  ORDER_DELIVERY_FAILURE_REASONS,
  SHIPPING_FIELD_MESSAGES as MSG,
  SHIPPING_LIMITS,
} from "@/constants";

import { optionalText } from "./input-schemas";

export const failureReasonCorrectionInputSchema = z
  .object({
    failureReason: z.enum(ORDER_DELIVERY_FAILURE_REASONS, { error: MSG.reasonRequired }),
    note: optionalText(SHIPPING_LIMITS.noteMax),
    reason: z.string().trim().min(1, MSG.required).max(SHIPPING_LIMITS.noteMax, MSG.tooLong),
  })
  // Docs 09 §4.3 bước 3: lý do "Khác" bắt buộc ghi chú
  .superRefine((value, ctx) => {
    if (value.failureReason === "OTHER" && !value.note) {
      ctx.addIssue({ code: "custom", path: ["note"], message: MSG.noteRequiredForOther });
    }
  });

export type FailureReasonCorrectionFormInput = z.input<typeof failureReasonCorrectionInputSchema>;
export type FailureReasonCorrectionValues = z.output<typeof failureReasonCorrectionInputSchema>;

/** Lô giao có lý do thất bại để sửa: đã giao thất bại hoặc hàng đã hoàn về (docs 09 §5.1). */
export function hasFailureReason(shipment: {
  status: string;
  failureReason?: string | null;
}): boolean {
  return (
    (shipment.status === "DELIVERY_FAILED" || shipment.status === "RETURNED") &&
    Boolean(shipment.failureReason)
  );
}
