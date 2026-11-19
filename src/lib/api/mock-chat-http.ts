/**
 * Lỗi + cổng chung của mock chat Sale (WF-02, chỉ USE_MOCK=true). Mã lỗi / HTTP theo `common/error/ErrorCode.java`, câu
 * tiếng Việt chép `i18n/messages_vi.properties` (`error.*`, `refusal.chat.*`) của BE origin/develop. Cổng quyền thay
 * `@RequiresPermission`; "phụ trách" = người được giao hoặc người giám sát (`Conversation.requireInCharge`).
 */

import { CHAT_PERMISSIONS } from "@/constants";

import { chatCaller, chatState, isEndedStatus } from "./mock-chat-store";
import { fail, isUuidText, pathParams } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { MockConversation } from "./mock-chat-seed";
import type { ChatCaller } from "./mock-chat-store";
import type { MockResponseShape } from "./mock-route-utils";

/** `error.<CODE>` của bundle tiếng Việt. */
const MESSAGES = {
  VALIDATION_FAILED: [400, "Dữ liệu không hợp lệ"],
  MALFORMED_REQUEST: [400, "Không đọc được nội dung yêu cầu"],
  UNSUPPORTED_PARAMETER: [400, "Giá trị tham số không được hỗ trợ"],
  UNAUTHORIZED: [401, "Bạn chưa đăng nhập"],
  FORBIDDEN: [403, "Bạn không có quyền thực hiện thao tác này"],
  CUSTOMER_NOT_FOUND: [404, "Không tìm thấy khách hàng"],
  CHAT_CONVERSATION_NOT_FOUND: [404, "Không tìm thấy hội thoại"],
  CHAT_CONTEXT_NOT_FOUND: [404, "Không tìm thấy chứng từ cần trao đổi"],
  CHAT_MESSAGE_NOT_FOUND: [404, "Không tìm thấy tin nhắn"],
  CHAT_CANNED_RESPONSE_NOT_FOUND: [404, "Không tìm thấy câu trả lời mẫu"],
  CHAT_TRANSITION_NOT_ALLOWED: [409, "Hội thoại không chuyển được sang trạng thái này lúc này"],
  CHAT_CONVERSATION_ENDED: [409, "Hội thoại đã kết thúc; hãy bắt đầu hội thoại mới"],
  CHAT_NOT_ASSIGNEE: [409, "Chỉ nhân viên đang phụ trách hội thoại mới làm được việc này"],
  CHAT_ALREADY_ASSIGNED: [409, "Hội thoại đã có nhân viên khác phụ trách"],
  CHAT_AGENT_NOT_AVAILABLE: [409, "Người này không nhận hội thoại chat"],
  CHAT_CLIENT_MESSAGE_ID_REUSED: [409, "Mã tin nhắn phía máy khách đã dùng cho một tin nhắn khác"],
  CHAT_CARD_ACTION_NOT_ALLOWED: [409, "Thao tác này không dùng được trên thẻ này"],
  CHAT_DESIGN_NOT_APPROVED: [409, "Bản thiết kế chưa được duyệt; báo giá chỉ lập sau khi duyệt"],
  PAYLOAD_TOO_LARGE: [413, "Tệp quá lớn"],
  UNSUPPORTED_MEDIA_TYPE: [415, "Định dạng tệp không được chấp nhận"],
} as const satisfies Record<string, readonly [number, string]>;

export type ChatErrorCode = keyof typeof MESSAGES;

/** Lỗi theo mã; `message` = câu riêng của lệnh từ chối (`refusal.chat.*`) khi có, không thì câu của mã. */
export function chatError(code: ChatErrorCode, message?: string): MockResponseShape {
  const [status, fallback] = MESSAGES[code];
  return fail(status, code, message ?? fallback);
}

