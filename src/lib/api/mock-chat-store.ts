/**
 * Trạng thái + cách nhìn của mock chat Sale (WF-02, chỉ USE_MOCK=true). Hình JSON theo BE origin/develop:
 * `ChatViews` (hàng hộp thư, chi tiết, `nextStatuses` của nhân viên), `ChatMessageView`, `CardActions.of` (nút của thẻ),
 * `ChatMessageRepositoryAdapter.unread` (tin chưa đọc: sau dấu đọc của người xem, không tính tin của chính họ).
 * Người gọi = tài khoản mock đang đăng nhập (`useAuthStore`), id đổi sang UUID ổn định bằng `mockActorId`.
 */

import { CHAT_CONVERSATION_STATUSES, CHAT_ENDED_STATUSES, CHAT_PERMISSIONS } from "@/constants";

import { getMockStaffUsers } from "./mock-adapter";
import {
  CHAT_SEED_AGENTS,
  CHAT_SEED_CUSTOMER_ACCOUNTS,
  CHAT_SEED_PEOPLE,
  chatSeed,
  chatToday,
} from "./mock-chat-seed";
import { mockActorId } from "./mock-routes-inventory";
import { mockGrantsOf, MOCK_USER_GRANTS } from "./mock-user-grants";

import type { ChatConversationStatus } from "@/constants";
import type {
  MockChatCard,
  MockChatMessage,
  MockChatSeed,
  MockConversation,
  MockReadMarker,
} from "./mock-chat-seed";

export interface ChatCaller {
  /** UUID của người gọi (như `sender_id` / `assigned_agent_id` của BE). */
  id: string;
  supervisor: boolean;
  can: (code: string) => boolean;
}

let state: MockChatSeed = chatSeed(Date.now());

export function resetChatMockState(now = Date.now()): void {
  state = chatSeed(now);
}

/** Trạng thái thô — cho route mock và test, không cho UI. */
export const chatState = (): MockChatSeed => state;

export async function chatCaller(): Promise<ChatCaller | null> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const userId = useAuthStore.getState().user?.userId;
  if (!userId) return null;
  const grants = mockGrantsOf(userId);
  const can = (code: string) => [...grants].some((grant) => grant === code);
  return { id: mockActorId(userId), supervisor: can(CHAT_PERMISSIONS.supervise), can };
}

/* ── Người: tên hiển thị + ai trả lời khách (`AgentDirectory`) ───────────────────────────── */

interface Person {
  id: string;
  name: string;
  agent: boolean;
}

/** Tài khoản seed + nhân viên mock; người trả lời khách = có `chat-conversations:UPDATE` (hoặc agent của seed). */
export async function chatPeople(): Promise<Map<string, Person>> {
  const people = new Map<string, Person>();
  for (const [id, name] of Object.entries(CHAT_SEED_PEOPLE))
    people.set(id, { id, name, agent: CHAT_SEED_AGENTS.includes(id) });
  for (const user of await getMockStaffUsers()) {
    const grants = MOCK_USER_GRANTS[user.userId] ?? [];
    const answers = user.active && grants.some((code) => code === CHAT_PERMISSIONS.update);
    const id = mockActorId(user.userId);
    people.set(id, { id, name: user.fullName, agent: answers });
  }
  return people;
}

/* ── Thẻ: nút của từng bên (`CardActions.of`) ─────────────────────────────────────────────── */

const isSet = (value: unknown) => value !== undefined && value !== null && value !== "";

function approved(design: Record<string, unknown>): boolean {
  return design.designStatus === "APPROVED" && typeof design.customerSku === "string"
    ? design.customerSku.trim() !== ""
    : false;
}

/** `CardActions.quotable`: yêu cầu còn mở, chưa có báo giá, mọi thiết kế đã duyệt và có SKU riêng (14 BR-22). */
function quotable(payload: Record<string, unknown>): boolean {
  if (isSet(payload.quoteId)) return false;
  if (payload.scope === "PROJECT") {
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    return (
      payload.status === "OPEN" &&
      lines.length > 0 &&
      lines.every((line) => typeof line === "object" && line !== null && approved({ ...line }))
    );
  }
  return payload.requestStatus === "OPEN" && approved(payload);
}

export function cardActions(card: MockChatCard): { customer: string[]; staff: string[] } {
  const none = { customer: [], staff: [] };
  if (card.state !== "OPEN") return none;
  const p = card.payload;
  switch (card.kind) {
    case "QUOTE_REQUEST":
      return quotable(p) ? { customer: [], staff: ["CREATE_QUOTE"] } : none;
    case "QUOTE":
      return p.status === "SENT" ? { customer: ["ACCEPT", "REQUEST_CHANGES"], staff: [] } : none;
    case "SAMPLE_APPROVAL":
      return p.status === "WAITING"
        ? { customer: ["APPROVE", "REQUEST_REPRINT"], staff: [] }
        : none;
    case "CSAT_SURVEY":
      return { customer: ["RATE"], staff: [] };
    default:
      return none;
  }
}

