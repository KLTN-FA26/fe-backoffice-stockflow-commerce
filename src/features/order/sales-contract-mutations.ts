/**
 * Hợp đồng — mutations + invalidation (api-conventions §2.3): mọi thao tác đổi trạng thái đơn
 * (DRAFT ↔ PENDING_CONTRACT → PENDING_PAYMENT / CONFIRMED / ON_HOLD) → `orderKeys.all` (gồm hợp đồng, đợt
 * thanh toán của đơn); ký mở các đợt thanh toán → thêm root `payment-installments`.
 * OPTIMISTIC_LOCK → tải lại, không tự gửi lại (plan WF-02 §1.4). Toast lỗi do màn hình (hiện message BE).
 */

import { serverErrorMessage } from "@/lib/api/error-message";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import { orderKeys } from "./queries";
import {
  cancelSalesContract,
  createSalesContract,
  editSalesContract,
  sendSalesContract,
  signSalesContract,
} from "./sales-contract-api";

import type { SalesContract } from "./sales-contract-schemas";

const STALE_CODES = ["SALES_CONTRACT_STATUS_INVALID", "SALES_CONTRACT_ORDER_NOT_DRAFT"] as const;

function contractMutation<TInput>(
  fn: (input: TInput) => Promise<SalesContract>,
  successMessage: string | undefined,
  extra: readonly (readonly string[])[] = [],
) {
  return withStaleRefetch(
    createMutation<TInput, SalesContract>(fn, {
      invalidate: [orderKeys.all, ...extra],
      successMessage,
      showErrorToast: false,
    }),
    [orderKeys.all],
    STALE_CODES,
  );
}

export const useCreateSalesContract = contractMutation(
  createSalesContract,
  "Đã lập hợp đồng nháp.",
);
export const useEditSalesContract = contractMutation(editSalesContract, "Đã lưu hợp đồng.");
// Toast gửi do màn hình (kèm cảnh báo tín dụng nếu có).
export const useSendSalesContract = contractMutation(sendSalesContract, undefined);
export const useSignSalesContract = contractMutation(signSalesContract, undefined, [
  QUERY_ROOTS.paymentInstallments,
]);
export const useCancelSalesContract = contractMutation(cancelSalesContract, "Đã huỷ hợp đồng.");

/** WF-02: BE trả message tiếng Việt → hiện nguyên văn; khoá lạc quan → câu "đã tải lại". */
export function contractErrorMessage(error: unknown): string {
  return serverErrorMessage(error, { OPTIMISTIC_LOCK: "Dữ liệu vừa thay đổi, đã tải lại." });
}