/** `refusal.chat.*` dùng trong mock. */
export const REFUSAL = {
  messageEmpty: "Tin nhắn không được để trống.",
  messageTooLong: (max: number) => `Tin nhắn dài tối đa ${max} ký tự.`,
  transferCardOnly: "Không gõ số tài khoản vào tin nhắn: hãy gửi thẻ thông tin chuyển khoản.",
  alreadyTheirs: "Hội thoại đã do người này phụ trách.",
  supervisorAssigns:
    "Chỉ người giám sát chat mới phân công hội thoại; bạn có thể tự nhận hội thoại.",
  notByHand: (status: string) => `Không chuyển hội thoại sang trạng thái ${status} bằng tay.`,
  notAMove: (from: string, to: string) => `Hội thoại không chuyển được từ ${from} sang ${to}.`,
  escalatedSupervisor: "Hội thoại đã chuyển cấp do người giám sát chat xử lý tiếp.",
  escalationReason: "Hãy ghi lý do chuyển cấp hội thoại.",
  searchLength: "Từ khoá tìm kiếm dài 2–200 ký tự.",
  contextIncomplete: "Chứng từ gắn kèm cần có loại và mã.",
  mentionsMax: (max: number) => `Ghi chú nhắc tên tối đa ${max} người.`,
  mentionStaffOnly: "Ghi chú chỉ nhắc tên nhân viên.",
  attachmentFile: "Tin nhắn đính kèm phải có file.",
  customerAction: "Thao tác này do khách hàng thực hiện trên thẻ; nhân viên không làm thay.",
  nothingOwed: (ref: string) => `Đợt thanh toán ${ref} không còn phải thu.`,
} as const;

export interface ChatRequest {
  caller: ChatCaller;
  params: Record<string, string>;
}

/**
 * Cổng của mọi route nhân viên: đăng nhập (401), mã quyền (403), tham số UUID của đường dẫn (400). Trả lỗi hoặc người
 * gọi đã xác định.
 */
export async function guard(
  config: AxiosRequestConfig,
  permission: string,
  uuidParams: readonly string[] = [],
): Promise<MockResponseShape | ChatRequest> {
  const caller = await chatCaller();
  if (!caller) return chatError("UNAUTHORIZED");
  if (!caller.can(permission)) return chatError("FORBIDDEN");
  const params = pathParams(config);
  if (uuidParams.some((name) => !isUuidText(params[name] ?? "")))
    return chatError("UNSUPPORTED_PARAMETER");
  return { caller, params };
}

export const isError = (value: MockResponseShape | ChatRequest): value is MockResponseShape =>
  "status" in value;

export function findConversation(id: string): MockConversation | undefined {
  return chatState().conversations.find((c) => c.id === id);
}

/** `Conversation.requireInCharge(agent, evenIfEnded=false)`: kết thúc → ENDED; không phụ trách → NOT_ASSIGNEE. */
export function inChargeError(c: MockConversation, caller: ChatCaller): MockResponseShape | null {
  if (isEndedStatus(c.status)) return chatError("CHAT_CONVERSATION_ENDED");
  if (!caller.supervisor && c.assignedAgentId !== caller.id) return chatError("CHAT_NOT_ASSIGNEE");
  return null;
}

/** Tin của Sale (`acceptAgentMessage`): ASSIGNED / REOPENED → ACTIVE; tin đầu tiên dừng đồng hồ phản hồi (BR-09). */
export function acceptAgentMessage(c: MockConversation, now: number) {
  if (c.status === "ASSIGNED" || c.status === "REOPENED") c.status = "ACTIVE";
  if (c.firstRespondedAt === null) c.firstRespondedAt = new Date(now).toISOString();
}

const PAGE_MAX = 100;

/** `ChatProperties.pageSize`: thiếu → mặc định, ngoài 1..100 → kẹp lại (chat không từ chối). */
export function clampSize(raw: string | null, fallback: number): number {
  const value = Number(raw ?? "");
  if (!raw || !Number.isFinite(value)) return fallback;
  return Math.min(PAGE_MAX, Math.max(1, Math.trunc(value)));
}

/** Trang 0-based; số âm / không đọc được → 0. */
export const pageIndex = (raw: string | null) => Math.max(0, Math.trunc(Number(raw ?? 0)) || 0);

export const UPDATE = CHAT_PERMISSIONS.update;
export const READ = CHAT_PERMISSIONS.read;
export const CANNED_READ = CHAT_PERMISSIONS.cannedRead;
