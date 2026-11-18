/**
 * Mock route công cụ quanh hội thoại chat của Sale (WF-02, chỉ USE_MOCK=true) — BE origin/develop
 * `StaffChatController` S13 / S15 / S16, `StaffChatActionsController` S17 / S18 / S21–S23 (`ChatCardActions`, `ChatSearch`,
 * `CannedResponses`), `CannedResponseController` S24, `CustomerOverviewService` (plan WF02-FE-plan Phụ lục B §B.3).
 */

import { registerMockRoute } from "./mock-adapter";
import { actCreateQuote, postTransferCard, transferReference } from "./mock-chat-cards";
import {
  CANNED_READ,
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
import {
  attachContextRow,
  cardActions,
  chatPeople,
  chatState,
  conversationView,
  documentOf,
  messageView,
  openInstallmentsOf,
  unreadOf,
} from "./mock-chat-store";
import { bodyOf, ok, pageOf, queryOf, text } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { MockChatDocument, MockConversation } from "./mock-chat-seed";
import type { ChatCaller } from "./mock-chat-store";
import type { MockResponseShape } from "./mock-route-utils";

const CONV = "/chat/conversations/:id";
const RECENT = 10;
const SEARCH_MIN = 2;
const SEARCH_MAX = 200;
const CONTEXT_KINDS = [
  "PRODUCT",
  "CUSTOMER_SKU",
  "DESIGN",
  "DESIGN_PROJECT",
  "QUOTE",
  "ORDER",
  "CONTRACT",
  "PRODUCTION_ORDER",
  "EINVOICE",
];
/** `CardActions`: hành động trên thẻ thuộc về khách (BR-10, BR-11) — nhân viên không làm thay. */
const CUSTOMER_ACTIONS = ["ACCEPT", "REQUEST_CHANGES", "APPROVE", "REQUEST_REPRINT", "RATE"];
/** Biến của câu trả lời mẫu (`CannedResponse.VARIABLES`) và loại chứng từ điền vào biến đó. */
const CANNED_VARIABLE_BY_KIND: Readonly<Record<string, string>> = {
  QUOTE: "quoteCode",
  ORDER: "orderCode",
  CONTRACT: "contractCode",
  PRODUCTION_ORDER: "productionOrderCode",
  EINVOICE: "invoiceCode",
  DESIGN: "designName",
  DESIGN_PROJECT: "designName",
};
const CANNED_VARIABLES = ["customerName", "agentName", ...Object.values(CANNED_VARIABLE_BY_KIND)];

async function detail(c: MockConversation, caller: ChatCaller) {
  return ok(conversationView(c, caller, await chatPeople(), true));
}

/** S13: chứng từ của chính khách của hội thoại (16 BR-02; bản nháp được); gắn lại cái đã có = không đổi gì. */
async function attachContext(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const body = bodyOf(config);
  const kind = text(body.kind);
  const refId = text(body.id);
  if (kind && !CONTEXT_KINDS.includes(kind)) return chatError("MALFORMED_REQUEST");
  if (!kind || !refId) return chatError("VALIDATION_FAILED", REFUSAL.contextIncomplete);
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  if (documentOf(kind, refId)?.customerId !== c.customerId)
    return chatError("CHAT_CONTEXT_NOT_FOUND");
  attachContextRow(c, kind, refId);
  return detail(c, req.caller);
}

/** S15: người trả lời khách, trực tuyến trước rồi theo tên (mock không có STOMP: chỉ người gọi trực tuyến). */
async function agents(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ);
  if (isError(req)) return req;
  const people = [...(await chatPeople()).values()].filter((p) => p.agent);
  const rows = people.map((p) => ({ userId: p.id, name: p.name, online: p.id === req.caller.id }));
  rows.sort(
    (a, b) =>
      Number(b.online) - Number(a.online) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  );
  return ok(rows);
}

const newestFirst = (a: MockChatDocument, b: MockChatDocument) =>
  (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0);

