/**
 * Chat phía nhân viên — API layer (BE `StaffChatController`, `StaffChatActionsController`, `/api/v1/chat`,
 * origin/develop 438fe6fb). Phân trang 0-based. Parse tại biên.
 */

import { api } from "@/lib/api/client";

import {
  chatConversationPageSchema,
  chatConversationSchema,
  chatCustomerOverviewSchema,
  chatMessagePageSchema,
  chatMessageSchema,
  downloadLinkSchema,
} from "./schemas";

import type { ChatConversationStatus, ChatInboxScope } from "@/constants";

const CONVERSATIONS = "/chat/conversations";
const conv = (id: string, suffix = "") => `${CONVERSATIONS}/${encodeURIComponent(id)}${suffix}`;

export interface InboxParams {
  scope: ChatInboxScope;
  status?: ChatConversationStatus[];
  page?: number;
  size?: number;
}

/** S1: hộp thư. `status` trống = mọi trạng thái trừ đã kết thúc (BE `InboxFilter`). */
export async function listConversations(params: InboxParams, signal?: AbortSignal) {
  const query = new URLSearchParams({
    page: String(Math.max(0, params.page ?? 0)),
    size: String(params.size ?? 20),
  });
  for (const status of params.status ?? []) query.append("status", status);
  if (params.scope !== "all") query.set(params.scope, "true");
  const { data } = await api.get<unknown>(CONVERSATIONS, { params: query, signal });
  return chatConversationPageSchema.parse(data);
}

export async function getConversation(id: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(conv(id), { signal });
  return chatConversationSchema.parse(data);
}

/** S4: tin nhắn (gồm ghi chú nội bộ). `before` = trang cũ hơn (mới nhất trước). */
export async function listMessages(id: string, before?: number, signal?: AbortSignal) {
  const params: Record<string, string> = { limit: "50" };
  if (before != null) params.before = String(before);
  const { data } = await api.get<unknown>(conv(id, "/messages"), { params, signal });
  return chatMessagePageSchema.parse(data);
}

const parseMessage = (data: unknown) => chatMessageSchema.parse(data);
const parseConversation = (data: unknown) => chatConversationSchema.parse(data);

/** S5: trả lời khách. `clientMessageId` chống gửi trùng khi bấm lại. */
export async function sendText(input: { id: string; text: string; clientMessageId: string }) {
  const { data } = await api.post<unknown>(conv(input.id, "/messages"), {
    text: input.text,
    clientMessageId: input.clientMessageId,
  });
  return parseMessage(data);
}

/** S6: ghi chú nội bộ (16 BR-07) — khách không bao giờ thấy. */
export async function sendNote(input: { id: string; text: string; clientMessageId: string }) {
  const { data } = await api.post<unknown>(conv(input.id, "/notes"), {
    text: input.text,
    clientMessageId: input.clientMessageId,
  });
  return parseMessage(data);
}

/** S7: gửi file (JPEG/PNG/WebP/PDF ≤ 20 MB), multipart `file` + `caption?` + `clientMessageId?`. */
export async function sendAttachment(input: {
  id: string;
  file: File;
  caption?: string;
  clientMessageId: string;
}) {
  const form = new FormData();
  form.append("file", input.file);
  if (input.caption) form.append("caption", input.caption);
  form.append("clientMessageId", input.clientMessageId);
  const { data } = await api.post<unknown>(conv(input.id, "/attachments"), form);
  return parseMessage(data);
}

export async function attachmentLink(id: string, attachmentId: string) {
  const { data } = await api.get<unknown>(
    conv(id, `/attachments/${encodeURIComponent(attachmentId)}/link`),
  );
  return downloadLinkSchema.parse(data);
}

export async function markRead(input: { id: string; seq?: number }) {
  await api.post<unknown>(conv(input.id, "/read"), input.seq != null ? { seq: input.seq } : {});
}

/** S10: nhận hội thoại (NEW / QUEUED → ASSIGNED). */
export async function claimConversation(input: { id: string }) {
  const { data } = await api.post<unknown>(conv(input.id, "/claim"));
  return parseConversation(data);
}

/** S12: đổi trạng thái theo `nextStatuses`; ESCALATED cần lý do. */
export async function changeStatus(input: {
  id: string;
  status: ChatConversationStatus;
  reason?: string;
}) {
  const { data } = await api.post<unknown>(conv(input.id, "/status"), {
    status: input.status,
    ...(input.reason ? { reason: input.reason } : {}),
  });
  return parseConversation(data);
}

/** S17: hành động của Sale trên thẻ — chỉ `CREATE_QUOTE` có nghĩa; trả thẻ đã ACTED kèm `payload.quoteId`. */
export async function staffCardAction(input: { id: string; messageId: string; action: string }) {
  const { data } = await api.post<unknown>(
    conv(input.id, `/cards/${encodeURIComponent(input.messageId)}/actions`),
    {
      action: input.action,
    },
  );
  return parseMessage(data);
}

/** S18: thẻ thông tin chuyển khoản (BR-06) — `reminder` = thẻ nhắc thanh toán. */
export async function sendTransferDetails(input: {
  id: string;
  installmentId: string;
  reminder: boolean;
}) {
  const { data } = await api.post<unknown>(conv(input.id, "/cards/transfer-details"), {
    installmentId: input.installmentId,
    reminder: input.reminder,
  });
  return parseMessage(data);
}

/** S16: hồ sơ khách + chứng từ. */
export async function getCustomerOverview(customerId: string, signal?: AbortSignal) {
  const { data } = await api.get<unknown>(
    `/chat/customers/${encodeURIComponent(customerId)}/overview`,
    { signal },
  );
  return chatCustomerOverviewSchema.parse(data);
}
