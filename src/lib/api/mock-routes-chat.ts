/**
 * Mock route chat của Sale (WF-02 pha E2, chỉ USE_MOCK=true) — hợp đồng BE origin/develop `StaffChatController`
 * (S1–S12; plan WF02-FE-plan Phụ lục B §B.3), luật `Conversation` / `StaffChatService` / `ConversationWriter` /
 * `ChatReading`. Dữ liệu theo seed demo (`mock-chat-seed.ts`). Công cụ quanh hội thoại (S13–S24): `mock-chat-tools.ts`.
 */

import { registerMockRoute } from "./mock-adapter";
import { postCsatCard } from "./mock-chat-cards";
import {
  acceptAgentMessage,
  chatError,
  clampSize,
  findConversation,
  guard,
  inChargeError,
  isError,
  pageIndex,
  READ,
  REFUSAL,
  UPDATE,
} from "./mock-chat-http";
import { CHAT_COMPANY_BANK } from "./mock-chat-seed";
import {
  advanceMarker,
  CHAT_MANUAL_TARGETS,
  CHAT_MOVES,
  chatPeople,
  chatState,
  conversationView,
  isChatStatus,
  isEndedStatus,
  isOverdue,
  messagesOf,
  messageView,
  postMessage,
} from "./mock-chat-store";
import { registerChatExtraRoutes } from "./mock-chat-extras";
import { registerChatToolRoutes } from "./mock-chat-tools";
import { bodyOf, ok, pageOf, queryOf, text } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { ChatConversationStatus } from "@/constants";
import type { MockChatMessage, MockConversation } from "./mock-chat-seed";
import type { ChatCaller } from "./mock-chat-store";
import type { MockResponseShape } from "./mock-route-utils";

const CONV = "/chat/conversations/:id";
const TEXT_MAX = 4000;
const MENTIONS_MAX = 20;
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const REOPEN_WINDOW_MS = 14 * 24 * 60 * 60_000;
const LINK_TTL_MS = 10 * 60_000;

async function detail(c: MockConversation, caller: ChatCaller) {
  return ok(conversationView(c, caller, await chatPeople(), true));
}

/* ── S1 hộp thư, S3 chi tiết, S4 tin nhắn ─────────────────────────────────────────────────── */

async function inbox(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ);
  if (isError(req)) return req;
  const query = queryOf(config);
  const asked = query
    .getAll("status")
    .flatMap((s) => s.split(","))
    .filter(Boolean);
  if (!asked.every(isChatStatus)) return chatError("UNSUPPORTED_PARAMETER");
  // InboxFilter: không lọc trạng thái = mọi trạng thái trừ đã kết thúc
  const shown = (status: ChatConversationStatus) =>
    asked.length ? asked.includes(status) : !isEndedStatus(status);
  const flag = (name: string) => query.get(name) === "true";
  const customerId = query.get("customerId");
  const now = Date.now();
  const last = (c: MockConversation) => Date.parse(c.lastMessageAt ?? c.createdAt);
  const rows = chatState()
    .conversations.filter((c) => shown(c.status))
    .filter((c) => !flag("mine") || c.assignedAgentId === req.caller.id)
    .filter((c) => !flag("unassigned") || c.assignedAgentId === null)
    .filter((c) => !flag("overdue") || isOverdue(c, now))
    .filter((c) => !customerId || c.customerId === customerId)
    .sort((a, b) => Number(isOverdue(b, now)) - Number(isOverdue(a, now)) || last(b) - last(a));
  const people = await chatPeople();
  const page = pageOf(rows, pageIndex(query.get("page")), clampSize(query.get("size"), 20));
  return ok({
    ...page,
    items: page.items.map((c) => conversationView(c, req.caller, people, false, now)),
  });
}

async function getOne(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  return c ? detail(c, req.caller) : chatError("CHAT_CONVERSATION_NOT_FOUND");
}

