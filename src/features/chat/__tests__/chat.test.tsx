import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CHAT_PERMISSIONS } from "@/constants";
import { formatMoney } from "@/lib/format/money";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { ChatConversationScreen, ChatInbox } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  QUOTE_ID,
  conversation,
  customerText,
  internalNote,
  messagePage,
  overview,
  quoteRequestCard,
} from "../__fixtures__/chat";
import { CONVERSATION_TRANSITIONS, staffConversationActions } from "../lifecycle";
import { chatConversationSchema } from "../schemas";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
/** `renderScreen` signs in as this user. */
const ME = "u-test";
const myConversation = { ...conversation, assignedAgentId: ME };

function renderConversation(
  items: unknown[],
  post: Record<string, (params: unknown, body?: unknown) => unknown> = {},
  customerOverview: unknown = overview,
) {
  const api = mockApi("SALES_STAFF", {
    get: {
      [BASE]: () => myConversation,
      [`${BASE}/messages`]: () => messagePage(items),
      [`/chat/customers/${CUSTOMER_ID}/overview`]: () => customerOverview,
    },
    post,
  });
  renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
  return api;
}

describe("TC-F13 phía Sale — thẻ và ghi chú", () => {
  it("thẻ QUOTE_REQUEST có CREATE_QUOTE trong staffActions → 'Lập báo giá' → mở báo giá nháp vừa tạo", async () => {
    const acted = quoteRequestCard([]);
    const api = renderConversation([quoteRequestCard(["CREATE_QUOTE"])], {
      [`${BASE}/cards/m-card/actions`]: () => ({
        ...acted,
        card: {
          ...acted.card,
          state: "ACTED",
          payload: { ...acted.card.payload, quoteId: QUOTE_ID, quoteNumber: "QT-1" },
        },
      }),
    });
    await userEvent.click(await screen.findByRole("button", { name: /Lập báo giá/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/cards/m-card/actions`, {
        action: "CREATE_QUOTE",
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/quotes/${QUOTE_ID}`));
  });

  it("thiết kế chưa duyệt (không có staffActions) → không có nút, hiện 'Chờ duyệt thiết kế'", async () => {
    renderConversation([quoteRequestCard([], "PENDING_REVIEW")]);
    expect(await screen.findByText("Chờ duyệt thiết kế")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Lập báo giá/ })).not.toBeInTheDocument();
  });

  it("thiết kế bị trả lại (DRAFT + returnReason) → 'Khách đang sửa thiết kế', không còn 'Chờ duyệt thiết kế'", async () => {
    const card = quoteRequestCard([], "DRAFT");
    renderConversation([
      {
        ...card,
        card: { ...card.card, payload: { ...card.card.payload, returnReason: "Thiếu vùng cắt" } },
      },
    ]);
    expect(await screen.findByText("Khách đang sửa thiết kế")).toBeInTheDocument();
    expect(screen.getByText(/Thiếu vùng cắt/)).toBeInTheDocument();
    expect(screen.queryByText("Chờ duyệt thiết kế")).not.toBeInTheDocument();
  });

  it("thiết kế DRAFT không có returnReason vẫn là 'Khách đang sửa thiết kế'", async () => {
    renderConversation([quoteRequestCard([], "DRAFT")]);
    expect(await screen.findByText("Khách đang sửa thiết kế")).toBeInTheDocument();
    expect(screen.queryByText("Chờ duyệt thiết kế")).not.toBeInTheDocument();
  });

  it("thiết kế đã xoá (ARCHIVED) → 'Thiết kế đã bị xoá', không còn 'Chờ duyệt thiết kế'", async () => {
    renderConversation([quoteRequestCard([], "ARCHIVED")]);
    expect(await screen.findByText("Thiết kế đã bị xoá")).toBeInTheDocument();
    expect(screen.queryByText("Chờ duyệt thiết kế")).not.toBeInTheDocument();
  });

  it("ghi chú nội bộ hiện riêng, ghi rõ 'Khách không thấy'; gửi ghi chú đi /notes", async () => {
    const api = renderConversation([internalNote, customerText], {
      [`${BASE}/notes`]: () => ({ ...internalNote, id: "m-new", seq: 4 }),
    });
    expect(await screen.findByText(/Khách không thấy/)).toBeInTheDocument();
    expect(screen.getByText("Em cần 60 thùng ạ")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Ghi chú nội bộ" }));
    await userEvent.type(screen.getByLabelText("Ghi chú nội bộ"), "Gọi lại chiều nay");
    await userEvent.click(screen.getByRole("button", { name: /Gửi$/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        `${BASE}/notes`,
        expect.objectContaining({ text: "Gọi lại chiều nay" }),
      ),
    );
  });

  it("gửi thẻ chuyển khoản cho đợt còn nợ → {installmentId, reminder}", async () => {
    const api = renderConversation([customerText], {
      [`${BASE}/cards/transfer-details`]: () => ({ ...customerText, id: "m-transfer" }),
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Gửi thông tin chuyển khoản" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText(/Đợt thanh toán/), "i-1");
    await userEvent.click(within(dialog).getByLabelText("Nhắc công nợ"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi thẻ" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/cards/transfer-details`, {
        installmentId: "i-1",
        reminder: true,
      }),
    );
  });
});

describe("hộp chuyển khoản — số còn phải thu (BE-6)", () => {
  it("hiện outstanding của BE khi đợt có giảm; thiếu outstanding mới tự tính", async () => {
    const [first] = overview.installments;
    renderConversation(
      [customerText],
      {},
      {
        ...overview,
        installments: [
          {
            ...first,
            id: "i-1",
            amount: 10_000_000,
            paidAmount: 0,
            reducedAmount: 2_000_000,
            outstanding: 8_000_000,
          },
          {
            ...first,
            id: "i-2",
            seq: 2,
            amount: 5_000_000,
            paidAmount: 1_000_000,
            reducedAmount: undefined,
            outstanding: undefined,
          },
        ],
      },
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Gửi thông tin chuyển khoản" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("option", { name: new RegExp(formatMoney(8_000_000, "VND")) }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("option", { name: new RegExp(formatMoney(4_000_000, "VND")) }),
    ).toBeInTheDocument();
  });
});

describe("Hộp thư", () => {
  it("lọc 'Của tôi' gửi mine=true, trang 0; hộp thư trống hiện EmptyState", async () => {
    const api = mockApi("SALES_STAFF", { get: { "/chat/conversations": () => bePage([]) } });
    renderScreen(<ChatInbox />, "SALES_STAFF", "?scope=mine");
    expect(await screen.findByText("Không tìm thấy hội thoại")).toBeInTheDocument();
    const call = api.get.mock.calls.find((c) => c[0] === "/chat/conversations")?.[1] as {
      params: URLSearchParams;
    };
    expect(call.params.get("mine")).toBe("true");
    expect(call.params.get("page")).toBe("0");
  });

  it("dòng hội thoại link tới chi tiết, nhãn trạng thái tiếng Việt", async () => {
    mockApi("SALES_STAFF", { get: { "/chat/conversations": () => bePage([conversation]) } });
    renderScreen(<ChatInbox />, "SALES_STAFF");
    expect(await screen.findByRole("link", { name: /Báo giá ly logo xanh/ })).toHaveAttribute(
      "href",
      `/admin/chat/${CONVERSATION_ID}`,
    );
    expect(screen.getAllByText("Đang trao đổi").length).toBeGreaterThan(0);
  });
});

describe("vòng đời hội thoại (docs 16 §5) — 3 vai", () => {
  const parsed = chatConversationSchema.parse(conversation);
  it("CLOSED là trạng thái cuối", () => {
    expect(CONVERSATION_TRANSITIONS.CLOSED).toEqual([]);
  });
  it("Sale (UPDATE): trả lời + đổi theo nextStatuses; chỉ đọc: không nút; hội thoại mới: nhận", () => {
    const sale = staffConversationActions(parsed, ME, () => true);
    expect(sale.reply).toBe(true);
    expect(sale.moves).toEqual([
      "WAITING_ON_CUSTOMER",
      "WAITING_ON_INTERNAL",
      "ESCALATED",
      "RESOLVED",
    ]);
    const viewer = staffConversationActions(parsed, ME, (code) => code === CHAT_PERMISSIONS.read);
    expect(viewer).toEqual({ claim: false, reply: false, note: false, moves: [] });
    expect(
      staffConversationActions(
        { status: "QUEUED", nextStatuses: [], assignedAgentId: null },
        ME,
        () => true,
      ).claim,
    ).toBe(true);
  });
  it("hội thoại đã kết thúc: không trả lời khách, vẫn ghi chú nội bộ (16 BR-07)", () => {
    const closed = staffConversationActions(
      { status: "RESOLVED", nextStatuses: [], assignedAgentId: ME },
      ME,
      () => true,
    );
    expect(closed.reply).toBe(false);
    expect(closed.note).toBe(true);
  });
});