/** S16: hồ sơ khách — chứng từ gần đây, đợt còn nợ (id là thứ S18 nhận), bản thiết kế, hội thoại. */
async function overview(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ, ["customerId"]);
  if (isError(req)) return req;
  const customer = chatState().customers.find((c) => c.id === req.params.customerId);
  if (!customer) return chatError("CUSTOMER_NOT_FOUND");
  const docs = (kind: MockChatDocument["kind"]) =>
    chatState()
      .documents.filter((d) => d.kind === kind && d.customerId === customer.id)
      .sort(newestFirst)
      .slice(0, RECENT)
      .map((d) => ({
        id: d.id,
        customerId: d.customerId,
        number: d.number,
        status: d.status,
        responsibleUserId: d.responsibleUserId,
        amount: d.amount,
        currency: d.currency,
        createdAt: d.createdAt,
      }));
  const people = await chatPeople();
  return ok({
    customerId: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    orders: docs("ORDER"),
    quotes: docs("QUOTE"),
    contracts: docs("CONTRACT"),
    productionOrders: docs("PRODUCTION_ORDER"),
    installments: openInstallmentsOf(customer.id).map(({ customerId: _owner, ...i }) => i),
    designs: docs("DESIGN").map((d) => ({
      id: d.id,
      customerId: d.customerId,
      name: d.number,
      status: d.status,
    })),
    conversations: chatState()
      .conversations.filter((c) => c.customerId === customer.id)
      .slice(0, RECENT)
      .map((c) => conversationView(c, req.caller, people, false)),
  });
}

/**
 * S17 (`ChatCardActions.staffAct`): hành động của khách → từ chối; không được mời trên thẻ → thẻ yêu cầu báo giá đang mở
 * là CHAT_DESIGN_NOT_APPROVED, còn lại CHAT_CARD_ACTION_NOT_ALLOWED; rồi mới kiểm người phụ trách.
 */
async function cardAction(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id", "messageId"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const card = chatState().messages.find(
    (m) => m.id === req.params.messageId && m.conversationId === c.id && m.kind === "CARD",
  );
  if (!card?.card) return chatError("CHAT_MESSAGE_NOT_FOUND");
  const action = text(bodyOf(config).action).toUpperCase();
  if (CUSTOMER_ACTIONS.includes(action))
    return chatError("CHAT_CARD_ACTION_NOT_ALLOWED", REFUSAL.customerAction);
  if (!cardActions(card.card).staff.includes(action)) {
    const waiting = card.card.kind === "QUOTE_REQUEST" && card.card.state === "OPEN";
    return chatError(
      waiting && action === "CREATE_QUOTE"
        ? "CHAT_DESIGN_NOT_APPROVED"
        : "CHAT_CARD_ACTION_NOT_ALLOWED",
    );
  }
  const refused = inChargeError(c, req.caller);
  if (refused) return refused;
  actCreateQuote(c, card);
  return ok(messageView(card, await chatPeople()));
}

/** S18 (`ChatCardActions.sendTransferDetails`, 16 BR-06): đợt của chính khách, còn phải thu. */
async function transferDetails(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, UPDATE, ["id"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const refused = inChargeError(c, req.caller);
  if (refused) return refused;
  const body = bodyOf(config);
  const installment = chatState().installments.find(
    (i) => i.id === text(body.installmentId) && i.customerId === c.customerId,
  );
  if (!installment) return chatError("CHAT_CONTEXT_NOT_FOUND");
  const open = openInstallmentsOf(c.customerId).find((i) => i.id === installment.id);
  if (!open || installment.status === "PAID" || installment.status === "CANCELLED")
    return chatError(
      "CHAT_CARD_ACTION_NOT_ALLOWED",
      REFUSAL.nothingOwed(transferReference(installment)),
    );
  const posted = postTransferCard(c, open, body.reminder === true, req.caller.id);
  return ok(messageView(posted, await chatPeople()), 201);
}

/** `unaccent` + chữ thường, `đ` → `d`. */
const plain = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/gi, "d").toLowerCase();
const words = (value: string) =>
  plain(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** Khớp như `ChatMessageRepositoryAdapter.search`: mọi từ của câu tìm có trong tin, hoặc khớp một phần cả câu. */
function matches(body: string, q: string): boolean {
  if (plain(body).includes(plain(q))) return true;
  const have = new Set(words(body));
  const wanted = words(q);
  return wanted.length > 0 && wanted.every((w) => have.has(w));
}

/** S21: gồm ghi chú nội bộ; mới gửi trước. */
async function search(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ);
  if (isError(req)) return req;
  const query = queryOf(config);
  const q = (query.get("q") ?? "").trim();
  if (q.length < SEARCH_MIN || q.length > SEARCH_MAX)
    return chatError("VALIDATION_FAILED", REFUSAL.searchLength);
  const customerId = query.get("customerId");
  const conversationId = query.get("conversationId");
  const conversations = new Map(chatState().conversations.map((c) => [c.id, c]));
  const found = chatState()
    .messages.filter((m) => m.body !== null && matches(m.body, q))
    .filter((m) => !conversationId || m.conversationId === conversationId)
    .filter((m) => !customerId || conversations.get(m.conversationId)?.customerId === customerId)
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt) || (a.id < b.id ? 1 : -1));
  const page = pageOf(found, pageIndex(query.get("page")), clampSize(query.get("size"), 20));
  const people = await chatPeople();
  return ok({
    ...page,
    items: page.items.map((m) => {
      const c = conversations.get(m.conversationId);
      return {
        message: messageView(m, people),
        conversationId: m.conversationId,
        customerId: c?.customerId ?? null,
        customerName: chatState().customers.find((x) => x.id === c?.customerId)?.name ?? null,
        subject: c?.subject ?? null,
        conversationStatus: c?.status ?? null,
      };
    }),
  });
}

