/**
 * Input form Đơn sản xuất (docs 17 §4.3) — kiểm theo `@NotNull` / `@Min` / `@Size` của BE `EditProductionOrderRequest`,
 * `AcceptProductionOrderRequest`, `ExpectedCompletionRequest`, kèm BR refine có cite docs.
 */

import { z } from "zod";

import { PRODUCTION_LABELS, PRODUCTION_LIMITS as LIMITS } from "@/constants";
import { todayIso } from "@/lib/date-range";

const E = PRODUCTION_LABELS.edit.validation;
const D = PRODUCTION_LABELS.dialogs;
const POSITIVE_INT = /^[1-9]\d*$/;

export const productionOrderLineInput = z.object({
  orderLineId: z.string(),
  sku: z.string(),
  // BR-05 (docs 17 §6): số thùng nguyên ≥ 1
  cartons: z.string().trim().regex(POSITIVE_INT, E.cartonsMin),
  packingRequirements: z.string().trim().max(LIMITS.textMax, E.textMax),
});

/** Form sửa nháp. `sampleRequiredByDefault` chép từ bản ghi để kiểm BR-24, không gửi lên. */
export const productionOrderEditInput = z
  .object({
    producerId: z.string().min(1, E.producerRequired),
    // BR-26 (docs 17 §6): ngày cần hàng sửa được khi còn Draft
    needByDate: z.string().min(1, E.needByRequired),
    note: z.string().trim().max(LIMITS.textMax, E.textMax),
    sampleApprovalRequired: z.boolean(),
    sampleRequiredByDefault: z.boolean(),
    sampleWaiverReason: z.string().trim().max(LIMITS.textMax, E.textMax),
    lines: z.array(productionOrderLineInput),
  })
  // BR-24 (docs 17 §6): mặc định bật (SKU sản xuất lần đầu) mà tắt thì bắt buộc lý do
  .refine(
    (v) => v.sampleApprovalRequired || !v.sampleRequiredByDefault || v.sampleWaiverReason !== "",
    { path: ["sampleWaiverReason"], message: E.waiverRequired },
  );

/**
 * Ngày hoàn thành dự kiến (docs 17 §4.3 bước 8, 10). BE trả VALIDATION_FAILED khi ở quá khứ. `optional` cho "Bắt đầu
 * sản xuất" — bỏ trống = giữ ngày đã ghi khi nhận đơn. `note` chỉ gửi khi ghi nhận nhận đơn (docs 17 §4.3 bước 8, chốt
 * lại 2026-11-20: ghi chú tuỳ chọn ≤ 500, ghi một lần — BE `AcceptProductionOrderRequest.note`).
 */
export function expectedDateInput(optional: boolean) {
  return z.object({
    date: z
      .string()
      .refine((value) => optional || value !== "", D.expectedRequired)
      .refine((value) => value === "" || value >= todayIso(), D.expectedPast),
    note: z.string().trim().max(LIMITS.textMax, E.textMax),
  });
}
