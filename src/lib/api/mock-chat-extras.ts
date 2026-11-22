/**
 * Mock route phần mở rộng của chat nhân viên (WF-02, chỉ USE_MOCK=true) — BE origin/develop `StaffChatController.open`
 * (`POST /chat/conversations`), `CannedResponseController` (CRUD), `ChatReportController` (`/chat/reports/agents`).
 */

import { CHAT_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { chatError, guard, isError } from "./mock-chat-http";
import {
  attachContextRow,
  chatPeople,
  chatState,
  conversationView,
  documentOf,
  postMessage,
} from "./mock-chat-store";
import { bodyOf, fail, ok, queryOf, text, validationFailed } from "./mock-route-utils";

import type { AxiosRequestConfig } from "axios";
import type { MockCannedResponse, MockConversation } from "./mock-chat-seed";
import type { MockResponseShape } from "./mock-route-utils";

const CREATE = CHAT_PERMISSIONS.create;
const SHORTCUT = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const DAY_MS = 86_400_000;
const REPORT_MAX_DAYS = 366;

/** `StaffChatService.open`: khách phải có; chứng từ phải của khách; tự nhận nếu người mở trả lời khách. */
async function openConversation(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, CREATE);
  if (isError(req)) return req;
  const body = bodyOf(config);
  const customerId = text(body.customerId);
  if (!chatState().customers.some((customer) => customer.id === customerId)) {
    return chatError("CUSTOMER_NOT_FOUND");
  }
  const kind = text(body.contextKind);
  const refId = text(body.contextId);
  if (kind && documentOf(kind, refId)?.customerId !== customerId) {
    return chatError("CHAT_CONTEXT_NOT_FOUND");
  }
  const people = await chatPeople();
  const now = Date.now();
  const conversation: MockConversation = {
    id: crypto.randomUUID(),
    customerId,
    subject: text(body.subject),
    status: people.get(req.caller.id)?.agent ? "ASSIGNED" : "QUEUED",
    assignedAgentId: people.get(req.caller.id)?.agent ? req.caller.id : null,
    escalationReason: null,
    firstResponseDueAt: null,
    firstRespondedAt: null,
    resolutionDueAt: null,
    resolvedAt: null,
    reopenUntil: null,
    csatScore: null,
    csatComment: null,
    csatSubmittedAt: null,
    createdAt: new Date(now).toISOString(),
    lastMessageSeq: 0,
    lastMessageAt: null,
  };
  chatState().conversations.push(conversation);
  if (kind) attachContextRow(conversation, kind, refId, now);
  const first = text(body.text);
  if (first) {
    postMessage(
      conversation,
      {
        kind: "TEXT",
        visibility: "CUSTOMER",
        senderType: "AGENT",
        senderId: req.caller.id,
        body: first,
        clientMessageId: text(body.clientMessageId) || null,
        contextId: null,
        card: null,
        attachments: [],
        mentions: [],
      },
      now,
    );
    if (conversation.assignedAgentId) {
      conversation.status = "ACTIVE";
      conversation.firstRespondedAt = new Date(now).toISOString();
    }
  }
  return ok(conversationView(conversation, req.caller, people, true, now), 201);
}

interface CannedDraft {
  title: string;
  body: string;
  shortcut: string | null;
  category: string | null;
}

/** `CannedResponse` constructor: tiêu đề / nội dung bắt buộc, phím tắt và nhóm theo luật BE. */
function cannedDraft(body: Record<string, unknown>): CannedDraft | MockResponseShape {
  const title = text(body.title);
  const content = text(body.body);
  const shortcut = text(body.shortcut).toLowerCase();
  const category = text(body.category);
  if (!title) return validationFailed("title", "Câu trả lời mẫu cần có tiêu đề.");
  if (!content) return validationFailed("body", "Câu trả lời mẫu cần có nội dung.");
  if (title.length > 200) return validationFailed("title", "Tiêu đề tối đa 200 ký tự.");
  if (content.length > 4000) return validationFailed("body", "Nội dung tối đa 4000 ký tự.");
  if (shortcut && !SHORTCUT.test(shortcut)) {
    return validationFailed("shortcut", "Phím tắt gồm 1–32 chữ thường, số, '-' hoặc '_'.");
  }
  if (category.length > 64) return validationFailed("category", "Nhóm tối đa 64 ký tự.");
  return { title, body: content, shortcut: shortcut || null, category: category || null };
}

const cannedView = (row: MockCannedResponse) => ({ ...row, shared: row.ownerId === null });
const isDraft = (value: CannedDraft | MockResponseShape): value is CannedDraft => "title" in value;

async function cannedCreate(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, CHAT_PERMISSIONS.cannedCreate);
  if (isError(req)) return req;
  const body = bodyOf(config);
  const draft = cannedDraft(body);
  if (!isDraft(draft)) return draft;
  if (body.shared === true && !req.caller.supervisor) {
    return fail(403, "FORBIDDEN", "Chỉ người giám sát chat được viết câu trả lời mẫu dùng chung.");
  }
  const row: MockCannedResponse = {
    id: crypto.randomUUID(),
    ownerId: body.shared === true ? null : req.caller.id,
    ...draft,
    version: 0,
  };
  chatState().canned.push(row);
  return ok(cannedView(row), 201);
}

