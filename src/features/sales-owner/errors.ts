/**
 * Lỗi BE → câu tiếng Việt (hợp đồng sales-owner §Error codes). Câu theo mã ở đây ưu tiên; mã khác hiện câu tiếng Việt
 * của BE (`serverErrorMessage`).
 */

import { serverErrorMessage } from "@/lib/api/error-message";
import { SALES_OWNER_ERROR_MESSAGES } from "@/lib/references/sales-owner";

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
  ...SALES_OWNER_ERROR_MESSAGES,
  CONFLICT: "Yêu cầu vừa được quyết định, đã tải lại.",
  FORBIDDEN: "Chỉ Sales Manager hoặc quản trị viên quyết yêu cầu đổi Sale.",
};

const TRANSFER_MESSAGES: Readonly<Record<string, string>> = {
  ...SALES_OWNER_ERROR_MESSAGES,
  SALES_OWNER_NOT_ASSIGNABLE: "Có Sale nhận không còn làm. Bỏ người đó khỏi danh sách nhận.",
  IDEMPOTENT_REQUEST_IN_PROGRESS:
    "Lô này đang chạy. Chờ một chút rồi bấm lại — không bị chuyển hai lần.",
};

export const coverErrorMessage = (e: unknown) => serverErrorMessage(e, COVER_MESSAGES);
export const leadErrorMessage = (e: unknown) => serverErrorMessage(e, LEAD_MESSAGES);
export const requestErrorMessage = (e: unknown) => serverErrorMessage(e, REQUEST_MESSAGES);
export const transferErrorMessage = (e: unknown) => serverErrorMessage(e, TRANSFER_MESSAGES);
export const settingsErrorMessage = (e: unknown) =>
  serverErrorMessage(e, SALES_OWNER_ERROR_MESSAGES);

/** Lý do BE bỏ qua một khách trong lô (BR-S09); mã lạ hiện nguyên văn. */
export const SKIP_REASON_LABELS: Readonly<Record<string, string>> = {
  OWNER_CHANGED: "Khách vừa được đổi người phụ trách trong lúc chuyển",
  NOT_OWNED_BY_SOURCE: "Khách không còn thuộc Sale này",
  CUSTOMER_NOT_FOUND: "Không tìm thấy khách",
  REASSIGNED_SINCE: "Khách đã được chuyển tiếp cho người khác",
};
