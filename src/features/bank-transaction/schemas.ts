/**
 * Giao dịch ngân hàng SePay — DTO BE `BankTransactionResponse` (PR #490) + Input gán vào đợt / bỏ qua. Đợt thanh toán
 * để gán: tập con `InstallmentResponse` của `GET /installments` (chỉ những trường form cần).
 */

import { z } from "zod";

import {
  BANK_TRANSACTION_API_STATUSES,
  BANK_TRANSACTION_LIMITS,
} from "@/constants/bank-transaction";

import { bePageSchema } from "@/lib/api/page-schema";

export const bankTransactionDtoSchema = z.object({
  id: z.string(),
  provider: z.string(),
  /** `WEBHOOK` | `CATCH_UP`. */
  source: z.string(),
  providerTransactionId: z.string().nullish(),
  accountNumber: z.string().nullish(),
  amount: z.number(),
  currency: z.string().default("VND"),
  content: z.string().nullish(),
  bankReference: z.string().nullish(),
  paymentCode: z.string().nullish(),
  transactionAt: z.string().nullish(),
  receivedAt: z.string(),
  status: z.union([
    z.enum(BANK_TRANSACTION_API_STATUSES),
    z.string().transform((): "UNKNOWN" => "UNKNOWN"),
  ]),
  /** Chỉ khi NEEDS_REVIEW — FE dịch (`BANK_TRANSACTION_REVIEW_REASONS`). */
  reviewReason: z.string().nullish(),
  /** Chi tiết tiếng Anh của hệ thống — hiện phụ. */
  reviewNote: z.string().nullish(),
  customerId: z.string().nullish(),
  customerCode: z.string().nullish(),
  customerName: z.string().nullish(),
  installmentId: z.string().nullish(),
  receiptReference: z.string().nullish(),
  receiptId: z.string().nullish(),
  /** `true` = hệ thống tự lập phiếu thu. */
  automatic: z.boolean().default(false),
  decidedAt: z.string().nullish(),
  reviewedBy: z.string().nullish(),
  reviewedByName: z.string().nullish(),
  reviewedAt: z.string().nullish(),
  ignoreReason: z.string().nullish(),
});

export const bankTransactionPageDtoSchema = bePageSchema(bankTransactionDtoSchema);

export const payableInstallmentSchema = z.object({
  installmentId: z.string(),
  contractNumber: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  seq: z.number().int(),
  name: z.string(),
  outstanding: z.number(),
  currency: z.string(),
  dueDate: z.string().nullish(),
  status: z.string(),
});
export const payableInstallmentPageSchema = bePageSchema(payableInstallmentSchema);

/** Gán vào đợt: ≥ 1 dòng, mỗi dòng > 0; tổng ≤ số tiền giao dịch (BE BANK_TRANSACTION_OVER_ASSIGNED). */
export function assignInputFor(transactionAmount: number) {
  return z
    .object({
      customerId: z.string().min(1, "Chọn khách hàng"),
      lines: z
        .array(
          z.object({
            installmentId: z.string().min(1),
            amount: z.coerce.number({ message: "Nhập số tiền" }).int().positive("Lớn hơn 0"),
          }),
        )
        .min(1, "Chọn ít nhất một đợt")
        .max(BANK_TRANSACTION_LIMITS.linesMax),
      note: z.string().trim().max(BANK_TRANSACTION_LIMITS.noteMax, "Tối đa 500 ký tự").optional(),
    })
    .refine((v) => v.lines.reduce((sum, line) => sum + line.amount, 0) <= transactionAmount, {
      path: ["lines"],
      message: "Tổng tiền gán lớn hơn số tiền của giao dịch",
    });
}
