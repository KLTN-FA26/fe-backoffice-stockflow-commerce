/** Giao dịch ngân hàng — hàm thuần. */

import {
  BANK_TRANSACTION_LABELS,
  BANK_TRANSACTION_REVIEW_REASONS,
} from "@/constants/bank-transaction";

import type { PayableInstallment } from "./types";

/** Đợt còn nhận tiền (15 BR-05; BE `InstallmentStatus.takesMoney`). */
const PAYABLE = new Set(["NOT_DUE", "DUE", "PARTIALLY_PAID"]);

/** Câu tiếng Việt của `reviewReason`; mã chưa dịch → câu chung (không hiện mã / chữ BE). */
export function reviewReasonText(code: string | null | undefined): string | null {
  if (!code) return null;
  return BANK_TRANSACTION_REVIEW_REASONS[code] ?? BANK_TRANSACTION_LABELS.reviewReasonFallback;
}

export function payableInstallments(rows: readonly PayableInstallment[]): PayableInstallment[] {
  return rows.filter((row) => PAYABLE.has(row.status) && row.outstanding > 0);
}

export function assignedTotal(lines: readonly { amount: unknown }[]): number {
  return lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

/** Đợt còn nhận tiền có số còn phải thu đúng bằng số tiền giao dịch — ứng viên để gán cả giao dịch vào một đợt. */
export function matchingInstallments(
  rows: readonly PayableInstallment[],
  amount: number,
): PayableInstallment[] {
  return payableInstallments(rows).filter((row) => row.outstanding === amount);
}
