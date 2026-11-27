/**
 * Giao dịch ngân hàng SePay — vòng đời + action-gating (kế hoạch tín dụng 2026-11-26 phần C; BE
 * `BankTransactionStatus`): RECEIVED (đang xử lý) → APPLIED (đã lập phiếu thu) | NEEDS_REVIEW (chờ Kế toán);
 * NEEDS_REVIEW → APPLIED (Kế toán gán) | IGNORED (bỏ qua kèm lý do). Huỷ phiếu thu tự lập đưa giao dịch về NEEDS_REVIEW
 * (`RECEIPT_VOIDED`). UI-only — Backend phải re-check (payment-bank-transactions:UPDATE; chỉ NEEDS_REVIEW →
 * BANK_TRANSACTION_NOT_OPEN).
 */

import { BANK_TRANSACTION_PERMISSIONS } from "@/constants/bank-transaction";

import type { PermissionCode } from "@/lib/auth";
import type { BankTransactionStatus } from "./types";

export const BANK_TRANSACTION_TRANSITIONS = {
  RECEIVED: ["APPLIED", "NEEDS_REVIEW"],
  NEEDS_REVIEW: ["APPLIED", "IGNORED"],
  // Huỷ phiếu thu lập từ giao dịch → quay lại hàng chờ (RECEIPT_VOIDED)
  APPLIED: ["NEEDS_REVIEW"],
  IGNORED: [],
  UNKNOWN: [],
} as const satisfies Record<BankTransactionStatus, readonly BankTransactionStatus[]>;

export type BankTransactionAction = "assign" | "ignore";

export function allowedBankTransactionActions(
  status: BankTransactionStatus,
  can: (code: PermissionCode) => boolean,
): BankTransactionAction[] {
  if (status !== "NEEDS_REVIEW" || !can(BANK_TRANSACTION_PERMISSIONS.update)) return [];
  return ["assign", "ignore"];
}
