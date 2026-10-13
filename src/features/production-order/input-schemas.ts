/**
 * Input (form) của thao tác xưởng — ràng buộc chép từ DTO BE (d215f6e). BE vẫn kiểm tra lại.
 */

import { z } from "zod";

import { HOLD_REASONS, SCRAP_REASONS, SUBCONTRACT_METHODS } from "./schemas";

const wholeNumber = (message: string, min = 0) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .refine((v) => Number(v) >= min, message);
const note = z.string().trim().max(1000, "Tối đa 1000 ký tự");

export const prepressInputSchema = z
  .object({ decision: z.enum(["PASS", "FAIL"]), note })
  // BE: FAIL bắt buộc ghi chú (file bị từ chối → treo FILE_REJECTED, báo Sales).
  .refine((v) => v.decision === "PASS" || v.note !== "", {
    path: ["note"],
    message: "Ghi rõ lý do không đạt",
  });

export const holdInputSchema = z
  .object({ reason: z.enum(HOLD_REASONS), note })
  .refine((v) => v.reason !== "OTHER" || v.note !== "", {
    path: ["note"],
    message: "Lý do khác cần ghi chú",
  });

/** Phế phẩm khi in — QC_FAILED do QC ghi, không cho chọn ở đây. */
export const PRINT_SCRAP_REASONS = SCRAP_REASONS.filter((reason) => reason !== "QC_FAILED");

export const scrapLineInputSchema = z
  .object({
    reason: z.enum(SCRAP_REASONS),
    quantity: wholeNumber("SL phế là số nguyên ≥ 1", 1),
    note,
  })
  .refine((v) => v.reason !== "OTHER" || v.note !== "", {
    path: ["note"],
    message: "Lý do khác cần ghi chú",
  });

/**
 * Ghi sản lượng: in ≥ 1, tổng phế ≤ số in (BR-PRD-04, BE docs/handoffs/SCRUM-394-395.md: phế phẩm trừ kho
 * ngay) và ≤ phôi đã xuất còn chưa in (BE kiểm). `maxPrintable` truyền từ màn hình.
 */
export function outputInputSchema(maxPrintable: number) {
  return z
    .object({
      printed: wholeNumber("SL in là số nguyên ≥ 1", 1).refine((v) => Number(v) <= maxPrintable, {
        message: `Không vượt số phôi đã xuất còn chưa in (${maxPrintable})`,
      }),
      scrap: z.array(scrapLineInputSchema).max(10),
    })
    .refine(
      (v) =>
        v.scrap.reduce((sum, line) => sum + Number(line.quantity || 0), 0) <=
        Number(v.printed || 0),
      {
        path: ["scrap"],
        message: "Tổng phế không được vượt số đã in",
      },
    );
}

export const qcBaseSchema = z.object({
  passed: wholeNumber("Số nguyên ≥ 0"),
  failed: wholeNumber("Số nguyên ≥ 0"),
  note,
  packingLocation: z.string().trim().max(64, "Tối đa 64 ký tự"),
});

/** QC: đạt + lỗi phải ĐÚNG bằng số đang chờ QC (BE VALIDATION_FAILED nếu lệch). */
export function qcSumMatches(
  values: { passed: string; failed: string },
  awaiting: number,
): boolean {
  return Number(values.passed) + Number(values.failed) === awaiting;
}

export const reasonInputSchema = z.object({
  reason: z.string().trim().min(1, "Nhập lý do").max(500, "Tối đa 500 ký tự"),
});

export const stopInputSchema = z.object({
  printed: wholeNumber("Số nguyên ≥ 0"),
  reason: z.string().trim().min(1, "Nhập lý do dừng").max(500, "Tối đa 500 ký tự"),
});

/**
 * Huỷ LSX gia công: phí đã thoả thuận với nhà gia công do quản lý nhập kèm lý do (QA2 —
 * SPRINT2-FINISH-DECISIONS: không tự tính, không tự chi).
 */
export const cancelInputSchema = z
  .object({
    reason: z.string().trim().min(1, "Nhập lý do huỷ").max(500, "Tối đa 500 ký tự"),
    subcontractorFee: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Số tiền ≥ 0, tối đa 2 số lẻ"),
    subcontractorFeeReason: z.string().trim().max(1000, "Tối đa 1000 ký tự"),
  })
  .refine(
    (v) =>
      !v.subcontractorFee || Number(v.subcontractorFee) === 0 || v.subcontractorFeeReason !== "",
    {
      path: ["subcontractorFeeReason"],
      message: "Phí > 0 cần ghi lý do",
    },
  );

export const splitInputSchema = z.object({
  quantity: wholeNumber("SL gia công là số nguyên ≥ 1", 1),
  subcontractorId: z.string().trim().min(1, "Chọn nhà gia công"),
  method: z.enum(SUBCONTRACT_METHODS),
  // Procurement từ chối đơn giá 0 dù DTO cho ≥ 0 → FE yêu cầu > 0.
  unitPrice: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,4})?$/.test(v) && Number(v) > 0, "Đơn giá gia công > 0"),
  dueDate: z.string().trim(),
});

export const reconcileInputSchema = z.object({
  spoilt: wholeNumber("Số nguyên ≥ 0"),
  returned: wholeNumber("Số nguyên ≥ 0"),
  returnLocation: z.string().trim().max(64, "Tối đa 64 ký tự"),
});

/** QA1: quản lý nhập mức khấu trừ / phôi hao hụt vượt dung sai đã thoả thuận + lý do (audit). */
export const lossApprovalInputSchema = z.object({
  deductionPerBlank: z
    .string()
    .trim()
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Số tiền ≥ 0, tối đa 2 số lẻ"),
  note: z.string().trim().min(1, "Ghi lý do / căn cứ thoả thuận").max(1000, "Tối đa 1000 ký tự"),
});

export const recallInputSchema = z
  .object({
    returned: wholeNumber("Số nguyên ≥ 0"),
    spoilt: wholeNumber("Số nguyên ≥ 0"),
    returnLocation: z.string().trim().max(64, "Tối đa 64 ký tự"),
    note,
  })
  .refine((v) => Number(v.returned) + Number(v.spoilt) >= 1, {
    path: ["returned"],
    message: "Nhập số phôi trả về hoặc hỏng (tổng ≥ 1)",
  });

export const quantityReasonInputSchema = z.object({
  quantity: wholeNumber("Số lượng là số nguyên ≥ 1", 1),
  reason: z.string().trim().min(1, "Nhập lý do").max(500, "Tối đa 500 ký tự"),
  packingLocation: z.string().trim().max(64, "Tối đa 64 ký tự"),
});
