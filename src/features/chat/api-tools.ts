/**
 * Chat phía nhân viên — công cụ quanh hội thoại (BE `StaffChatController`, `StaffChatActionsController`,
 * `CannedResponseController`, origin/develop 438fe6fb; plan WF-02 Phụ lục B §B.3): giao / chuyển (S11, S15),
 * gắn chứng từ (S13), tìm kiếm (S21), số chưa đọc (S22), câu trả lời mẫu (S23, S24). Parse tại biên.
 */

import { api } from "@/lib/api/client";

import {
  cannedPreviewSchema,
  cannedResponseSchema,
  chatAgentsReportSchema,
  cannedResponseListSchema,
  chatAgentListSchema,
  chatStaffListSchema,
  chatConversationSchema,
  chatSearchPageSchema,
  chatStaffUnreadSchema,
} from "./schemas";

import type { ChatAttachableContext } from "@/constants";

const conv = (id: string, suffix = "") => `/chat/conversations/${encodeURIComponent(id)}${suffix}`;

/** S15: người trả lời khách được, đang trực tuyến trước rồi theo tên. */
export async function listAgents(signal?: AbortSignal) {
  const { data } = await api.get<unknown>("/chat/agents", { signal });
  return chatAgentListSchema.parse(data);
}

/** BE-11: đồng nghiệp để @nhắc trong ghi chú nội bộ; BE lọc theo tên (không phân biệt hoa thường, dấu). */
export async function listStaff(q: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>("/chat/staff", { params: { q, limit: 20 }, signal });
  return chatStaffListSchema.parse(data);
}

/**
 * S11: giao (giám sát, hội thoại chưa ai nhận) hoặc chuyển (người phụ trách / giám sát). BE từ chối:
 * `CHAT_AGENT_NOT_AVAILABLE`, `CHAT_NOT_ASSIGNEE`, `CHAT_CONVERSATION_ENDED`, `VALIDATION_FAILED` (đã là của họ).
 */
export async function assignConversation(input: { id: string; agentId: string; note?: string }) {
  const { data } = await api.post<unknown>(conv(input.id, "/assignment"), {
    agentId: input.agentId,
    ...(input.note ? { note: input.note } : {}),
  });
  return chatConversationSchema.parse(data);
}

/** S13: gắn chứng từ của chính khách (16 BR-02; bản nháp được). Gắn lại cái đã có = không đổi gì. */
export async function attachContext(input: {
  id: string;
  kind: ChatAttachableContext;
  refId: string;
}) {
  const { data } = await api.post<unknown>(conv(input.id, "/contexts"), {
    kind: input.kind,
    id: input.refId,
  });
  return chatConversationSchema.parse(data);
}

/** S21: tìm trong tin nhắn (bỏ dấu, khớp một phần; gồm ghi chú nội bộ). Trang 0-based. */
export async function searchMessages(
  params: { q: string; page?: number; size?: number },
  signal?: AbortSignal,
) {
  const { data } = await api.get<unknown>("/chat/search", {
    params: { q: params.q, page: Math.max(0, params.page ?? 0), size: params.size ?? 20 },
    signal,
  });
  return chatSearchPageSchema.parse(data);
}

/** S22: tin chưa đọc trong hội thoại giao cho mình, và số hội thoại NEW / QUEUED chờ nhận. */
export async function getStaffUnread(signal?: AbortSignal) {
  const { data } = await api.get<unknown>("/chat/unread-count", { signal });
  return chatStaffUnreadSchema.parse(data);
}

const CANNED = "/chat/canned-responses";

/** S24: câu trả lời mẫu (dùng chung trước); `q` tìm tiêu đề, nội dung, phím tắt; `category` lọc nhóm. */
export async function listCannedResponses(
  filter: { q?: string; category?: string } = {},
  signal?: AbortSignal,
) {
  const params: Record<string, string> = {};
  if (filter.q) params.q = filter.q;
  if (filter.category) params.category = filter.category;
  const { data } = await api.get<unknown>(CANNED, { params, signal });
  return cannedResponseListSchema.parse(data);
}

/** Nội dung ghi một câu mẫu (BE `ChatRequests.CannedResponse`); `version` = bản đã đọc, khi sửa. */
export interface CannedResponseDraft {
  title: string;
  body: string;
  shortcut?: string;
  category?: string;
  shared?: boolean;
  version?: number;
}

export async function createCannedResponse(draft: CannedResponseDraft) {
  const { data } = await api.post<unknown>(CANNED, draft);
  return cannedResponseSchema.parse(data);
}

export async function updateCannedResponse(input: { id: string } & CannedResponseDraft) {
  const { id, ...draft } = input;
  const { data } = await api.put<unknown>(`${CANNED}/${encodeURIComponent(id)}`, draft);
  return cannedResponseSchema.parse(data);
}

/** BE lưu trữ (không xoá hẳn), phím tắt được dùng lại. */
export async function deleteCannedResponse(input: { id: string }) {
  await api.delete<unknown>(`${CANNED}/${encodeURIComponent(input.id)}`);
}

/** Báo cáo theo Sale (`chat-supervision:READ`): hội thoại mở trong `from`..`to` (ngày, gồm cả hai đầu, tối đa 366). */
export async function getAgentsReport(
  params: { from: string; to: string; agentId?: string },
  signal?: AbortSignal,
) {
  const { data } = await api.get<unknown>("/chat/reports/agents", {
    params: {
      from: params.from,
      to: params.to,
      ...(params.agentId ? { agentId: params.agentId } : {}),
    },
    signal,
  });
  return chatAgentsReportSchema.parse(data);
}

/** S23: câu mẫu đã điền biến theo hội thoại này, để Sale xem và sửa trước khi gửi. */
export async function previewCannedResponse(input: { id: string; cannedResponseId: string }) {
  const { data } = await api.get<unknown>(
    conv(input.id, `/canned-responses/${encodeURIComponent(input.cannedResponseId)}/preview`),
  );
  return cannedPreviewSchema.parse(data);
}
