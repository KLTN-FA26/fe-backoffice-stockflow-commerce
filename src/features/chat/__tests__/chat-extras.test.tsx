import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, CHAT_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";
import { NAV_GROUPS } from "@/components/backoffice/BackofficeShell";
import { ROLE_PERMISSIONS, apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";
import { pickOption } from "@/test/ui-actions";

import { AgentsReportScreen, CannedResponsesScreen, ChatConversationScreen, ChatInbox } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  QUOTE_ID,
  conversation,
  customerText,
  messagePage,
  overview,
} from "../__fixtures__/chat";
import { chatMessageSchema } from "../schemas";
import { csatShares, defaultReportRange, reportRangeError } from "../selectors";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  // jsdom has no ResizeObserver / scrollIntoView, which `cmdk` (customer picker) uses
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

/** `ROLE_PERMISSIONS.SALES_STAFF` is shared across test files: every change is undone in `afterEach`. */
const salesStaff = ROLE_PERMISSIONS.SALES_STAFF as string[];
const original = [...salesStaff];
function grant(...codes: string[]) {
  salesStaff.push(...codes);
}
function revoke(code: string) {
  salesStaff.splice(0, salesStaff.length, ...salesStaff.filter((c) => c !== code));
}
afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
  salesStaff.splice(0, salesStaff.length, ...original);
});

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
const CANNED = "/chat/canned-responses";
const CANNED_ALL = [
  CHAT_PERMISSIONS.cannedViewPage,
  CHAT_PERMISSIONS.cannedCreate,
  CHAT_PERMISSIONS.cannedUpdate,
  CHAT_PERMISSIONS.cannedDelete,
];

describe("chatMessageSchema", () => {
  it("giữ trường mentions (không để zod bỏ mất); thiếu thì là mảng rỗng", () => {
    const base = { ...customerText, kind: "INTERNAL_NOTE", visibility: "STAFF" };
    expect(chatMessageSchema.parse({ ...base, mentions: ["u1", "u2"] }).mentions).toEqual([
      "u1",
      "u2",
    ]);
    const { mentions: _omitted, ...without } = base as typeof base & { mentions?: string[] };
    expect(chatMessageSchema.parse(without).mentions).toEqual([]);
  });
});

