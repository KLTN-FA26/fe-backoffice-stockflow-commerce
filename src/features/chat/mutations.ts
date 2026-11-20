/**
 * Chat — mutations. Mọi thao tác → tải lại `chatKeys.all` (hộp thư + hội thoại + tin). Tạo báo giá từ thẻ
 * (`CREATE_QUOTE`) còn tạo báo giá nháp → thêm root `quotes`. Toast lỗi do màn hình (message BE tiếng Việt).
 */

import { useQueryClient } from "@tanstack/react-query";

import { fileTooLargeMessage } from "@/constants/upload-limits";
import { isStaleApiError, serverErrorMessage } from "@/lib/api/error-message";
import { QUERY_ROOTS } from "@/lib/api/query-roots";
import { createMutation } from "@/lib/api/query-factory";

import {
  changeStatus,
  claimConversation,
  markRead,
  openConversation,
  sendAttachment,
  sendNote,
  sendText,
  sendTransferDetails,
  staffCardAction,
} from "./api";
import {
  assignConversation,
  attachContext,
  createCannedResponse,
  deleteCannedResponse,
  previewCannedResponse,
  updateCannedResponse,
} from "./api-tools";
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
/** Sale mở hội thoại với khách → tải lại hộp thư; màn gọi dùng `data.id` để chuyển tới hội thoại. */
export const useOpenConversation = createMutation(openConversation, base);

const cannedBase = { invalidate: [chatKeys.cannedAll()], showErrorToast: false } as const;
export const useCreateCannedResponse = createMutation(createCannedResponse, {
  ...cannedBase,
  successMessage: "Đã thêm câu trả lời mẫu.",
});
export const useUpdateCannedResponse = createMutation(updateCannedResponse, {
  ...cannedBase,
  successMessage: "Đã lưu câu trả lời mẫu.",
});
export const useDeleteCannedResponse = createMutation(deleteCannedResponse, {
  ...cannedBase,
  successMessage: "Đã xoá câu trả lời mẫu.",
});

/** Chỉ đọc câu mẫu đã điền biến (BE không đổi gì) → không tải lại gì. */
export const usePreviewCanned = createMutation(previewCannedResponse, {
  invalidate: [],
  showErrorToast: false,
});

/**
 * WF-02: lỗi chat của BE đã là tiếng Việt (PR #365) → hiện nguyên văn. 413 (BFF hoặc BE) chỉ đến từ file đính kèm →
 * nói rõ giới hạn thay cho câu chung "Không thể hoàn tất yêu cầu." của BFF.
 */
export function chatErrorMessage(error: unknown): string {
  return serverErrorMessage(error, {
    PAYLOAD_TOO_LARGE: fileTooLargeMessage("chatAttachment"),
    CHAT_NOT_ASSIGNEE: "Chỉ người phụ trách hội thoại hoặc người giám sát chat làm được việc này.",
  });
}

/** Lỗi cho biết hội thoại đã đổi người phụ trách → tải lại hội thoại (ngoài các mã chung OPTIMISTIC_LOCK, CONFLICT…). */
export const CHAT_RELOAD_CODES = ["CHAT_NOT_ASSIGNEE"] as const;

/** Lỗi của một thao tác chat → câu hiện cho người dùng; đồng thời tải lại hội thoại khi dữ liệu đã cũ. */
export function useChatFailure(): (error: unknown) => string {
  const queryClient = useQueryClient();
  return (error) => {
    if (isStaleApiError(error, CHAT_RELOAD_CODES)) {
      void queryClient.invalidateQueries({ queryKey: chatKeys.all });
    }
    return chatErrorMessage(error);
  };
}