/* ── Hội thoại ───────────────────────────────────────────────────────────────────────────── */

const ENDED: readonly ChatConversationStatus[] = CHAT_ENDED_STATUSES;
export const isEndedStatus = (status: ChatConversationStatus) => ENDED.includes(status);

/** Bảng chuyển trạng thái `ConversationStatus.next()` (docs 16 §5). */
export const CHAT_MOVES: Readonly<
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

/** Đích đổi được bằng tay (`ChatViews.ASKED_FOR`, S12). */
export const CHAT_MANUAL_TARGETS: readonly ChatConversationStatus[] = [
  "ACTIVE",
  "WAITING_ON_CUSTOMER",
  "WAITING_ON_INTERNAL",
  "ESCALATED",
  "RESOLVED",
];

export const isChatStatus = (value: unknown): value is ChatConversationStatus =>
  CHAT_CONVERSATION_STATUSES.some((status) => status === value);

const before = (iso: string | null, now: number) => iso !== null && Date.parse(iso) < now;

export function firstResponseOverdue(c: MockConversation, now: number): boolean {
  return (
    c.firstRespondedAt === null && !isEndedStatus(c.status) && before(c.firstResponseDueAt, now)
  );
}

export function resolutionOverdue(c: MockConversation, now: number): boolean {
  return !isEndedStatus(c.status) && before(c.resolutionDueAt, now);
}

export const isOverdue = (c: MockConversation, now: number) =>
  firstResponseOverdue(c, now) || resolutionOverdue(c, now);

export const messagesOf = (conversationId: string): MockChatMessage[] =>
  state.messages.filter((m) => m.conversationId === conversationId);

export function markerOf(conversationId: string, userId: string): MockReadMarker | undefined {
  return state.markers.find((m) => m.conversationId === conversationId && m.userId === userId);
}

/** Dấu đọc chỉ tiến, không lùi (`ReadMarkers.advance`). */
export function advanceMarker(conversationId: string, userId: string, seq: number, at: string) {
  const marker = markerOf(conversationId, userId);
  if (!marker) state.markers.push({ conversationId, userId, seq, at });
  else if (seq > marker.seq) Object.assign(marker, { seq, at });
  return markerOf(conversationId, userId);
}

/** Tin nhân viên chưa đọc (mọi visibility), trừ tin của chính người xem. */
export function unreadOf(conversationId: string, viewerId: string): number {
  const read = markerOf(conversationId, viewerId)?.seq ?? 0;
  return messagesOf(conversationId).filter((m) => m.seq > read && m.senderId !== viewerId).length;
}

export function messageView(m: MockChatMessage, people: Map<string, Person>) {
  const actions = m.card ? cardActions(m.card) : null;
  return {
    id: m.id,
    conversationId: m.conversationId,
    seq: m.seq,
    kind: m.kind,
    visibility: m.visibility,
    senderType: m.senderType,
    senderId: m.senderId,
    senderName: m.senderId ? (people.get(m.senderId)?.name ?? null) : null,
    body: m.body,
    clientMessageId: m.clientMessageId,
    contextId: m.contextId,
    card:
      m.card && actions
        ? {
            kind: m.card.kind,
            state: m.card.state,
            payload: m.card.payload,
            updatedAt: m.card.updatedAt,
            customerActions: actions.customer,
            staffActions: actions.staff,
          }
        : null,
    attachments: m.attachments.map(({ id, fileName, contentType, sizeBytes }) => ({
      id,
      fileName,
      contentType,
      sizeBytes,
    })),
    mentions: m.mentions,
    sentAt: m.sentAt,
    deleted: false,
  };
}

export function documentOf(kind: string, id: string) {
  return state.documents.find((d) => d.kind === kind && d.id === id);
}

const customerName = (id: string) => state.customers.find((c) => c.id === id)?.name ?? null;

