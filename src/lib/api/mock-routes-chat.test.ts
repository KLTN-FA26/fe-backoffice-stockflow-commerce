/**
 * Mock chat Sale (WF-02, BE `StaffChatController` / `StaffChatActionsController` / `CannedResponseController`) — chạy qua
 * axios thật + `features/chat/api*.ts`, nên kiểm luôn lớp api parse được câu trả lời của mock: seed demo, người phụ
 * trách (CHAT_NOT_ASSIGNEE), hội thoại đã kết thúc, `clientMessageId`, 16 BR-06, giao / chuyển, vòng đời, thẻ.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

import {
  changeStatus,
  claimConversation,
  getConversation,
  getCustomerOverview,
  listConversations,
  listMessages,
  markRead,
  sendNote,
  sendText,
  sendTransferDetails,
  staffCardAction,
} from "@/features/chat/api";
import {
  assignConversation,
  attachContext,
  getStaffUnread,
  listAgents,
  listCannedResponses,
  previewCannedResponse,
  searchMessages,
} from "@/features/chat/api-tools";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { activateMockAdapter } from "./mock-adapter";
import { postDesignQuoteRequestCard, vietQrPayload } from "./mock-chat-cards";
import { CHAT_SEED } from "./mock-chat-seed";
import { chatState, resetChatMockState } from "./mock-chat-store";
import { mockActorId } from "./mock-routes-inventory";

const S = CHAT_SEED;
const ADMIN = "USER-ADMIN-01"; // SYSTEM_ADMIN: chat-supervision → người giám sát
const SALE = "USER-SALE-01"; // SALES_STAFF: trả lời khách, không giám sát
const originalAdapter = api.defaults.adapter;

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
  });
}

async function refusal(promise: Promise<unknown>): Promise<[number, string, string]> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return [error.status, error.code, error.message];
    throw error;
  }
  throw new Error("Expected request to fail");
}

const codeOf = async (promise: Promise<unknown>) => (await refusal(promise)).slice(0, 2);

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => {
  resetChatMockState();
  actAs(ADMIN);
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("S1 / S3 / S4 — hộp thư, chi tiết, tin nhắn theo seed demo", () => {
  it("mặc định bỏ hội thoại đã kết thúc; lọc trạng thái; người không có quyền chat bị 403", async () => {
    const inbox = await listConversations({ scope: "all" });
    expect(inbox.totalElements).toBe(4);
    expect(inbox.items.map((c) => c.status)).not.toContain("RESOLVED");
    const resolved = await listConversations({ scope: "all", status: ["RESOLVED"] });
    expect(resolved.items.map((c) => c.subject)).toEqual(["Hỏi lịch giao hàng"]);
    expect(resolved.items[0]?.nextStatuses).toEqual([]);
    actAs("USER-WH-01");
    expect(await codeOf(listConversations({ scope: "all" }))).toEqual([403, "FORBIDDEN"]);
  });

  it("chi tiết có nhãn + trạng thái chứng từ và các bước đổi tay của ACTIVE", async () => {
    const c = await getConversation(S.ds02b);
    expect(c.assignedAgentName).toBe("Trần Văn Sales (demo)");
    expect(c.contexts.map((x) => [x.kind, x.label, x.status])).toEqual([
      ["ORDER", "SO-20261120-900001", "PENDING_CONTRACT"],
      ["CONTRACT", "HD-20261120-900001-1", "SENT"],
    ]);
    expect(c.nextStatuses).toEqual([
      "WAITING_ON_CUSTOMER",
      "WAITING_ON_INTERNAL",
      "ESCALATED",
      "RESOLVED",
    ]);
  });

  it("tin mới nhất trước, gồm ghi chú nội bộ; `before` lùi trang", async () => {
    const page = await listMessages(S.chatInProgress);
    expect(page.items.map((m) => m.seq)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(page.items.find((m) => m.seq === 4)?.visibility).toBe("STAFF");
    expect(page.items.find((m) => m.seq === 9)?.card?.customerActions).toEqual([
      "APPROVE",
      "REQUEST_REPRINT",
    ]);
    const older = await listMessages(S.chatInProgress, 4);
    expect(older.items.map((m) => m.seq)).toEqual([3, 2, 1]);
    expect(older.lastSeq).toBe(12);
  });
});

describe("S5 / S6 — trả lời và ghi chú", () => {
  it("chỉ người phụ trách hoặc giám sát trả lời; ASSIGNED → ACTIVE không đổi khi đã ACTIVE", async () => {
    actAs(SALE);
    expect(
      await codeOf(sendText({ id: S.ds02a, text: "Dạ em gửi ạ", clientMessageId: "c1" })),
    ).toEqual([409, "CHAT_NOT_ASSIGNEE"]);
    actAs(ADMIN);
    const sent = await sendText({ id: S.ds02a, text: "Dạ em gửi ạ", clientMessageId: "c1" });
    expect([sent.seq, sent.senderType, sent.visibility]).toEqual([3, "AGENT", "CUSTOMER"]);
  });

  it("gửi lại cùng clientMessageId trả đúng tin cũ; khác nội dung → CHAT_CLIENT_MESSAGE_ID_REUSED", async () => {
    const first = await sendText({
      id: S.ds02b,
      text: "Đợt 2 khoảng 5 tuần",
      clientMessageId: "k",
    });
    const again = await sendText({
      id: S.ds02b,
      text: "Đợt 2 khoảng 5 tuần",
      clientMessageId: "k",
    });
    expect(again.id).toBe(first.id);
    expect(await codeOf(sendText({ id: S.ds02b, text: "khác", clientMessageId: "k" }))).toEqual([
      409,
      "CHAT_CLIENT_MESSAGE_ID_REUSED",
    ]);
  });

  it("16 BR-06: tin có số tài khoản công ty bị từ chối", async () => {
    const [status, code, message] = await refusal(
      sendText({ id: S.ds02b, text: "STK 0000 000 000 nhé", clientMessageId: "b" }),
    );
    expect([status, code]).toEqual([400, "VALIDATION_FAILED"]);
    expect(message).toContain("thẻ thông tin chuyển khoản");
  });

  it("hội thoại đã kết thúc từ chối trả lời, nhưng ai cũng ghi chú được", async () => {
    expect(
      await codeOf(sendText({ id: S.chatResolved, text: "Chào", clientMessageId: "e" })),
    ).toEqual([409, "CHAT_CONVERSATION_ENDED"]);
    actAs(SALE);
    const n = await sendNote({ id: S.chatResolved, text: "Khách hỏi lại", clientMessageId: "n" });
    expect([n.kind, n.visibility]).toEqual(["INTERNAL_NOTE", "STAFF"]);
  });
});

describe("S9 / S10 / S11 / S22 — đã đọc, nhận, giao / chuyển, huy hiệu", () => {
  it("nhận hội thoại đã có người → CHAT_ALREADY_ASSIGNED; hội thoại chờ nhận → ASSIGNED cho người gọi", async () => {
    expect(await codeOf(claimConversation({ id: S.ds02a }))).toEqual([
      409,
      "CHAT_ALREADY_ASSIGNED",
    ]);
    const queued = chatState().conversations.find((c) => c.id === S.ds02a);
    if (!queued) throw new Error("seed");
    Object.assign(queued, { status: "QUEUED", assignedAgentId: null });
    actAs(SALE);
    expect(await getStaffUnread()).toEqual({ conversations: 0, messages: 0, queued: 1 });
    const claimed = await claimConversation({ id: S.ds02a });
    expect([claimed.status, claimed.assignedAgentId]).toEqual(["ASSIGNED", mockActorId(SALE)]);
  });

  it("giao: chưa ai có → chỉ giám sát; giao cho chính người đang giữ → VALIDATION_FAILED; người lạ → không nhận chat", async () => {
    const c = chatState().conversations.find((x) => x.id === S.ds02a);
    if (!c) throw new Error("seed");
    c.assignedAgentId = null;
    actAs(SALE);
    expect(await codeOf(assignConversation({ id: S.ds02a, agentId: mockActorId(SALE) }))).toEqual([
      409,
      "CHAT_NOT_ASSIGNEE",
    ]);
    actAs(ADMIN);
    expect(
      await codeOf(assignConversation({ id: S.ds02a, agentId: mockActorId("USER-WH-01") })),
    ).toEqual([409, "CHAT_AGENT_NOT_AVAILABLE"]);
    await assignConversation({ id: S.ds02a, agentId: mockActorId(SALE) });
    expect(await codeOf(assignConversation({ id: S.ds02a, agentId: mockActorId(SALE) }))).toEqual([
      400,
      "VALIDATION_FAILED",
    ]);
  });

  it("chuyển cho Sale → hộp 'của tôi', tin chưa đọc, đánh dấu đã đọc", async () => {
    await assignConversation({ id: S.ds02a, agentId: mockActorId(SALE), note: "Nhờ em" });
    actAs(SALE);
    const mine = await listConversations({ scope: "mine" });
    expect(mine.items.map((c) => [c.id, c.unread])).toEqual([[S.ds02a, 2]]);
    expect(await getStaffUnread()).toEqual({ conversations: 1, messages: 2, queued: 0 });
    await markRead({ id: S.ds02a });
    expect(await getStaffUnread()).toEqual({ conversations: 0, messages: 0, queued: 0 });
    const agents = await listAgents();
    expect(agents[0]).toEqual({ userId: mockActorId(SALE), name: "Phan Thị Ngọc", online: true });
    expect(agents.map((a) => a.name)).toContain("Trần Văn Sales (demo)");
    expect(agents.map((a) => a.name)).not.toContain("Nguyễn Văn Sale (demo)");
  });
});

describe("S12 — đổi trạng thái (docs 16 §5)", () => {
  it("ESCALATED cần lý do; chỉ giám sát xử lý tiếp; RESOLVED đăng thẻ CSAT", async () => {
    expect(await codeOf(changeStatus({ id: S.ds02a, status: "ESCALATED" }))).toEqual([
      400,
      "VALIDATION_FAILED",
    ]);
    await assignConversation({ id: S.ds02a, agentId: mockActorId(SALE) });
    actAs(SALE);
    const escalated = await changeStatus({ id: S.ds02a, status: "ESCALATED", reason: "Giảm 5%" });
    expect([escalated.status, escalated.nextStatuses]).toEqual(["ESCALATED", []]);
    expect(await codeOf(changeStatus({ id: S.ds02a, status: "ACTIVE" }))).toEqual([
      409,
      "CHAT_NOT_ASSIGNEE",
    ]);
    actAs(ADMIN);
    expect(await codeOf(changeStatus({ id: S.ds02a, status: "WAITING_ON_CUSTOMER" }))).toEqual([
      409,
      "CHAT_TRANSITION_NOT_ALLOWED",
    ]);
    const resolved = await changeStatus({ id: S.ds02a, status: "RESOLVED" });
    expect(resolved.status).toBe("RESOLVED");
    const newest = (await listMessages(S.ds02a)).items[0];
    expect([newest?.card?.kind, newest?.card?.state, newest?.card?.customerActions]).toEqual([
      "CSAT_SURVEY",
      "OPEN",
      ["RATE"],
    ]);
  });
});

describe("S13 / S16 — chứng từ của khách", () => {
  it("gắn chứng từ của chính khách; của khách khác → CHAT_CONTEXT_NOT_FOUND", async () => {
    const c = await attachContext({ id: S.ds02a, kind: "QUOTE", refId: S.quote });
    expect(c.contexts.map((x) => x.label)).toContain("QT-20261120-9001");
    expect(await codeOf(attachContext({ id: S.ds02a, kind: "QUOTE", refId: S.tsmQuote }))).toEqual([
      404,
      "CHAT_CONTEXT_NOT_FOUND",
    ]);
  });

  it("hồ sơ khách: chứng từ theo seed, đợt O01 của Trà Sữa Mây quá hạn", async () => {
    const demo = await getCustomerOverview(S.demoCustomer);
    expect(demo.quotes.map((q) => q.number)).toEqual(["QT-20261120-9001"]);
    expect(demo.orders.map((o) => [o.number, o.amount])).toEqual([
      ["SO-20261120-900001", 77550000],
    ]);
    expect(demo.designs.map((d) => [d.name, d.status])).toEqual([
      ["Ly giấy 12oz logo xanh", "APPROVED"],
    ]);
    expect(demo.installments).toEqual([]);
    const tsm = await getCustomerOverview(S.traSuaMay);
    expect(tsm.installments.map((i) => [i.id, i.amount, i.overdue])).toEqual([
      [S.o01Installment, 41195000, true],
    ]);
    expect(await codeOf(getCustomerOverview(S.chatInProgress))).toEqual([
      404,
      "CUSTOMER_NOT_FOUND",
    ]);
  });
});

describe("S17 — CREATE_QUOTE trên thẻ yêu cầu báo giá", () => {
  it("chỉ khi thẻ mời; kiểm người phụ trách sau; thẻ → ACTED kèm quoteId / quoteNumber", async () => {
    const card = postDesignQuoteRequestCard({ cartons: 60, desiredDeliveryDate: null });
    if (!card) throw new Error("seed");
    const shown = (await listMessages(S.ds02a)).items[0];
    expect(shown?.card?.staffActions).toEqual(["CREATE_QUOTE"]);
    const act = (action: string) => staffCardAction({ id: S.ds02a, messageId: card.id, action });
    expect(await codeOf(act("ACCEPT"))).toEqual([409, "CHAT_CARD_ACTION_NOT_ALLOWED"]);
    actAs(SALE);
    expect(await codeOf(act("CREATE_QUOTE"))).toEqual([409, "CHAT_NOT_ASSIGNEE"]);
    actAs(ADMIN);
    const acted = await act("CREATE_QUOTE");
    expect([acted.card?.state, acted.card?.staffActions]).toEqual(["ACTED", []]);
    expect(acted.card?.payload).toMatchObject({
      quoteId: S.quote,
      quoteNumber: S.quoteNumber,
      requestStatus: "CLOSED",
    });
    expect(await codeOf(act("CREATE_QUOTE"))).toEqual([409, "CHAT_CARD_ACTION_NOT_ALLOWED"]);
  });

  it("thiết kế chưa duyệt → CHAT_DESIGN_NOT_APPROVED", async () => {
    const card = postDesignQuoteRequestCard({ cartons: 60, desiredDeliveryDate: null });
    if (!card?.card) throw new Error("seed");
    card.card.payload = { ...card.card.payload, designStatus: "PENDING_REVIEW", customerSku: null };
    expect(
      await codeOf(staffCardAction({ id: S.ds02a, messageId: card.id, action: "CREATE_QUOTE" })),
    ).toEqual([409, "CHAT_DESIGN_NOT_APPROVED"]);
  });
});

describe("S18 — thẻ chuyển khoản (16 BR-06)", () => {
  it("VietQR khớp chuỗi của seed (CRC16 4EDE)", () => {
    expect(vietQrPayload("970000", "0000000000", 15000000, "HD-DEMO-0001-1 DOT1")).toBe(
      "00020101021238540010A00000072701240006970000011000000000000208QRIBFTTA53037045408150000005802VN62230819HD-DEMO-0001-1 DOT163044EDE",
    );
  });

  it("đợt của khách khác → 404; đợt còn nợ → thẻ nhắc; hết nợ → từ chối", async () => {
    const args = { installmentId: S.o01Installment, reminder: true };
    expect(await codeOf(sendTransferDetails({ id: S.ds02a, ...args }))).toEqual([
      404,
      "CHAT_CONTEXT_NOT_FOUND",
    ]);
    const card = await sendTransferDetails({ id: S.tsm, ...args });
    expect([card.card?.kind, card.card?.state]).toEqual(["PAYMENT_REMINDER", "OPEN"]);
    expect(card.card?.payload).toMatchObject({ amount: 41195000, overdue: true, reminder: true });
    expect((await getConversation(S.tsm)).contexts.map((x) => x.kind)).toEqual([
      "ORDER",
      "CONTRACT",
    ]);
    const owed = chatState().installments.find((i) => i.id === S.o01Installment);
    if (!owed) throw new Error("seed");
    owed.paidAmount = owed.amount;
    const [status, code, message] = await refusal(sendTransferDetails({ id: S.tsm, ...args }));
    expect([status, code]).toEqual([409, "CHAT_CARD_ACTION_NOT_ALLOWED"]);
    expect(message).toMatch(/^Đợt thanh toán HD-\d{8}-910001-1 DOT2 không còn phải thu\.$/);
  });
});

describe("S21 / S23 / S24 — tìm kiếm, câu trả lời mẫu", () => {
  it("tìm bỏ dấu, gồm ghi chú nội bộ; 2..200 ký tự", async () => {
    const hits = await searchMessages({ q: "chiet khau" });
    expect(hits.items.map((h) => [h.message.kind, h.subject])).toEqual([
      ["INTERNAL_NOTE", "Đặt in cốc giấy 12oz"],
    ]);
    expect((await searchMessages({ q: "bao gia" })).totalElements).toBeGreaterThan(0);
    expect(await codeOf(searchMessages({ q: " a " }))).toEqual([400, "VALIDATION_FAILED"]);
  });

  it("mẫu dùng chung; xem trước điền {customerName} {agentName}", async () => {
    const list = await listCannedResponses();
    expect(list.map((r) => [r.title, r.shared])).toEqual([["Chào khách", true]]);
    expect(await listCannedResponses("không có")).toEqual([]);
    const preview = await previewCannedResponse({ id: S.tsm, cannedResponseId: S.cannedGreeting });
    expect(preview.text).toBe(
      "Chào Công ty CP Trà Sữa Mây, em là Trần Minh Quang bên StockFlow. Em có thể hỗ trợ gì cho anh/chị ạ?",
    );
  });
});

describe("S7 / S8 — file đính kèm (multipart)", () => {
  it("nhận PDF, từ chối định dạng khác; link tải của file vừa gửi", async () => {
    // jsdom không có `URL.createObjectURL`: thay tạm, trả lại ở cuối test
    const original = URL.createObjectURL;
    URL.createObjectURL = () => "blob:mock-chat";
    onTestFinished(() => {
      URL.createObjectURL = original;
    });
    const form = (file: File) => {
      const data = new FormData();
      data.append("file", file);
      data.append("clientMessageId", crypto.randomUUID());
      return data;
    };
    const post = (data: FormData) =>
      api.post<unknown>(`/chat/conversations/${S.ds02b}/attachments`, data, {
        headers: { "Content-Type": false },
      });
    const text = new File(["x"], "ghi-chu.txt", { type: "text/plain" });
    expect(await codeOf(post(form(text)))).toEqual([415, "UNSUPPORTED_MEDIA_TYPE"]);
    const pdf = new File(["%PDF-1.4"], "hop-dong-da-ky.pdf", { type: "application/pdf" });
    await post(form(pdf));
    const sent = (await listMessages(S.ds02b)).items[0];
    expect([sent?.kind, sent?.attachments[0]?.fileName]).toEqual([
      "ATTACHMENT",
      "hop-dong-da-ky.pdf",
    ]);
    const { data } = await api.get<{ url: string }>(
      `/chat/conversations/${S.ds02b}/attachments/${sent?.attachments[0]?.id ?? ""}/link`,
    );
    expect(data.url).toBe("blob:mock-chat");
  });
});