describe("ảnh đính kèm trong tin", () => {
  const image = {
    id: "att-img",
    fileName: "mau-in.png",
    contentType: "image/png",
    sizeBytes: 1200,
  };
  const pdf = {
    id: "att-pdf",
    fileName: "bao-gia.pdf",
    contentType: "application/pdf",
    sizeBytes: 9000,
  };

  function renderWithFiles(attachments: unknown[]) {
    return mockApi("SALES_STAFF", {
      get: {
        [BASE]: () => ({ ...conversation, assignedAgentId: "u-test" }),
        [`${BASE}/messages`]: () => messagePage([{ ...customerText, body: null, attachments }]),
        [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
        [`${BASE}/attachments/att-img/link`]: () => ({
          url: "https://files.example/mau-in.png",
          expiresAt: "2099-01-01T00:00:00Z",
        }),
      },
    });
  }

  it("ảnh → lấy link rồi hiện <img alt=tên file>; bấm mở ảnh lớn; vẫn có nút tải", async () => {
    const api = renderWithFiles([image]);
    renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
    const thumbnail = await screen.findByRole("img", { name: "mau-in.png" });
    expect(thumbnail).toHaveAttribute("src", "https://files.example/mau-in.png");
    expect(api.get.mock.calls.some(([url]) => url === `${BASE}/attachments/att-img/link`)).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "mau-in.png" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Xem ảnh lớn mau-in.png" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img", { name: "mau-in.png" })).toBeInTheDocument();
  });

  it("ảnh lỗi tải → nút Lấy link mới không nằm trong nút khác và không mở ảnh lớn", async () => {
    renderWithFiles([image]);
    renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
    fireEvent.error(await screen.findByRole("img", { name: "mau-in.png" }));
    const retry = await screen.findByRole("button", { name: "Lấy link mới" });
    expect(retry.parentElement?.closest("button")).toBeNull();
    await userEvent.click(retry);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("PDF → chỉ nút tải, không xin link xem trước", async () => {
    const api = renderWithFiles([pdf]);
    renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
    expect(await screen.findByRole("button", { name: /bao-gia\.pdf/ })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => String(url).includes("/attachments/"))).toBe(false);
  });

  it("không lấy được link → câu lỗi tại chỗ, tên file vẫn bấm tải được", async () => {
    mockApi("SALES_STAFF", {
      get: {
        [BASE]: () => ({ ...conversation, assignedAgentId: "u-test" }),
        [`${BASE}/messages`]: () =>
          messagePage([{ ...customerText, body: null, attachments: [image] }]),
        [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
        [`${BASE}/attachments/att-img/link`]: () => {
          throw apiError(500, "INTERNAL_ERROR");
        },
      },
    });
    renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
    expect(await screen.findByRole("button", { name: "mau-in.png" })).toBeInTheDocument();
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("Mở hội thoại mới", () => {
  const MOC_AN = {
    customerId: CUSTOMER_ID,
    fullName: "Công ty Mộc An",
    email: "mua@mocan.vn",
    taxCode: "0312345678",
    status: "ACTIVE",
  };
  const withQuote = {
    ...overview,
    quotes: [{ id: QUOTE_ID, customerId: CUSTOMER_ID, number: "QT-20261120-9001", status: "SENT" }],
  };

  function renderInbox(post: (params: unknown, body?: unknown) => unknown) {
    const spy = mockApi("SALES_STAFF", {
      get: {
        "/chat/conversations": () => bePage([]),
        "/customers": () => bePage([MOC_AN]),
        [`/customers/${CUSTOMER_ID}`]: () => MOC_AN,
        [`/chat/customers/${CUSTOMER_ID}/overview`]: () => withQuote,
        "/chat/unread-count": () => ({ conversations: 0, messages: 0, queued: 0 }),
      },
      post: { "/chat/conversations": post },
    });
    renderScreen(<ChatInbox />, "SALES_STAFF");
    return spy;
  }

  async function pickCustomer() {
    await userEvent.click(await screen.findByRole("button", { name: /Mở hội thoại mới/ }));
    const box = await screen.findByRole("combobox", { name: "Khách hàng" });
    await userEvent.type(box, "Mộc");
    await userEvent.click(await screen.findByRole("option", { name: /Công ty Mộc An/ }));
  }

  it("chọn khách + chứng từ + tin đầu → POST đúng body rồi mở hội thoại vừa tạo", async () => {
    const created = { ...conversation, id: "new-conv", assignedAgentId: "u-test" };
    const spy = renderInbox(() => created);
    await pickCustomer();
    await userEvent.type(screen.getByLabelText("Chủ đề"), "Báo giá ly");
    await pickOption(
      userEvent.setup(),
      await screen.findByLabelText("Chứng từ"),
      /QT-20261120-9001/,
    );
    await userEvent.type(screen.getByLabelText("Tin đầu tiên"), "Chào anh, em gửi báo giá");
    await userEvent.click(screen.getByRole("button", { name: "Mở hội thoại" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.chat.detail("new-conv")));
    const call = spy.post.mock.calls.find(([url]) => url === "/chat/conversations");
    expect(call?.[1]).toEqual({
      customerId: CUSTOMER_ID,
      subject: "Báo giá ly",
      contextKind: "QUOTE",
      contextId: QUOTE_ID,
      text: "Chào anh, em gửi báo giá",
      clientMessageId: expect.any(String),
    });
  });

  it("chỉ chọn khách → body chỉ có customerId (không chủ đề / chứng từ / tin rỗng)", async () => {
    const spy = renderInbox(() => ({ ...conversation, id: "new-conv" }));
    await pickCustomer();
    await userEvent.click(screen.getByRole("button", { name: "Mở hội thoại" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(spy.post.mock.calls.find(([url]) => url === "/chat/conversations")?.[1]).toEqual({
      customerId: CUSTOMER_ID,
    });
  });

  it("404 CHAT_CONTEXT_NOT_FOUND → câu lỗi trong hộp thoại, không chuyển trang", async () => {
    renderInbox(() => {
      throw apiError(404, "CHAT_CONTEXT_NOT_FOUND");
    });
    await pickCustomer();
    await userEvent.click(screen.getByRole("button", { name: "Mở hội thoại" }));
    expect(await screen.findByText("Chứng từ này không thuộc khách đã chọn.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("thiếu quyền chat-conversations:CREATE → không có nút", async () => {
    revoke(CHAT_PERMISSIONS.create);
    renderInbox(() => ({}));
    expect(
      await screen.findByRole("heading", { name: "Hộp thư chat", hidden: true }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mở hội thoại mới/ })).not.toBeInTheDocument();
  });
});

describe("Câu trả lời mẫu", () => {
  const own = {
    id: "cr-own",
    title: "Chào khách",
    body: "Xin chào {customerName}",
    shortcut: "chao",
    category: "Mở đầu",
    shared: false,
    ownerId: "u-test",
    version: 3,
  };
  const team = {
    ...own,
    id: "cr-team",
    title: "Giờ làm việc",
    shortcut: null,
    shared: true,
    ownerId: null,
    version: 1,
  };

  function renderCanned(extra: { put?: () => unknown; post?: () => unknown } = {}) {
    const spy = mockApi("SALES_STAFF", {
      get: { [CANNED]: () => [team, own] },
      post: { [CANNED]: extra.post ?? (() => own) },
      put: { [`${CANNED}/cr-own`]: extra.put ?? (() => own) },
    });
    renderScreen(<CannedResponsesScreen />, "SALES_STAFF");
    return spy;
  }

  it("liệt kê mẫu của mình và mẫu dùng chung; lọc gửi q và category lên BE", async () => {
    grant(...CANNED_ALL.slice(0, 1));
    const spy = mockApi("SALES_STAFF", { get: { [CANNED]: () => [team, own] } });
    renderScreen(
      <CannedResponsesScreen />,
      "SALES_STAFF",
      "?q=chao&category=M%E1%BB%9F%20%C4%91%E1%BA%A7u",
    );
    expect(await screen.findByText("Chào khách")).toBeInTheDocument();
    expect(screen.getByText("Giờ làm việc")).toBeInTheDocument();
    expect(screen.getByText("Dùng chung")).toBeInTheDocument();
    const call = spy.get.mock.calls.find(([url]) => url === CANNED);
    expect((call?.[1] as { params: unknown }).params).toEqual({ q: "chao", category: "Mở đầu" });
  });

  it("không có mẫu → trạng thái rỗng; BE lỗi → câu lỗi + Thử lại", async () => {
    grant(CHAT_PERMISSIONS.cannedViewPage);
    let fail = true;
    mockApi("SALES_STAFF", {
      get: {
        [CANNED]: () => {
          if (fail) throw apiError(500, "INTERNAL_ERROR");
          return [];
        },
      },
    });
    renderScreen(<CannedResponsesScreen />, "SALES_STAFF");
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    fail = false;
    await userEvent.click(retry);
    expect(await screen.findByText("Chưa có câu trả lời mẫu")).toBeInTheDocument();
  });

  it("thiếu chat-canned-responses:VIEW_PAGE → bị chặn (SALES_STAFF mặc định chưa có trong test)", async () => {
    mockApi("SALES_STAFF", { get: { [CANNED]: () => [] } });
    renderScreen(<CannedResponsesScreen />, "SALES_STAFF");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có câu trả lời mẫu")).not.toBeInTheDocument();
  });

  it("thêm → POST đúng body (khoảng trắng cắt, phím tắt chữ thường); không có ô Dùng chung", async () => {
    grant(...CANNED_ALL);
    const spy = renderCanned();
    await userEvent.click(await screen.findByRole("button", { name: /Thêm câu mẫu/ }));
    expect(screen.queryByLabelText(/Dùng chung/)).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Tiêu đề/), "  Cảm ơn  ");
    await userEvent.type(screen.getByLabelText(/Nội dung/), "Cảm ơn {{customerName}");
    await userEvent.type(screen.getByLabelText("Phím tắt"), "Cam-On");
    await userEvent.click(screen.getByRole("button", { name: "Thêm" }));
    await waitFor(() => expect(spy.post).toHaveBeenCalledWith(CANNED, expect.anything()));
    expect(spy.post.mock.calls.find(([url]) => url === CANNED)?.[1]).toEqual({
      title: "Cảm ơn",
      body: "Cảm ơn {customerName}",
      shortcut: "cam-on",
    });
  });

  it("phím tắt sai luật → báo lỗi ở ô, không gọi POST", async () => {
    grant(...CANNED_ALL);
    const spy = renderCanned();
    await userEvent.click(await screen.findByRole("button", { name: /Thêm câu mẫu/ }));
    await userEvent.type(screen.getByLabelText(/Tiêu đề/), "A");
    await userEvent.type(screen.getByLabelText(/Nội dung/), "B");
    await userEvent.type(screen.getByLabelText("Phím tắt"), "-sai khoảng trắng");
    await userEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(await screen.findByText(/Phím tắt gồm 1–32/)).toBeInTheDocument();
    expect(spy.post.mock.calls.some(([url]) => url === CANNED)).toBe(false);
  });

  it("người giám sát thấy ô Dùng chung và gửi shared:true", async () => {
    grant(...CANNED_ALL, CHAT_PERMISSIONS.supervise);
    const spy = renderCanned();
    await userEvent.click(await screen.findByRole("button", { name: /Thêm câu mẫu/ }));
    await userEvent.type(screen.getByLabelText(/Tiêu đề/), "Chính sách");
    await userEvent.type(screen.getByLabelText(/Nội dung/), "Nội dung chính sách");
    await userEvent.click(screen.getByRole("checkbox", { name: /Dùng chung/ }));
    await userEvent.click(screen.getByRole("button", { name: "Thêm" }));
    await waitFor(() => expect(spy.post).toHaveBeenCalledWith(CANNED, expect.anything()));
    expect(spy.post.mock.calls.find(([url]) => url === CANNED)?.[1]).toMatchObject({
      shared: true,
    });
  });

  it("sửa → PUT kèm version đã đọc; mẫu dùng chung không có nút Sửa / Xoá với Sale thường", async () => {
    grant(...CANNED_ALL);
    const spy = renderCanned();
    await screen.findByText("Chào khách");
    expect(screen.queryByRole("button", { name: "Sửa Giờ làm việc" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Xoá Giờ làm việc" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sửa Chào khách" }));
    const title = screen.getByLabelText(/Tiêu đề/);
    await userEvent.clear(title);
    await userEvent.type(title, "Chào khách mới");
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(spy.put).toHaveBeenCalled());
    expect(spy.put).toHaveBeenCalledWith(
      `${CANNED}/cr-own`,
      expect.objectContaining({ title: "Chào khách mới", version: 3 }),
    );
  });

  it("OPTIMISTIC_LOCK khi sửa → câu báo mẫu đã đổi, hộp thoại giữ nguyên", async () => {
    grant(...CANNED_ALL);
    renderCanned({
      put: () => {
        throw apiError(409, "OPTIMISTIC_LOCK", undefined, "Câu trả lời mẫu đã đổi, hãy tải lại.");
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Sửa Chào khách" }));
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    expect(await screen.findByText("Câu trả lời mẫu đã đổi, hãy tải lại.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu" })).toBeInTheDocument();
  });

  it("giám sát sửa mẫu dùng chung → không có ô Dùng chung, PUT không mang shared", async () => {
    grant(...CANNED_ALL, CHAT_PERMISSIONS.supervise);
    const spy = mockApi("SALES_STAFF", {
      get: { [CANNED]: () => [team, own] },
      put: { [`${CANNED}/cr-team`]: () => team },
    });
    renderScreen(<CannedResponsesScreen />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("button", { name: "Sửa Giờ làm việc" }));
    expect(screen.queryByRole("checkbox", { name: /Dùng chung/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(spy.put).toHaveBeenCalled());
    expect(spy.put.mock.calls[0]?.[1]).not.toHaveProperty("shared");
  });

  it("xoá → xác nhận rồi DELETE; người giám sát xoá được cả mẫu dùng chung", async () => {
    grant(...CANNED_ALL, CHAT_PERMISSIONS.supervise);
    renderCanned();
    const remove = vi.spyOn(api, "delete").mockResolvedValue({ data: null });
    await userEvent.click(await screen.findByRole("button", { name: "Xoá Giờ làm việc" }));
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Xoá" }),
    );
    await waitFor(() => expect(remove).toHaveBeenCalledWith(`${CANNED}/cr-team`));
  });
});

describe("Báo cáo chat theo Sale", () => {
  const figures = {
    agentId: "a1",
    agentName: "Sale An",
    conversations: 10,
    answered: 9,
    averageFirstResponseMinutes: 4.5,
    firstResponsesOverdue: 2,
    resolved: 7,
    averageResolutionHours: 12.25,
    csatCount: 4,
    csatAverage: 4.5,
    csatDistribution: { "1": 0, "2": 0, "3": 0, "4": 2, "5": 2 },
  };
  const report = {
    from: "2026-11-01",
    to: "2026-11-20",
    total: { ...figures, agentId: undefined, agentName: undefined, conversations: 12 },
    agents: [
      figures,
      {
        ...figures,
        agentId: "a2",
        agentName: "Sale Bình",
        conversations: 2,
        csatAverage: undefined,
      },
    ],
  };
  const REPORT_URL = "/chat/reports/agents";

  it("có chat-supervision:READ → GET đúng khoảng ngày, bảng theo Sale + dòng tổng + phân bố CSAT", async () => {
    grant(CHAT_PERMISSIONS.superviseRead);
    const spy = mockApi("SALES_STAFF", { get: { [REPORT_URL]: () => report } });
    renderScreen(<AgentsReportScreen />, "SALES_STAFF", "?from=2026-11-01&to=2026-11-20");
    expect(await screen.findByText("Sale An")).toBeInTheDocument();
    expect(screen.getByText("Sale Bình")).toBeInTheDocument();
    expect(screen.getByText("Tất cả")).toBeInTheDocument();
    expect(screen.getAllByText("4,5").length).toBeGreaterThan(0);
    expect(screen.getAllByText("12,3").length).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: "Phân bố CSAT" })).toBeInTheDocument();
    const call = spy.get.mock.calls.find(([url]) => url === REPORT_URL);
    expect((call?.[1] as { params: unknown }).params).toEqual({
      from: "2026-11-01",
      to: "2026-11-20",
    });
  });

  it("thiếu chat-supervision:READ → bị chặn, không gọi BE", async () => {
    const spy = mockApi("SALES_STAFF", { get: { [REPORT_URL]: () => report } });
    renderScreen(<AgentsReportScreen />, "SALES_STAFF");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(spy.get.mock.calls.some(([url]) => url === REPORT_URL)).toBe(false);
  });

  it("khoảng quá 366 ngày → báo lỗi tại chỗ, không gọi BE", async () => {
    grant(CHAT_PERMISSIONS.superviseRead);
    const spy = mockApi("SALES_STAFF", { get: { [REPORT_URL]: () => report } });
    renderScreen(<AgentsReportScreen />, "SALES_STAFF", "?from=2025-01-01&to=2026-11-20");
    expect(await screen.findByText("Khoảng ngày tối đa 366 ngày.")).toBeInTheDocument();
    expect(spy.get.mock.calls.some(([url]) => url === REPORT_URL)).toBe(false);
  });

  it("không có hội thoại → trạng thái rỗng; BE lỗi → Thử lại", async () => {
    grant(CHAT_PERMISSIONS.superviseRead);
    let fail = true;
    mockApi("SALES_STAFF", {
      get: {
        [REPORT_URL]: () => {
          if (fail) throw apiError(500, "INTERNAL_ERROR");
          return { ...report, agents: [] };
        },
      },
    });
    renderScreen(<AgentsReportScreen />, "SALES_STAFF", "?from=2026-11-01&to=2026-11-20");
    const retry = await screen.findByRole("button", { name: "Thử lại" });
    fail = false;
    await userEvent.click(retry);
    expect(await screen.findByText("Chưa có số liệu")).toBeInTheDocument();
  });
});

describe("khoảng ngày và CSAT (thuần)", () => {
  it("mặc định 30 ngày tính tới hôm nay theo giờ Việt Nam", () => {
    // 2026-11-20 18:00 UTC is already 21 Nov in Ho Chi Minh
    expect(defaultReportRange(new Date("2026-11-20T18:00:00Z"))).toEqual({
      from: "2026-10-23",
      to: "2026-11-21",
    });
  });

  it("hợp lệ: 1 ngày và đúng 366 ngày chênh; sai: đảo ngược, 367 ngày, thiếu ngày", () => {
    expect(reportRangeError("2026-11-20", "2026-11-20")).toBeNull();
    expect(reportRangeError("2025-11-20", "2026-11-21")).toBeNull();
    expect(reportRangeError("2026-11-21", "2026-11-20")).toMatch(/sau hoặc bằng/);
    expect(reportRangeError("2025-11-20", "2026-11-22")).toMatch(/tối đa 366/);
    expect(reportRangeError("", "2026-11-20")).toMatch(/Chọn đủ/);
  });

  it("phân bố CSAT: tỉ lệ theo tổng; không có đánh giá → 0", () => {
    expect(csatShares({ "4": 1, "5": 3 }).map((row) => row.share)).toEqual([0, 0, 0, 0.25, 0.75]);
    expect(csatShares({}).every((row) => row.share === 0)).toBe(true);
  });
});

describe("menu", () => {
  it("câu mẫu và báo cáo có mục menu riêng, mỗi mục gate theo quyền của nó", () => {
    const items = NAV_GROUPS.flatMap((group) => group.items);
    expect(items.find((item) => item.href === ADMIN_ROUTES.chat.canned)?.permission).toBe(
      CHAT_PERMISSIONS.cannedViewPage,
    );
    expect(items.find((item) => item.href === ADMIN_ROUTES.chat.agentsReport)?.permission).toBe(
      "chat-supervision:READ",
    );
  });
});
