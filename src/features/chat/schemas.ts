/**
 * Chat phía nhân viên — DTO BE (origin/develop 438fe6fb, `chat/internal/service/ChatConversationView.java`,
 * `ChatMessageView.java`, `ChatCustomerOverview.java`). Jackson `non_null` → trường null bị BỎ → `.nullish()`.
 * Payload thẻ là JSON theo `kind` — đọc lỏng (passthrough), component tự narrow từng khoá.
 */

import { z } from "zod";

import { CHAT_CONVERSATION_STATUSES } from "@/constants";

import { bePageSchema } from "@/lib/api/page-schema";
import { omittedOrNull } from "@/lib/validation/primitives";

export const chatCardSchema = z.object({
  kind: z.string(),
  state: z.string(),
  payload: z.record(z.string(), z.unknown()).nullish(),
  updatedAt: omittedOrNull(z.string()),
  customerActions: z.array(z.string()).default([]),
  /** Nút back-office vẽ ĐÚNG danh sách này (vd `CREATE_QUOTE`). */
  staffActions: z.array(z.string()).default([]),
});

export const chatAttachmentSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  seq: z.number().int(),
  kind: z.string(),
  /** `STAFF` = ghi chú nội bộ (khách không thấy). */
  visibility: z.string(),
  senderType: z.string(),
  senderId: omittedOrNull(z.string()),
  senderName: omittedOrNull(z.string()),
  body: omittedOrNull(z.string()),
  clientMessageId: omittedOrNull(z.string()),
  contextId: omittedOrNull(z.string()),
  card: omittedOrNull(chatCardSchema),
  attachments: z.array(chatAttachmentSchema).default([]),
  sentAt: z.string(),
  editedAt: omittedOrNull(z.string()),
  deleted: z.boolean().default(false),
});

export const chatContextSchema = z.object({
  id: z.string(),
  kind: z.string(),
  refId: z.string(),
  primary: z.boolean().default(false),
  label: omittedOrNull(z.string()),
  status: omittedOrNull(z.string()),
});

const statusSchema = z.enum(CHAT_CONVERSATION_STATUSES);

export const chatConversationSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  customerName: omittedOrNull(z.string()),
  subject: omittedOrNull(z.string()),
  status: statusSchema,
  /** Chỉ nhân viên: các bước người gọi được chuyển lúc này (đọc lại chi tiết trước khi vẽ nút). */
  nextStatuses: z.array(statusSchema).default([]),
  assignedAgentId: omittedOrNull(z.string()),
  assignedAgentName: omittedOrNull(z.string()),
  firstResponseOverdue: z.boolean().default(false),
  resolutionOverdue: z.boolean().default(false),
  createdAt: z.string(),
  lastMessageAt: omittedOrNull(z.string()),
  lastSeq: z.number().int().default(0),
  unread: z.number().int().default(0),
  lastMessage: omittedOrNull(chatMessageSchema),
  contexts: z.array(chatContextSchema).default([]),
});
export const chatConversationPageSchema = bePageSchema(chatConversationSchema);

export const chatMessagePageSchema = z.object({
  items: z.array(chatMessageSchema),
  nextBefore: omittedOrNull(z.number().int()),
  nextSince: omittedOrNull(z.number().int()),
  lastSeq: z.number().int().default(0),
});

const customerDocumentSchema = z.object({
  id: z.string(),
  number: omittedOrNull(z.string()),
  status: omittedOrNull(z.string()),
  amount: omittedOrNull(z.number()),
  currency: omittedOrNull(z.string()),
});

export const chatCustomerOverviewSchema = z.object({
  customerId: z.string(),
  code: omittedOrNull(z.string()),
  name: omittedOrNull(z.string()),
  email: omittedOrNull(z.string()),
  phone: omittedOrNull(z.string()),
  status: omittedOrNull(z.string()),
  orders: z.array(customerDocumentSchema).default([]),
  quotes: z.array(customerDocumentSchema).default([]),
  contracts: z.array(customerDocumentSchema).default([]),
  productionOrders: z.array(customerDocumentSchema).default([]),
  /** Bản thiết kế của khách (`ChatCustomerOverview.designs`): gắn vào hội thoại được (S13). */
  designs: z
    .array(
      z.object({
        id: z.string(),
        name: omittedOrNull(z.string()),
        status: omittedOrNull(z.string()),
      }),
    )
    .default([]),
  /** Đợt còn nợ — `id` là thứ S18 (thẻ chuyển khoản) nhận. */
  installments: z
    .array(
      z.object({
        id: z.string(),
        contractNumber: omittedOrNull(z.string()),
        orderNumber: omittedOrNull(z.string()),
        seq: z.number().int(),
        name: z.string(),
        amount: z.number(),
        paidAmount: z.number().default(0),
        currency: z.string().default("VND"),
        dueDate: omittedOrNull(z.string()),
        status: z.string(),
        overdue: z.boolean().default(false),
      }),
    )
    .default([]),
});

export const downloadLinkSchema = z.object({
  url: z.string(),
  expiresAt: omittedOrNull(z.string()),
});

/** S15 `ChatAgentView`: người trả lời khách, đang trực tuyến trước. */
export const chatAgentSchema = z.object({
  userId: z.string(),
  name: z.string(),
  online: z.boolean().default(false),
});
export const chatAgentListSchema = z.array(chatAgentSchema);

/** S21 `ChatSearch.Hit`: tin tìm thấy (gồm ghi chú nội bộ) kèm hội thoại chứa nó. */
export const chatSearchHitSchema = z.object({
  message: chatMessageSchema,
  conversationId: z.string(),
  customerId: z.string(),
  customerName: omittedOrNull(z.string()),
  subject: omittedOrNull(z.string()),
  conversationStatus: statusSchema,
});
export const chatSearchPageSchema = bePageSchema(chatSearchHitSchema);

/** S22 `StaffUnread`: tin chưa đọc ở hội thoại giao cho mình + số hội thoại chờ nhận. */
export const chatStaffUnreadSchema = z.object({
  conversations: z.number().int().default(0),
  messages: z.number().int().default(0),
  queued: z.number().int().default(0),
});

/** S24 `CannedResponses.View`: câu trả lời mẫu, mẫu dùng chung trước. */
export const cannedResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  shortcut: omittedOrNull(z.string()),
  category: omittedOrNull(z.string()),
  shared: z.boolean().default(false),
});
export const cannedResponseListSchema = z.array(cannedResponseSchema);

/** S23 `CannedResponses.Rendered`: câu mẫu đã điền biến của hội thoại ({customerName}, {quoteCode}…). */
export const cannedPreviewSchema = z.object({
  cannedResponseId: z.string(),
  conversationId: z.string(),
  text: z.string(),
});

export type ChatCard = z.infer<typeof chatCardSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatConversation = z.infer<typeof chatConversationSchema>;
export type ChatMessagePage = z.infer<typeof chatMessagePageSchema>;
export type ChatCustomerOverview = z.infer<typeof chatCustomerOverviewSchema>;
export type ChatAgent = z.infer<typeof chatAgentSchema>;
export type ChatSearchHit = z.infer<typeof chatSearchHitSchema>;
export type ChatStaffUnread = z.infer<typeof chatStaffUnreadSchema>;
export type CannedResponse = z.infer<typeof cannedResponseSchema>;
