/**
 * Đề nghị cấp hạn mức — mutations + invalidation (api-conventions §2.3). Duyệt đặt luôn hạn mức của khách trong cùng
 * giao dịch (15 §4.3 bước 11a) → làm mới cả khách (`customers`) và vị thế tín dụng ở màn đơn (`orders`).
 * OPTIMISTIC_LOCK / sai trạng thái → tải lại, không tự gửi lại. Toast lỗi do màn hình (hiện câu trong hộp thoại).
 */

import { serverErrorMessage } from "@/lib/api/error-message";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";
import { withStaleRefetch } from "@/lib/api/stale-refetch";

import {
  approveCreditRequest,
  attachCreditRequestFile,
  createCreditRequest,
  recommendCreditRequest,
  rejectCreditRequest,
  withdrawCreditRequest,
} from "./api";
import { creditRequestKeys } from "./queries";

import type { CreditRequest } from "./types";

const STALE_CODES = ["OPTIMISTIC_LOCK", "CREDIT_REQUEST_INVALID_TRANSITION"] as const;

function requestMutation<TInput, TResult = CreditRequest>(
  fn: (input: TInput) => Promise<TResult>,
  successMessage: string,
  extra: readonly (readonly string[])[] = [],
) {
  return withStaleRefetch(
    createMutation<TInput, TResult>(fn, {
      invalidate: [creditRequestKeys.all, ...extra],
      successMessage,
      showErrorToast: false,
    }),
    [creditRequestKeys.all],
    STALE_CODES,
  );
}

export const useCreateCreditRequest = requestMutation(
  createCreditRequest,
  "Đã gửi đề nghị cấp hạn mức cho Kế toán.",
);
export const useRecommendCreditRequest = requestMutation(
  recommendCreditRequest,
  "Đã ghi ý kiến — đề nghị chuyển Kế toán duyệt.",
);
export const useApproveCreditRequest = requestMutation(
  approveCreditRequest,
  "Đã duyệt — hạn mức của khách đã được cập nhật.",
  [QUERY_ROOTS.customers, QUERY_ROOTS.orders],
);
export const useRejectCreditRequest = requestMutation(rejectCreditRequest, "Đã từ chối đề nghị.");
export const useWithdrawCreditRequest = requestMutation(withdrawCreditRequest, "Đã rút đề nghị.");
export const useAttachCreditRequestFile = requestMutation(
  attachCreditRequestFile,
  "Đã tải giấy tờ lên.",
);

/** Câu theo `errorCode` (handoff A §Lỗi) ưu tiên; mã khác hiện câu tiếng Việt của BE. */
export function creditRequestErrorMessage(error: unknown): string {
  return serverErrorMessage(error, {
    CREDIT_REQUEST_NOT_FOUND: "Không tìm thấy đề nghị.",
    CREDIT_REQUEST_ALREADY_OPEN: "Khách đã có một đề nghị đang mở — xử lý đề nghị đó trước.",
    CREDIT_REQUEST_INVALID_TRANSITION: "Đề nghị vừa đổi trạng thái, đã tải lại.",
    CREDIT_REQUEST_SELF_DECISION:
      "Bạn đã gửi hoặc ghi ý kiến cho đề nghị này nên không thể tự duyệt / từ chối.",
    CREDIT_REQUEST_ABOVE_REQUESTED: "Hạn mức duyệt không được cao hơn hạn mức khách xin.",
    CREDIT_REQUEST_NOT_FILER: "Chỉ người đã gửi đề nghị mới rút được.",
    OPTIMISTIC_LOCK:
      "Đề nghị hoặc hạn mức của khách vừa thay đổi, đã tải lại — kiểm tra rồi làm lại.",
  });
}
