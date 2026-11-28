/**
 * Hợp đồng — mutations + invalidation (api-conventions §2.3): mọi thao tác đổi trạng thái đơn
 * (DRAFT ↔ PENDING_CONTRACT → PENDING_PAYMENT / CONFIRMED / ON_HOLD) → `orderKeys.all` (gồm hợp đồng, đợt
 * thanh toán của đơn); ký mở các đợt thanh toán → thêm root `payment-installments`.
 * OPTIMISTIC_LOCK → tải lại, không tự gửi lại (plan WF-02 §1.4). Toast lỗi do màn hình (hiện message BE).
 */

import { fileTooLargeMessage } from "@/constants/upload-limits";
import { CONTRACT_ESIGN_ERRORS } from "@/constants/contract-esign";
import { serverErrorMessage } from "@/lib/api/error-message";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";
import { salesOwnerErrorMessage } from "@/lib/references/sales-owner-access";

import {
  approveContractCredit,
  rejectContractCredit,
  withdrawContractCreditReview,
} from "./contract-credit-review-api";
import { orderKeys } from "./queries";
import {
  cancelSalesContract,
  createSalesContract,
  editSalesContract,
  sendSalesContract,
  signSalesContract,
} from "./sales-contract-api";

import { contractEsignKeys } from "./sales-contract-esign-queries";

import { SIGNED_FILE_TYPE_MESSAGE } from "./sales-contract-rules";

import type { SalesContract } from "./sales-contract-schemas";

// SALES_CONTRACT_NOT_FOUND: every write targets the live contract, so one cancelled by someone else is a 404.
const STALE_CODES = [
  "SALES_CONTRACT_STATUS_INVALID",
  "SALES_CONTRACT_ORDER_NOT_DRAFT",
  "SALES_CONTRACT_NOT_FOUND",
  // 15 BR-11: hợp đồng vừa vào / ra khỏi hàng chờ Kế toán ở nơi khác → tải lại để nút đúng trạng thái
  "CONTRACT_CREDIT_REVIEW_PENDING",
  "CONTRACT_CREDIT_REVIEW_NOT_PENDING",
] as const;

function contractMutation<TInput>(
  fn: (input: TInput) => Promise<SalesContract>,
  successMessage: string | undefined,
  extra: readonly (readonly string[])[] = [],
) {
  return withStaleRefetch(
    createMutation<TInput, SalesContract>(fn, {
      invalidate: [orderKeys.all, contractEsignKeys.all, ...extra],
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
export const useWithdrawContractCreditReview = contractMutation(
  withdrawContractCreditReview,
  "Đã rút đề nghị duyệt tín dụng — hợp đồng về Nháp để sửa.",
);
export const useApproveContractCredit = contractMutation(
  approveContractCredit,
  "Đã duyệt tín dụng — hợp đồng đã được gửi cho khách.",
);
export const useRejectContractCredit = contractMutation(
  rejectContractCredit,
  "Đã từ chối — hợp đồng về Nháp để Sale sửa lịch thanh toán.",
);

/**
 * WF-02: BE trả message tiếng Việt → hiện nguyên văn; khoá lạc quan → câu "đã tải lại". 413 (BFF hoặc BE) chỉ đến từ
 * file scan đã ký → nói rõ giới hạn thay cho câu chung "Không thể hoàn tất yêu cầu." của BFF.
 */
/**
 * `ownerName`: người phụ trách khách màn đang biết — câu BR-S12 (409 CUSTOMER_OWNED_BY_OTHER_SALES) nêu đúng tên dù BE
 * không gửi kèm.
 */
export function contractErrorMessage(error: unknown, ownerName?: string | null): string {
  const owned = salesOwnerErrorMessage(error, ownerName);
  if (owned) return owned;
  return serverErrorMessage(error, {
    ...CONTRACT_ESIGN_ERRORS,
    OPTIMISTIC_LOCK: "Dữ liệu vừa thay đổi, đã tải lại.",
    SALES_CONTRACT_NOT_FOUND: "Hợp đồng vừa bị huỷ, đã tải lại.",
    UNSUPPORTED_MEDIA_TYPE: SIGNED_FILE_TYPE_MESSAGE,
    PAYLOAD_TOO_LARGE: fileTooLargeMessage("signedContract"),
    CONTRACT_CREDIT_REVIEW_PENDING:
      "Hợp đồng đang chờ Kế toán duyệt tín dụng — rút đề nghị trước khi sửa hoặc gửi lại.",
    CONTRACT_CREDIT_REVIEW_NOT_PENDING: "Hợp đồng không còn chờ duyệt tín dụng, đã tải lại.",
    CONTRACT_CREDIT_REVIEW_SELF:
      "Bạn đã gửi duyệt hợp đồng này nên không thể tự duyệt hay từ chối.",
  });
}

/** Khoá lạc quan khi LƯU trong form sửa: form có nút "Tải lại theo bản mới", các thao tác khác thì không có. */
export const CONTRACT_EDIT_LOCK_MESSAGE =
  "Hợp đồng vừa được người khác sửa — bấm 'Tải lại theo bản mới' rồi sửa lại.";
