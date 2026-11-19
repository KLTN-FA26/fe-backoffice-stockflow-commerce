/**
 * Chat — mutations. Mọi thao tác → tải lại `chatKeys.all` (hộp thư + hội thoại + tin). Tạo báo giá từ thẻ
 * (`CREATE_QUOTE`) còn tạo báo giá nháp → thêm root `quotes`. Toast lỗi do màn hình (message BE tiếng Việt).
 */

import { serverErrorMessage } from "@/lib/api/error-message";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";

import {
  changeStatus,
  claimConversation,
  markRead,
  sendAttachment,
  sendNote,
  sendText,
  sendTransferDetails,
  staffCardAction,
} from "./api";
import { assignConversation, attachContext, previewCannedResponse } from "./api-tools";
import { chatKeys } from "./queries";

const base = { invalidate: [chatKeys.all], showErrorToast: false } as const;

export const useSendText = createMutation(sendText, base);
export const useSendNote = createMutation(sendNote, base);
export const useSendAttachment = createMutation(sendAttachment, base);
export const useMarkRead = createMutation(markRead, base);
export const useClaimConversation = createMutation(claimConversation, {
  ...base,
  successMessage: "Đã nhận hội thoại.",
});
export const useChangeStatus = createMutation(changeStatus, {
  ...base,
  successMessage: "Đã đổi trạng thái hội thoại.",
});
export const useStaffCardAction = createMutation(staffCardAction, {
  ...base,
  invalidate: [chatKeys.all, QUERY_ROOTS.quotes],
});
export const useSendTransferDetails = createMutation(sendTransferDetails, {
  ...base,
  successMessage: "Đã gửi thông tin chuyển khoản.",
});

export const useAssignConversation = createMutation(assignConversation, {
  ...base,
  successMessage: "Đã chuyển hội thoại.",
});
export const useAttachContext = createMutation(attachContext, {
  ...base,
  successMessage: "Đã gắn chứng từ vào hội thoại.",
});
/** Chỉ đọc câu mẫu đã điền biến (BE không đổi gì) → không tải lại gì. */
export const usePreviewCanned = createMutation(previewCannedResponse, {
  invalidate: [],
  showErrorToast: false,
});

/** WF-02: lỗi chat của BE đã là tiếng Việt (PR #365) → hiện nguyên văn. */
export function chatErrorMessage(error: unknown): string {
  return serverErrorMessage(error);
}