/** S22: tin chưa đọc trong hội thoại giao cho mình + số hội thoại NEW / QUEUED chưa ai nhận. */
async function unread(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, READ);
  if (isError(req)) return req;
  const all = chatState().conversations;
  const counts = all
    .filter((c) => c.assignedAgentId === req.caller.id)
    .map((c) => unreadOf(c.id, req.caller.id));
  return ok({
    conversations: counts.filter((n) => n > 0).length,
    messages: counts.reduce((sum, n) => sum + n, 0),
    queued: all.filter(
      (c) => c.assignedAgentId === null && (c.status === "NEW" || c.status === "QUEUED"),
    ).length,
  });
}

const visibleCanned = (caller: ChatCaller) =>
  chatState().canned.filter((r) => r.ownerId === null || r.ownerId === caller.id);

/** S23 (`CannedResponses.render`): biến lạ giữ nguyên, biến không có giá trị thành rỗng; chứng từ mới gắn sau thắng. */
async function cannedPreview(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, CANNED_READ, ["id", "cannedId"]);
  if (isError(req)) return req;
  const c = findConversation(req.params.id ?? "");
  if (!c) return chatError("CHAT_CONVERSATION_NOT_FOUND");
  const reply = visibleCanned(req.caller).find((r) => r.id === req.params.cannedId);
  if (!reply) return chatError("CHAT_CANNED_RESPONSE_NOT_FOUND");
  const values = new Map<string, string>();
  const customer = chatState().customers.find((x) => x.id === c.customerId);
  if (customer) values.set("customerName", customer.name);
  const agent = (await chatPeople()).get(req.caller.id);
  if (agent) values.set("agentName", agent.name);
  const contexts = chatState()
    .contexts.filter((x) => x.conversationId === c.id)
    .sort((a, b) => Date.parse(a.attachedAt) - Date.parse(b.attachedAt));
  for (const x of contexts) {
    const variable = CANNED_VARIABLE_BY_KIND[x.kind];
    const label = documentOf(x.kind, x.refId)?.number;
    if (variable && label) values.set(variable, label);
  }
  const filled = reply.body
    .replace(/\{(\w+)\}/g, (whole, name: string) =>
      CANNED_VARIABLES.includes(name) ? (values.get(name) ?? "") : whole,
    )
    .trim();
  return ok({ cannedResponseId: reply.id, conversationId: c.id, text: filled });
}

/** S24: dùng chung trước, rồi theo tiêu đề; lọc `q` (tiêu đề / nội dung / phím tắt) và `category`. */
async function cannedList(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, CANNED_READ);
  if (isError(req)) return req;
  const query = queryOf(config);
  const needle = (query.get("q") ?? "").trim().toLowerCase();
  const category = (query.get("category") ?? "").trim().toLowerCase();
  const rows = visibleCanned(req.caller)
    .filter((r) => !category || (r.category ?? "").toLowerCase() === category)
    .filter(
      (r) =>
        !needle ||
        r.title.toLowerCase().includes(needle) ||
        r.body.toLowerCase().includes(needle) ||
        (r.shortcut ?? "").includes(needle),
    )
    .sort(
      (a, b) =>
        Number(a.ownerId !== null) - Number(b.ownerId !== null) ||
        a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
    );
  return ok(rows.map((r) => ({ ...r, shared: r.ownerId === null })));
}

export function registerChatToolRoutes(): void {
  registerMockRoute("POST", `${CONV}/contexts`, attachContext);
  registerMockRoute("GET", "/chat/agents", agents);
  registerMockRoute("GET", "/chat/customers/:customerId/overview", overview);
  registerMockRoute("POST", `${CONV}/cards/transfer-details`, transferDetails);
  registerMockRoute("POST", `${CONV}/cards/:messageId/actions`, cardAction);
  registerMockRoute("GET", "/chat/search", search);
  registerMockRoute("GET", "/chat/unread-count", unread);
  registerMockRoute("GET", `${CONV}/canned-responses/:cannedId/preview`, cannedPreview);
  registerMockRoute("GET", "/chat/canned-responses", cannedList);
}