/** Hàng hộp thư (`ChatViews.rows`) hoặc chi tiết (nhãn + trạng thái chứng từ, dấu đọc) cho nhân viên. */
export function conversationView(
  c: MockConversation,
  caller: ChatCaller,
  people: Map<string, Person>,
  detail: boolean,
  now = Date.now(),
) {
  const newest = messagesOf(c.id).sort((a, b) => b.seq - a.seq)[0];
  const allowed = c.status !== "ESCALATED" || caller.supervisor;
  return {
    id: c.id,
    customerId: c.customerId,
    customerName: customerName(c.customerId),
    subject: c.subject,
    status: c.status,
    nextStatuses: allowed
      ? CHAT_MOVES[c.status].filter((target) => CHAT_MANUAL_TARGETS.includes(target))
      : [],
    assignedAgentId: c.assignedAgentId,
    assignedAgentName: c.assignedAgentId ? (people.get(c.assignedAgentId)?.name ?? null) : null,
    // Không có STOMP trong mock: chỉ người đang gọi được coi là trực tuyến (`ChatPresence`).
    agentOnline: c.assignedAgentId === caller.id,
    escalationReason: c.escalationReason,
    firstResponseDueAt: c.firstResponseDueAt,
    firstRespondedAt: c.firstRespondedAt,
    firstResponseOverdue: firstResponseOverdue(c, now),
    resolutionDueAt: c.resolutionDueAt,
    resolutionOverdue: resolutionOverdue(c, now),
    reopenUntil: c.reopenUntil,
    createdAt: c.createdAt,
    lastMessageAt: c.lastMessageAt,
    lastSeq: c.lastMessageSeq,
    unread: unreadOf(c.id, caller.id),
    lastMessage: newest ? messageView(newest, people) : null,
    contexts: state.contexts
      .filter((x) => x.conversationId === c.id)
      .map((x) => {
        const found = detail ? documentOf(x.kind, x.refId) : undefined;
        return {
          id: x.id,
          kind: x.kind,
          refId: x.refId,
          primary: x.primary,
          label: found?.number ?? null,
          status: found?.status ?? null,
          attachedAt: x.attachedAt,
        };
      }),
    readMarkers: detail
      ? state.markers
          .filter((m) => m.conversationId === c.id)
          .map((m) => ({
            conversationId: c.id,
            userId: m.userId,
            side: CHAT_SEED_CUSTOMER_ACCOUNTS.includes(m.userId) ? "CUSTOMER" : "AGENT",
            seq: m.seq,
            at: m.at,
          }))
      : null,
    resolvedAt: c.resolvedAt,
    canRate: c.status === "RESOLVED" && c.csatSubmittedAt === null,
    csatScore: c.csatScore,
    csatComment: c.csatComment,
    csatSubmittedAt: c.csatSubmittedAt,
  };
}

/**
 * Đánh số và lưu một tin (`Conversation.next` + `ConversationWriter.post`): seq kế tiếp, tin cuối của hội thoại, dấu
 * đọc của người gửi tiến tới tin của họ.
 */
export function postMessage(
  c: MockConversation,
  message: Omit<MockChatMessage, "id" | "conversationId" | "seq" | "sentAt">,
  now = Date.now(),
): MockChatMessage {
  const sentAt = new Date(now).toISOString();
  const seq = c.lastMessageSeq + 1;
  const stored: MockChatMessage = {
    ...message,
    id: crypto.randomUUID(),
    conversationId: c.id,
    seq,
    sentAt,
  };
  c.lastMessageSeq = seq;
  c.lastMessageAt = sentAt;
  state.messages.push(stored);
  if (stored.senderId && stored.senderType !== "SYSTEM")
    advanceMarker(c.id, stored.senderId, seq, sentAt);
  return stored;
}

/** Gắn chứng từ nếu chưa có (`ChatCards.attach`); cái đầu tiên là chính. Trả id dòng ngữ cảnh. */
export function attachContextRow(
  c: MockConversation,
  kind: string,
  refId: string,
  now = Date.now(),
) {
  const existing = state.contexts.find(
    (x) => x.conversationId === c.id && x.kind === kind && x.refId === refId,
  );
  if (existing) return existing.id;
  const primary = !state.contexts.some((x) => x.conversationId === c.id);
  const id = crypto.randomUUID();
  state.contexts.push({
    id,
    conversationId: c.id,
    kind,
    refId,
    primary,
    attachedAt: new Date(now).toISOString(),
  });
  return id;
}

/** Đợt còn phải thu (`CustomerInstallments.openOf`: NOT_DUE / DUE / PARTIALLY_PAID) kèm cờ quá hạn. */
export function openInstallmentsOf(customerId: string, now = Date.now()) {
  const today = chatToday(now);
  return state.installments
    .filter((i) => i.customerId === customerId && i.paidAmount < i.amount)
    .filter((i) => ["NOT_DUE", "DUE", "PARTIALLY_PAID"].includes(i.status))
    .map((i) => ({
      ...i,
      reducedAmount: 0,
      outstanding: i.amount - i.paidAmount,
      overdue: i.dueDate !== null && i.dueDate < today,
    }));
}
