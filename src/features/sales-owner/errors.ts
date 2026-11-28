/**
 * Lỗi BE → câu tiếng Việt (hợp đồng sales-owner §Error codes). Câu theo mã ở đây ưu tiên; mã khác hiện câu tiếng Việt
 * của BE (`serverErrorMessage`).
 */

import { SALES_OWNER_ERROR_CODES, SALES_OWNER_LIMITS } from "@/constants/sales-owner";

import { serverErrorMessage } from "@/lib/api/error-message";
import { OWNER_CHANGE_ERROR_MESSAGES, ownerChangeErrorMessage } from "@/lib/references/sales-owner";

const COVER_MESSAGES: Readonly<Record<string, string>> = {
  STAFF_COVER_OVERLAP:
    "Người này đã có lịch thay trùng khoảng ngày. Sửa ngày hoặc huỷ lịch cũ trước.",
  STAFF_COVER_TOO_LONG: "Lịch thay tối đa 60 ngày. Nghỉ dài hơn thì chuyển khách theo lô tạm.",
  STAFF_COVER_SELF: "Không thể tự lo thay cho chính mình. Chọn người thay khác.",
  SALES_OWNER_NOT_ASSIGNABLE: "Người thay phải là Sale đang làm.",
  FORBIDDEN: "Sale chỉ lập và huỷ lịch thay cho chính mình.",
  CONFLICT: "Lịch thay vừa thay đổi, đã tải lại.",
};

const LEAD_MESSAGES: Readonly<Record<string, string>> = {
  LEAD_ALREADY_HANDLED: "Khách tiềm năng này vừa được người khác xử lý, đã tải lại.",
  SALES_OWNER_NOT_ASSIGNABLE: "Người này không phải Sale đang làm nên không giao được.",
  FORBIDDEN: "Bạn không xử lý được khách tiềm năng này.",
};

const REQUEST_MESSAGES: Readonly<Record<string, string>> = {
  ...OWNER_CHANGE_ERROR_MESSAGES,
  CONFLICT: "Yêu cầu vừa được quyết định, đã tải lại.",
  FORBIDDEN: "Chỉ Sales Manager hoặc quản trị viên quyết yêu cầu đổi Sale.",
};

const TRANSFER_MESSAGES: Readonly<Record<string, string>> = {
  ...OWNER_CHANGE_ERROR_MESSAGES,
  SALES_OWNER_NOT_ASSIGNABLE: "Có Sale nhận không còn làm. Bỏ người đó khỏi danh sách nhận.",
  IDEMPOTENT_REQUEST_IN_PROGRESS:
    "Lô này đang chạy. Chờ một chút rồi bấm lại — không bị chuyển hai lần.",
  // BR-S09: cùng requestId, nội dung khác lần trước — hộp thoại sinh khoá mới (TransferDialog)
  [SALES_OWNER_ERROR_CODES.transferRequestReused]:
    "Yêu cầu chuyển này đã được gửi với nội dung khác. Mở lại hộp thoại để tạo yêu cầu mới.",
  [SALES_OWNER_ERROR_CODES.transferTooLarge]: `Mỗi lần chỉ chuyển tối đa ${SALES_OWNER_LIMITS.transferMax} khách. Hãy chọn từng nhóm khách để chuyển.`,
};

export const coverErrorMessage = (e: unknown) => serverErrorMessage(e, COVER_MESSAGES);
export const leadErrorMessage = (e: unknown) => serverErrorMessage(e, LEAD_MESSAGES);
export const requestErrorMessage = (e: unknown) => ownerChangeErrorMessage(e, REQUEST_MESSAGES);
export const transferErrorMessage = (e: unknown) => ownerChangeErrorMessage(e, TRANSFER_MESSAGES);
export const settingsErrorMessage = (e: unknown) => ownerChangeErrorMessage(e);

/** Lý do BE bỏ qua một khách trong lô (BR-S09; BE `SalesOwnerTransfers.Skip`, đủ bốn mã). */
export const SKIP_REASON_LABELS: Readonly<Record<string, string>> = {
  OWNER_CHANGED: "Khách vừa được đổi người phụ trách trong lúc chuyển",
  NOT_OWNED_BY_SOURCE: "Khách không còn thuộc Sale này",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách",
  REASSIGNED_SINCE: "Khách đã được chuyển tiếp cho người khác",
};

/** Mã lý do lạ (BE thêm sau) không hiện nguyên văn tiếng Anh. */
export const skipReasonLabel = (reason: string | null | undefined): string =>
  (reason && SKIP_REASON_LABELS[reason]) || "Không rõ lý do";