/** `ChatReading.page`: `before` = mới nhất trước, `since` = cũ nhất trước (thắng khi có cả hai). */
async function messages(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const query = queryOf(config);
  const size = clampSize(query.get("limit"), 30);
  const since = query.get("since");
  const before = query.get("before");
  const all = messagesOf(c.id);
  const found =
    since !== null
      ? all.filter((m) => m.seq > Math.max(0, Number(since))).sort((a, b) => a.seq - b.seq)
      : all.filter((m) => before === null || m.seq < Number(before)).sort((a, b) => b.seq - a.seq);
  const page = found.slice(0, size);
  const cursor = found.length > size ? (page[page.length - 1]?.seq ?? null) : null;
  const people = await chatPeople();
  return ok({
    items: page.map((m) => messageView(m, people)),
    nextBefore: since === null ? cursor : null,
    nextSince: since !== null ? cursor : null,
    lastSeq: c.lastMessageSeq,
  });
}

/* ── S5 trả lời, S6 ghi chú, S7 file ─────────────────────────────────────────────────────── */

function textError(said: string): MockResponseShape | null {
  if (!said.trim()) return chatError("VALIDATION_FAILED", REFUSAL.messageEmpty);
  if (said.length > TEXT_MAX)
    return chatError("VALIDATION_FAILED", REFUSAL.messageTooLong(TEXT_MAX));
  return null;
}

/**
 * `ConversationWriter.post`: cùng `clientMessageId`, cùng người, cùng nội dung → trả tin đã lưu, không đổi gì; cùng id cho
 * nội dung khác → CHAT_CLIENT_MESSAGE_ID_REUSED.
 */
function replay(
  c: MockConversation,
  clientMessageId: string,
  caller: ChatCaller,
  said: string | null,
): MockChatMessage | MockResponseShape | null {
  if (!clientMessageId) return null;
  const first = messagesOf(c.id).find((m) => m.clientMessageId === clientMessageId);
  if (!first) return null;
  return first.senderId === caller.id && first.senderType === "AGENT" && first.body === said
    ? first
    : chatError("CHAT_CLIENT_MESSAGE_ID_REUSED");
}

const isMessage = (value: MockChatMessage | MockResponseShape): value is MockChatMessage =>
  "seq" in value;

/** Dòng ngữ cảnh `contextId` phải là của hội thoại này. */
function contextError(c: MockConversation, contextId: string): MockResponseShape | null {
  if (!contextId) return null;
  const mine = chatState().contexts.some((x) => x.conversationId === c.id && x.id === contextId);
  return mine ? null : chatError("CHAT_CONTEXT_NOT_FOUND");
}

/** 16 BR-06: tin gõ tay có số tài khoản công ty bị từ chối — gửi thẻ chuyển khoản (S18) thay vào. */
function typedAccount(said: string): boolean {
  const account = CHAT_COMPANY_BANK.accountNumber.replace(/\s/g, "");
  return account.length >= 6 && said.replace(/[\s.-]/g, "").includes(account);
}

async function reply(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const body = bodyOf(config);
  const said = typeof body.text === "string" ? body.text : "";
  if (typedAccount(said)) return chatError("VALIDATION_FAILED", REFUSAL.transferCardOnly);
  const contextId = text(body.contextId);
  const wrongContext = contextError(c, contextId);
  if (wrongContext) return wrongContext;
  const again = replay(c, text(body.clientMessageId), req.caller, said);
  if (again) return isMessage(again) ? ok(messageView(again, await chatPeople()), 201) : again;
  const refused = inChargeError(c, req.caller) ?? textError(said);
  if (refused) return refused;
  const now = Date.now();
  acceptAgentMessage(c, now);
  const posted = postMessage(
    c,
    {
      kind: "TEXT",
      visibility: "CUSTOMER",
      senderType: "AGENT",
      senderId: req.caller.id,
      body: said,
      clientMessageId: text(body.clientMessageId) || null,
      contextId: contextId || null,
      card: null,
      attachments: [],
      mentions: [],
    },
    now,
  );
  return ok(messageView(posted, await chatPeople()), 201);
}