/** `requireChangeableBy`: của người khác → không thấy (404); dùng chung mà không giám sát → 403. */
function changeable(id: string, caller: { id: string; supervisor: boolean }) {
  const row = chatState().canned.find((r) => r.id === id);
  if (!row || (row.ownerId !== null && row.ownerId !== caller.id)) {
    return chatError("CHAT_CANNED_RESPONSE_NOT_FOUND");
  }
  if (row.ownerId === null && !caller.supervisor) {
    return fail(403, "FORBIDDEN", "Chỉ người giám sát chat được sửa câu trả lời mẫu dùng chung.");
  }
  return row;
}
const isRow = (value: MockCannedResponse | MockResponseShape): value is MockCannedResponse =>
  "body" in value && "ownerId" in value;

async function cannedUpdate(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, CHAT_PERMISSIONS.cannedUpdate, ["id"]);
  if (isError(req)) return req;
  const row = changeable(req.params.id ?? "", req.caller);
  if (!isRow(row)) return row;
  const body = bodyOf(config);
  const draft = cannedDraft(body);
  if (!isDraft(draft)) return draft;
  if (typeof body.version === "number" && body.version !== row.version) {
    return fail(409, "OPTIMISTIC_LOCK", "Câu trả lời mẫu đã được người khác sửa, hãy tải lại.");
  }
  Object.assign(row, draft, { version: row.version + 1 });
  return ok(cannedView(row));
}

async function cannedDelete(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, CHAT_PERMISSIONS.cannedDelete, ["id"]);
  if (isError(req)) return req;
  const row = changeable(req.params.id ?? "", req.caller);
  if (!isRow(row)) return row;
  const state = chatState();
  state.canned = state.canned.filter((r) => r.id !== row.id);
  return ok(null);
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;
const mean = (values: number[]) =>
  values.length === 0
    ? undefined
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

function figures(agentId: string | null, name: string | null, rows: MockConversation[]) {
  const answered = rows.filter((c) => c.firstRespondedAt);
  const resolved = rows.filter((c) => c.resolvedAt);
  const rated = rows.filter((c) => c.csatScore !== null);
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const c of rated) distribution[String(c.csatScore)] += 1;
  return {
    agentId: agentId ?? undefined,
    agentName: name ?? undefined,
    conversations: rows.length,
    answered: answered.length,
    // Mock: phút thực (BE tính phút trong giờ làm việc).
    averageFirstResponseMinutes: mean(
      answered.map(
        (c) => (Date.parse(c.firstRespondedAt ?? "") - Date.parse(c.createdAt)) / 60_000,
      ),
    ),
    firstResponsesOverdue: rows.filter(
      (c) =>
        c.firstResponseDueAt &&
        Date.parse(c.firstRespondedAt ?? new Date().toISOString()) >
          Date.parse(c.firstResponseDueAt),
    ).length,
    resolved: resolved.length,
    averageResolutionHours: mean(
      resolved.map((c) => (Date.parse(c.resolvedAt ?? "") - Date.parse(c.createdAt)) / 3_600_000),
    ),
    csatCount: rated.length,
    csatAverage: mean(rated.map((c) => c.csatScore ?? 0)),
    csatDistribution: distribution,
  };
}

/** `ChatReports.report`: hội thoại mở trong [from, to] (ngày, gồm cả hai đầu), chia theo người phụ trách. */
async function agentsReport(config: AxiosRequestConfig): Promise<MockResponseShape> {
  const req = await guard(config, CHAT_PERMISSIONS.superviseRead);
  if (isError(req)) return req;
  const query = queryOf(config);
  const from = query.get("from") ?? "";
  const to = query.get("to") ?? "";
  const bad = !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to);
  if (bad || dayNumber(to) < dayNumber(from) || dayNumber(to) - dayNumber(from) > REPORT_MAX_DAYS) {
    return chatError("VALIDATION_FAILED", `Khoảng thời gian từ 1 đến ${REPORT_MAX_DAYS} ngày.`);
  }
  const start = Date.parse(`${from}T00:00:00+07:00`);
  const end = Date.parse(`${to}T00:00:00+07:00`) + DAY_MS;
  const agentId = query.get("agentId");
  const inPeriod = chatState().conversations.filter((c) => {
    const opened = Date.parse(c.createdAt);
    return opened >= start && opened < end && (!agentId || c.assignedAgentId === agentId);
  });
  const people = await chatPeople();
  const byAgent = new Map<string, MockConversation[]>();
  for (const c of inPeriod) {
    if (c.assignedAgentId)
      byAgent.set(c.assignedAgentId, [...(byAgent.get(c.assignedAgentId) ?? []), c]);
  }
  const agents = [...byAgent.entries()]
    .map(([id, rows]) => figures(id, people.get(id)?.name ?? null, rows))
    .sort((a, b) => b.conversations - a.conversations);
  return ok({ from, to, total: figures(null, null, inPeriod), agents });
}

export function registerChatExtraRoutes(): void {
  registerMockRoute("POST", "/chat/conversations", openConversation);
  registerMockRoute("POST", "/chat/canned-responses", cannedCreate);
  registerMockRoute("PUT", "/chat/canned-responses/:id", cannedUpdate);
  registerMockRoute("DELETE", "/chat/canned-responses/:id", cannedDelete);
  registerMockRoute("GET", "/chat/reports/agents", agentsReport);
}
