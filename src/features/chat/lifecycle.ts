/**
 * Vòng đời hội thoại — chép bảng BE `ConversationStatus` (docs 16 §5, origin/develop 438fe6fb). Nút đổi trạng thái
 * vẽ theo `nextStatuses` BE tính cho người gọi (đọc ở chi tiết), không tự suy. UI-only — Backend phải re-check
 * (chat-conversations:UPDATE, CHAT_NOT_ASSIGNEE, CHAT_TRANSITION_NOT_ALLOWED).
 */

import { CHAT_ENDED_STATUSES, CHAT_PERMISSIONS } from "@/constants";

import type { ChatConversationStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ChatConversation } from "./schemas";

export const CONVERSATION_TRANSITIONS: Readonly<
  Record<ChatConversationStatus, readonly ChatConversationStatus[]>
> = {
  NEW: ["QUEUED", "ASSIGNED"],
  QUEUED: ["ASSIGNED"],
  ASSIGNED: ["ACTIVE"],
  ACTIVE: ["WAITING_ON_CUSTOMER", "WAITING_ON_INTERNAL", "ESCALATED", "RESOLVED"],
  WAITING_ON_CUSTOMER: ["ACTIVE", "AUTO_CLOSED"],
  WAITING_ON_INTERNAL: ["ACTIVE"],
  ESCALATED: ["ACTIVE", "RESOLVED"],
  RESOLVED: ["REOPENED", "CLOSED"],
  REOPENED: ["ACTIVE"],
  AUTO_CLOSED: ["REOPENED", "CLOSED"],
  CLOSED: [],
};

/** S12: chỉ các đích này được đổi bằng tay. */
const MANUAL_TARGETS: readonly ChatConversationStatus[] = [
  "ACTIVE",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_INTERNAL",
  "ESCALATED",
  "RESOLVED",
];

export function isEnded(status: ChatConversationStatus): boolean {
  return (CHAT_ENDED_STATUSES as readonly string[]).includes(status);
}

export interface StaffConversationActions {
  claim: boolean;
  reply: boolean;
  note: boolean;
  moves: ChatConversationStatus[];
}

export function staffConversationActions(
  conversation: Pick<ChatConversation, "status" | "nextStatuses">,
  can: (code: PermissionCode) => boolean,
): StaffConversationActions {
  const update = can(CHAT_PERMISSIONS.update);
  return {
    claim: update && (conversation.status === "NEW" || conversation.status === "QUEUED"),
    reply: update && !isEnded(conversation.status),
    // 16 BR-07: mọi nhân viên ghi chú nội bộ được bất kỳ lúc nào.
    note: update,
    moves: update
      ? conversation.nextStatuses.filter((status) => MANUAL_TARGETS.includes(status))
      : [],
  };
}

export interface StaffConversationTools {
  /** Phân công hội thoại chưa ai nhận: chỉ người giám sát (S11, `Conversation.handTo`). */
  assign: boolean;
  /** Chuyển cho Sale khác: người phụ trách hoặc giám sát — BE kiểm `CHAT_NOT_ASSIGNEE`. */
  transfer: boolean;
  /** Gắn chứng từ của khách (S13): không kiểm người phụ trách, hội thoại đã đóng vẫn gắn được. */
  attach: boolean;
  /** Chèn câu trả lời mẫu vào ô trả lời khách (S23, S24). */
  canned: boolean;
}

/** Công cụ quanh hội thoại — UI-only, BE kiểm lại từng lệnh. */
export function staffConversationTools(
  conversation: Pick<ChatConversation, "status" | "assignedAgentId">,
  can: (code: PermissionCode) => boolean,
): StaffConversationTools {
  const update = can(CHAT_PERMISSIONS.update);
  const open = !isEnded(conversation.status);
  const assigned = !!conversation.assignedAgentId;
  return {
    assign: update && open && !assigned && can(CHAT_PERMISSIONS.supervise),
    transfer: update && open && assigned,
    attach: update,
    canned: update && open && can(CHAT_PERMISSIONS.cannedRead),
  };
}