/** S6: mọi nhân viên ghi chú được, bất kỳ lúc nào (16 BR-07) — không kiểm phụ trách, không kiểm đã kết thúc. */
async function note(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const body = bodyOf(config);
  const said = typeof body.text === "string" ? body.text : "";
  const people = await chatPeople();
  const mentions = Array.isArray(body.mentions) ? [...new Set(body.mentions.map(text))] : [];
  if (mentions.length > MENTIONS_MAX)
    return chatError("VALIDATION_FAILED", REFUSAL.mentionsMax(MENTIONS_MAX));
  if (mentions.some((id) => !people.has(id)))
    return chatError("VALIDATION_FAILED", REFUSAL.mentionStaffOnly);
  const contextId = text(body.contextId);
  const wrongContext = contextError(c, contextId);
  if (wrongContext) return wrongContext;
  const again = replay(c, text(body.clientMessageId), req.caller, said);
  if (again) return isMessage(again) ? ok(messageView(again, people), 201) : again;
  const refused = textError(said);
  if (refused) return refused;
  const posted = postMessage(c, {
    kind: "INTERNAL_NOTE",
    visibility: "STAFF",
    senderType: "AGENT",
    senderId: req.caller.id,
    body: said,
    clientMessageId: text(body.clientMessageId) || null,
    contextId: contextId || null,
    card: null,
    attachments: [],
    mentions,
  });
  return ok(messageView(posted, people), 201);
}

/**
 * S7 (§B.8): phụ trách trước, rồi mới đọc file (JPEG / PNG / WebP / PDF, ≤ 20 MB). Body phải là multipart — axios đổi
 * FormData thành JSON khi request mang `Content-Type: application/json`, khi đó không còn file.
 */
async function attachment(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const refused = inChargeError(c, req.caller);
  if (refused) return refused;
  const form: unknown = config.data;
  if (!(form instanceof FormData)) return chatError("VALIDATION_FAILED", REFUSAL.attachmentFile);
  const file = form.get("file");
  if (!(file instanceof Blob)) return chatError("VALIDATION_FAILED", REFUSAL.attachmentFile);
  if (file.size === 0) return chatError("VALIDATION_FAILED");
  if (file.size > UPLOAD_MAX_BYTES) return chatError("PAYLOAD_TOO_LARGE");
  if (!UPLOAD_TYPES.includes(file.type)) return chatError("UNSUPPORTED_MEDIA_TYPE");
  const caption = text(form.get("caption"));
  const clientMessageId = text(form.get("clientMessageId"));
  const again = replay(c, clientMessageId, req.caller, caption || null);
  if (again) return isMessage(again) ? ok(messageView(again, await chatPeople()), 201) : again;
  const now = Date.now();
  acceptAgentMessage(c, now);
  const posted = postMessage(
    c,
    {
      kind: "ATTACHMENT",
      visibility: "CUSTOMER",
      senderType: "AGENT",
      senderId: req.caller.id,
      body: caption || null,
      clientMessageId: clientMessageId || null,
      contextId: null,
      card: null,
      attachments: [
        {
          id: crypto.randomUUID(),
          fileName: file instanceof File ? file.name : "file",
          contentType: file.type,
          sizeBytes: file.size,
          url: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null,
        },
      ],
      mentions: [],
    },
    now,
  );
  return ok(messageView(posted, await chatPeople()), 201);
}

