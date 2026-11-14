/**
 * Schema nhập liệu của form thanh toán (docs ecommerce/15-payment) — tách khỏi DTO của BE
 * (`schemas.ts`, api-conventions §3.1). Số tiền là chữ trong ô nhập, đổi sang số khi gửi.
 */

import { z } from "zod";

import { PAYMENT_LIMITS } from "@/constants/payment";
import { toLocalIsoDate } from "@/lib/format/date";
import { isoDate } from "@/lib/validation/primitives";

/** Ngày hôm nay theo giờ Việt Nam — BE chặn ngày nhận / ngày chuyển ở tương lai (docs 15 §3). */
export function todayInVietnam(): string {
  return toLocalIsoDate(new Date().toISOString());
}

const reference = z
  .string()
  .trim()
  .min(1, "Nhập mã tham chiếu sao kê")
  .max(PAYMENT_LIMITS.referenceMax, `Tối đa ${PAYMENT_LIMITS.referenceMax} ký tự`)
  .regex(PAYMENT_LIMITS.referencePattern, "Chỉ gồm chữ, số, khoảng trắng và . _ / : # -");

const note = z
  .string()
  .trim()
  .max(PAYMENT_LIMITS.noteMax, `Tối đa ${PAYMENT_LIMITS.noteMax} ký tự`);

/** Số tiền dạng chữ trong ô nhập: số nguyên đồng ≥ 1 (BE `@DecimalMin(1) @Digits(fraction = 0)`). */
const wholeAmount = z
  .string()
  .trim()
  .regex(/^\d+$/, "Nhập số tiền là số nguyên đồng")
  .refine((v) => Number(v) >= PAYMENT_LIMITS.amountMin, "Số tiền tối thiểu là 1 ₫")
  .refine((v) => v.length <= PAYMENT_LIMITS.amountDigitsMax, "Số tiền quá lớn");

/** Ngày không ở tương lai (giờ VN) — docs 15 §3: "ngày nhận (không ở tương lai)". */
const notFuture = (label: string) =>
  isoDate.refine((d) => d <= todayInVietnam(), `${label} không được ở tương lai`);

/**
 * Phiếu thu (docs 15 §3, §4.2 bước 6): một mã sao kê, một hoặc nhiều dòng — mỗi dòng một đợt của
 * CÙNG khách với số tiền > 0 và không vượt số còn phải thu (BR-05). `outstandingOf` tra số còn phải
 * thu của đợt (đợt chưa tải → bỏ qua, BE vẫn kiểm lại).
 */
export function buildReceiptInputSchema(
  outstandingOf: (installmentId: string) => number | undefined,
) {
  return z
    .object({
      customerId: z.string().min(1, "Chưa xác định khách hàng"),
      reference,
      receivedOn: notFuture("Ngày nhận"),
      note,
      lines: z
        .array(
          z.object({
            installmentId: z.string().min(1, "Chọn đợt thanh toán"),
            amount: wholeAmount,
          }),
        )
        .min(1, "Phiếu thu phải có ít nhất một đợt")
        .max(PAYMENT_LIMITS.linesMax, `Tối đa ${PAYMENT_LIMITS.linesMax} dòng`),
    })
    .superRefine((value, ctx) => {
      const seen = new Set<string>();
      value.lines.forEach((line, index) => {
        if (seen.has(line.installmentId))
          ctx.addIssue({
            code: "custom",
            path: ["lines", index, "installmentId"],
            message: "Mỗi đợt chỉ ghi một dòng trong phiếu",
          });
        seen.add(line.installmentId);
        const outstanding = outstandingOf(line.installmentId);
        // BR-05 (docs 15 §6): mỗi dòng không vượt số còn phải thu của đợt; không có tiền dư
        if (outstanding !== undefined && Number(line.amount) > outstanding)
          ctx.addIssue({
            code: "custom",
            path: ["lines", index, "amount"],
            message: "Không vượt số còn phải thu của đợt",
          });
      });
    });
}

/** Lý do huỷ phiếu thu / huỷ ghi nhận hoàn — bắt buộc (docs 15 §4.4, §4.5 bước 16). */
export const voidInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Nhập lý do")
    .max(PAYMENT_LIMITS.reasonMax, `Tối đa ${PAYMENT_LIMITS.reasonMax} ký tự`),
  holdOrders: z.boolean(),
});

/** Huỷ ghi nhận hoàn tiền: chỉ cần lý do (docs 15 §4.5 bước 16) — không có "treo đơn". */
export const voidRefundInputSchema = voidInputSchema.pick({ reason: true });

/** Ghi nhận đã hoàn (docs 15 §4.5 bước 16; BR-14: không vượt số còn phải hoàn). */
export function buildRefundRecordInputSchema(remaining: number) {
  return z.object({
    amount: wholeAmount.refine(
      (v) => Number(v) <= remaining,
      // BR-14 (docs 15 §6): tổng ghi nhận đã hoàn không vượt số phải hoàn
      "Không vượt số còn phải hoàn",
    ),
    refundedOn: notFuture("Ngày chuyển"),
    reference,
    note,
  });
}
