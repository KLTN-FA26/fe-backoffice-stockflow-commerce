/**
 * Giao dịch ngân hàng — mutations. Gán vào đợt lập phiếu thu → đổi đợt, phiếu thu và có thể xác nhận đơn (đơn tự
 * CONFIRMED như khi Kế toán lập phiếu) → làm mới cả `installments`, `payment-receipts`, `orders`.
 */

import { serverErrorMessage } from "@/lib/api/error-message";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { assignBankTransaction, ignoreBankTransaction } from "./api";
import { bankTransactionKeys } from "./queries";

import type { BankTransaction } from "./types";

const STALE_CODES = ["BANK_TRANSACTION_NOT_OPEN"] as const;
const PAYMENT_RECEIPTS_ROOT = ["payment-receipts"] as const;

export const useAssignBankTransaction = withStaleRefetch(
  createMutation<Parameters<typeof assignBankTransaction>[0], BankTransaction>(
    assignBankTransaction,
    {
      invalidate: [
        bankTransactionKeys.all,
        QUERY_ROOTS.paymentInstallments,
        PAYMENT_RECEIPTS_ROOT,
        QUERY_ROOTS.orders,
      ],
      successMessage: "Đã gán vào đợt — phiếu thu đã được lập.",
      showErrorToast: false,
    },
  ),
  [bankTransactionKeys.all],
  STALE_CODES,
);

export const useIgnoreBankTransaction = withStaleRefetch(
  createMutation<Parameters<typeof ignoreBankTransaction>[0], BankTransaction>(
    ignoreBankTransaction,
    {
      invalidate: [bankTransactionKeys.all],
      successMessage: "Đã bỏ qua giao dịch.",
      showErrorToast: false,
    },
  ),
  [bankTransactionKeys.all],
  STALE_CODES,
);

/** Câu theo `errorCode` (handoff C) ưu tiên; lỗi lập phiếu thu khác hiện câu tiếng Việt của BE. */
export function bankTransactionErrorMessage(error: unknown): string {
  return serverErrorMessage(error, {
    BANK_TRANSACTION_NOT_FOUND: "Không tìm thấy giao dịch ngân hàng.",
    BANK_TRANSACTION_NOT_OPEN: "Giao dịch ngân hàng này đã được xử lý, đã tải lại.",
    BANK_TRANSACTION_OVER_ASSIGNED: "Tổng tiền gán cho các đợt lớn hơn số tiền của giao dịch.",
  });
}