/** S8: link tải 10 phút của file trong hội thoại này. */
async function attachmentLink(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ, ["id", "attachmentId"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const file = messagesOf(c.id)
    .flatMap((m) => m.attachments)
    .find((a) => a.id === req.params.attachmentId);
  if (!file?.url) return chatError("CHAT_MESSAGE_NOT_FOUND");
  return ok({ url: file.url, expiresAt: new Date(Date.now() + LINK_TTL_MS).toISOString() });
}

/* ── S9 đã đọc, S10 nhận, S11 giao / chuyển, S12 đổi trạng thái ──────────────────────────── */

/** `ChatReading.markRead`: thiếu `seq` = tin mới nhất; dấu không lùi. */
async function markRead(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const asked = bodyOf(config).seq;
  const target = typeof asked === "number" ? Math.min(asked, c.lastMessageSeq) : c.lastMessageSeq;
  const marker =
    target < 1 ? undefined : advanceMarker(c.id, req.caller.id, target, new Date().toISOString());
  return ok({
    conversationId: c.id,
    userId: req.caller.id,
    side: "AGENT",
    seq: marker?.seq ?? 0,
    at: marker?.at ?? null,
  });
}

/** `Conversation.claim`: hội thoại chưa ai có; NEW / QUEUED → ASSIGNED. Đã đóng → ENDED. */
async function claim(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  if (c.status === "CLOSED") return chatError("CHAT_CONVERSATION_ENDED");
  if (c.assignedAgentId !== null) return chatError("CHAT_ALREADY_ASSIGNED");
  c.assignedAgentId = req.caller.id;
  if (c.status === "NEW" || c.status === "QUEUED") c.status = "ASSIGNED";
  return detail(c, req.caller);
}

/**
 * `StaffChatService.assign` + `Conversation.handTo`: người nhận phải trả lời khách được; chưa ai có → chỉ giám sát giao;
 * đã có → người phụ trách hoặc giám sát chuyển; giao lại cho chính người đang giữ → VALIDATION_FAILED.
 */
async function assign(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const agentId = text(bodyOf(config).agentId);
  const people = await chatPeople();
  if (!people.get(agentId)?.agent) return chatError("CHAT_AGENT_NOT_AVAILABLE");
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  if (c.status === "CLOSED") return chatError("CHAT_CONVERSATION_ENDED");
  if (agentId === c.assignedAgentId) return chatError("VALIDATION_FAILED", REFUSAL.alreadyTheirs);
  if (c.assignedAgentId === null && !req.caller.supervisor)
    return chatError("CHAT_NOT_ASSIGNEE", REFUSAL.supervisorAssigns);
  if (c.assignedAgentId !== null && !req.caller.supervisor && c.assignedAgentId !== req.caller.id)
    return chatError("CHAT_NOT_ASSIGNEE");
  c.assignedAgentId = agentId;
  if (c.status === "NEW" || c.status === "QUEUED") c.status = "ASSIGNED";
  return detail(c, req.caller);
}

/** `Conversation.changeStatus` (docs 16 §5): ESCALATED cần lý do; RESOLVED mở cửa sổ mở lại 14 ngày + thẻ CSAT. */
async function changeStatus(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const body = bodyOf(config);
  const target: unknown = body.status;
  if (target !== undefined && target !== null && !isChatStatus(target))
    return chatError("MALFORMED_REQUEST");
  if (!isChatStatus(target) || !CHAT_MANUAL_TARGETS.includes(target))
    return chatError("CHAT_TRANSITION_NOT_ALLOWED", REFUSAL.notByHand(String(target ?? null)));
  if (!CHAT_MOVES[c.status].includes(target))
    return chatError("CHAT_TRANSITION_NOT_ALLOWED", REFUSAL.notAMove(c.status, target));
  if (c.status === "ESCALATED" && !req.caller.supervisor)
    return chatError("CHAT_NOT_ASSIGNEE", REFUSAL.escalatedSupervisor);
  if (!req.caller.supervisor && c.assignedAgentId !== req.caller.id)
    return chatError("CHAT_NOT_ASSIGNEE");
  const why = text(body.reason);
  if (target === "ESCALATED" && !why)
    return chatError("VALIDATION_FAILED", REFUSAL.escalationReason);
  const now = Date.now();
  if (target === "ESCALATED") c.escalationReason = why.slice(0, 1000);
  if (target === "RESOLVED") {
    c.resolvedAt = new Date(now).toISOString();
    c.reopenUntil = new Date(now + REOPEN_WINDOW_MS).toISOString();
  }
  c.status = target;
  if (target === "RESOLVED" && c.csatSubmittedAt === null) postCsatCard(c, now);
  return detail(c, req.caller);
}

export function registerChatMockRoutes(): void {
  registerMockRoute("GET", "/chat/conversations", inbox);
  registerMockRoute("GET", CONV, getOne);
  registerMockRoute("GET", `${CONV}/messages`, messages);
  registerMockRoute("POST", `${CONV}/messages`, reply);
  registerMockRoute("POST", `${CONV}/notes`, note);
  registerMockRoute("POST", `${CONV}/attachments`, attachment);
  registerMockRoute("GET", `${CONV}/attachments/:attachmentId/link`, attachmentLink);
  registerMockRoute("POST", `${CONV}/read`, markRead);
  registerMockRoute("POST", `${CONV}/claim`, claim);
  registerMockRoute("POST", `${CONV}/assignment`, assign);
  registerMockRoute("POST", `${CONV}/status`, changeStatus);
  registerChatToolRoutes();
  registerChatExtraRoutes();
}
