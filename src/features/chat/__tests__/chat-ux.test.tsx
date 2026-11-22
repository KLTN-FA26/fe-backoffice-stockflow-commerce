import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { formatDate } from "@/lib/format/date";
import { bePage, mockApi, renderScreen } from "@/test/api-screen";

import { ChatConversationScreen, ChatInbox } from "..";
import {
  CONVERSATION_ID,
  CUSTOMER_ID,
  conversation,
  customerText,
  messagePage,
  overview,
} from "../__fixtures__/chat";
import { cardKindLabel, cardStateView, transferViewFromCard } from "../card-view";
import { chatCardSchema, chatMessageSchema } from "../schemas";
import { newMessageAnnouncement, useNewMessageAnnouncer } from "../use-chat-scroll";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  // jsdom has no ResizeObserver, which the Radix menu (popper) measures with.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => vi.restoreAllMocks());

const BASE = `/chat/conversations/${CONVERSATION_ID}`;
const ME = "u-test";
const myConversation = { ...conversation, assignedAgentId: ME };
const VIET_QR =
  "00020101021238540010A00000072701240006970000011000000000000208QRIBFTTA53037045408150000005802VN62230819HD-DEMO-0001-1 DOT163044EDE";

const card = (kind: string, state: string, payload: Record<string, unknown>, seq = 10) => ({
  ...customerText,
  id: `m-${kind}-${seq}`,
  seq,
  kind: "CARD",
  senderType: "SYSTEM",
  senderName: undefined,
  body: kind,
  card: { kind, state, payload, customerActions: [], staffActions: [] },
});

const transferPayload = {
  installmentId: "i-1",
  contractNumber: "HD-DEMO-0001-1",
  orderId: "o-1",
  seq: 1,
  name: "Đợt 1 - đặt cọc",
  amount: 15_000_000,
  currency: "VND",
  dueDate: "2026-11-16",
  transferContent: "HD-DEMO-0001-1 DOT1",
  bank: {
    bankName: "DEMO BANK",
    bankBin: "970000",
    accountNumber: "0123456789",
    accountName: "CONG TY DEMO",
  },
  vietQr: VIET_QR,
};

function renderConversation(
  items: unknown[],
  routes: {
    get?: Record<string, (params: unknown) => unknown>;
    post?: Record<string, (params: unknown, body?: unknown) => unknown>;
  } = {},
) {
  const api = mockApi("SALES_STAFF", {
    get: {
      [BASE]: () => myConversation,
      [`${BASE}/messages`]: () => messagePage(items),
      [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview,
      ...routes.get,
    },
    post: routes.post,
  });
  renderScreen(<ChatConversationScreen id={CONVERSATION_ID} />, "SALES_STAFF");
  return api;
}

describe("BO-UX-43 — the composer says where the text goes", () => {
  it("reply mode: banner + 'Gửi cho khách'; note mode: banner + 'Lưu ghi chú nội bộ', described on the field", async () => {
    renderConversation([customerText]);
    const reply = await screen.findByLabelText("Tin nhắn cho khách");
    expect(reply).toHaveAccessibleDescription("Đang trả lời khách — khách sẽ đọc được tin này.");
    expect(screen.getByRole("button", { name: "Gửi cho khách" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Ghi chú nội bộ" }));
    const note = screen.getByLabelText("Ghi chú nội bộ");
    expect(note).toHaveAccessibleDescription(
      "Ghi chú nội bộ — chỉ nhân viên thấy, khách không thấy.",
    );
    expect(screen.getByRole("button", { name: "Lưu ghi chú nội bộ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gửi cho khách" })).not.toBeInTheDocument();
  });

  it("an @mention typed in a reply warns, and one click turns it into a note", async () => {
    renderConversation([customerText]);
    await userEvent.type(await screen.findByLabelText("Tin nhắn cho khách"), "@Lan xem giá vốn");
    const warning = screen.getByRole("status");
    expect(warning).toHaveTextContent("có @nhắc đồng nghiệp");
    await userEvent.click(
      within(warning).getByRole("button", { name: "Chuyển sang ghi chú nội bộ" }),
    );
    expect(screen.getByLabelText("Ghi chú nội bộ")).toHaveValue("@Lan xem giá vốn");
    expect(screen.queryByText(/có @nhắc đồng nghiệp/)).not.toBeInTheDocument();
  });

  it("an e-mail address is not a mention", async () => {
    renderConversation([customerText]);
    await userEvent.type(
      await screen.findByLabelText("Tin nhắn cho khách"),
      "Gửi về ke.toan@demo.vn ạ",
    );
    expect(screen.queryByText(/có @nhắc đồng nghiệp/)).not.toBeInTheDocument();
  });
});

describe("BO-UX-44 — status moves are verbs in one menu; resolving is confirmed", () => {
  it("lists the moves as verbs and posts the one chosen", async () => {
    const api = renderConversation([customerText], {
      post: { [`${BASE}/status`]: () => ({ ...myConversation, status: "WAITING_ON_CUSTOMER" }) },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Đổi trạng thái" }));
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Chuyển sang chờ khách",
      "Chuyển sang chờ nội bộ",
      "Chuyển cấp cho quản lý…",
      "Đánh dấu đã giải quyết…",
    ]);
    // No button named like a status badge any more.
    expect(screen.queryByRole("button", { name: "Đã giải quyết" })).not.toBeInTheDocument();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Chuyển sang chờ khách" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/status`, { status: "WAITING_ON_CUSTOMER" }),
    );
  });

  it("'Đánh dấu đã giải quyết…' asks first; going back sends nothing, confirming sends RESOLVED", async () => {
    const api = renderConversation([customerText], {
      post: { [`${BASE}/status`]: () => ({ ...myConversation, status: "RESOLVED" }) },
    });
    const openMenu = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Đổi trạng thái" }));
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Đánh dấu đã giải quyết…" }),
      );
      return screen.findByRole("dialog", { name: "Đánh dấu hội thoại đã giải quyết?" });
    };
    await userEvent.click(within(await openMenu()).getByRole("button", { name: "Quay lại" }));
    expect(api.post).not.toHaveBeenCalledWith(`${BASE}/status`, expect.anything());
    await userEvent.click(
      within(await openMenu()).getByRole("button", { name: "Đánh dấu đã giải quyết" }),
    );
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/status`, { status: "RESOLVED" }),
    );
  });
});

describe("BO-UX-45 — transfer details, previewed and shown to the staff", () => {
  it("the dialog previews the card the customer will get before it is sent", async () => {
    const api = renderConversation([customerText], {
      get: {
        "/installments/i-1/transfer-instructions": () => ({
          installmentId: "i-1",
          contractNumber: "HD-20261120-900001-1",
          seq: 1,
          name: "Đặt cọc khi ký",
          bankName: "DEMO BANK",
          accountNumber: "0123456789",
          accountName: "CONG TY DEMO",
          amountDue: 23_265_000,
          currency: "VND",
          reference: "HD-20261120-900001-1 DOT1",
          dueDate: "2026-11-21",
          vietQr: VIET_QR,
        }),
      },
      post: { [`${BASE}/cards/transfer-details`]: () => ({ ...customerText, id: "m-t" }) },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Gửi thông tin chuyển khoản" }),
    );
    const dialog = await screen.findByRole("dialog");
    const preview = within(dialog).getByRole("region", { name: "Khách sẽ nhận thẻ này" });
    expect(preview).toHaveTextContent("Chọn đợt để xem trước thẻ.");
    await userEvent.selectOptions(within(dialog).getByLabelText(/Đợt thanh toán/), "i-1");
    expect(await within(preview).findByText("DEMO BANK")).toBeInTheDocument();
    expect(preview).toHaveTextContent("0123456789");
    expect(preview).toHaveTextContent("CONG TY DEMO");
    expect(preview).toHaveTextContent("23.265.000");
    expect(preview).toHaveTextContent("HD-20261120-900001-1 DOT1");
    expect(
      within(preview).getByRole("img", { name: "Mã VietQR chuyển khoản" }),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Gửi thẻ cho khách" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`${BASE}/cards/transfer-details`, {
        installmentId: "i-1",
        reminder: false,
      }),
    );
  });

  it("a preview that cannot be read says so and still lets Sales send", async () => {
    renderConversation([customerText], {
      get: {
        "/installments/i-1/transfer-instructions": () => {
          throw new Error("down");
        },
      },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: "Gửi thông tin chuyển khoản" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText(/Đợt thanh toán/), "i-1");
    expect(await within(dialog).findByText(/Không tải được bản xem trước/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Gửi thẻ cho khách" })).toBeEnabled();
  });

  it("a PAYMENT_INFO card shows the staff the bank, account, holder, amount, content and VietQR", async () => {
    renderConversation([card("PAYMENT_INFO", "OPEN", transferPayload)]);
    const qr = await screen.findByRole("img", { name: "Mã VietQR chuyển khoản" });
    const body = qr.closest("li");
    expect(body).toHaveTextContent("DEMO BANK");
    expect(body).toHaveTextContent("0123456789");
    expect(body).toHaveTextContent("CONG TY DEMO");
    expect(body).toHaveTextContent("15.000.000");
    expect(body).toHaveTextContent("HD-DEMO-0001-1 DOT1");
    expect(body).toHaveTextContent("HD-DEMO-0001-1 — đợt 1 Đợt 1 - đặt cọc");
  });

  it("reads the same fields from a card without a bank (not configured) and without a QR", () => {
    const view = transferViewFromCard(
      chatCardSchema.parse({
        kind: "PAYMENT_REMINDER",
        state: "OPEN",
        payload: { ...transferPayload, bank: null, vietQr: null },
      }),
    );
    expect(view).toMatchObject({ bankName: null, accountNumber: null, vietQr: null });
    expect(view.amount).toBe(15_000_000);
  });
});

describe("BO-UX-48 / BO-UX-6 — card state as a status dot, no raw codes", () => {
  it("quote card: state 'Khách đã chấp nhận', its status and validity; contract card links 'Mở hợp đồng'", async () => {
    renderConversation([
      card(
        "QUOTE",
        "ACTED",
        {
          quoteId: "q-1",
          number: "QT-1",
          status: "ACCEPTED",
          validUntil: "2026-12-07T16:59:59Z",
          acceptedTotal: 28_620_000,
          currency: "VND",
        },
        11,
      ),
      card("CONTRACT", "OPEN", { number: "HD-1", status: "SENT", orderId: "o-1" }, 12),
    ]);
    expect(await screen.findByText("Khách đã chấp nhận")).toBeInTheDocument();
    expect(
      screen.getByText(`Đã chấp nhận · hiệu lực đến ${formatDate("2026-12-07T16:59:59Z")}`),
    ).toBeInTheDocument();
    const contract = screen.getByRole("link", { name: "Mở hợp đồng" });
    expect(contract).toHaveAttribute("href", "/admin/orders/o-1#contract");
    expect(screen.queryByRole("link", { name: "Mở đơn" })).not.toBeInTheDocument();
  });

  it("an unknown kind or state reads as a neutral Vietnamese label, never the code", () => {
    expect(cardKindLabel("NEW_KIND_X")).toBe("Thẻ");
    expect(cardStateView({ kind: "QUOTE", state: "WEIRD_STATE" }).label).toBe(
      "Không rõ trạng thái",
    );
    expect(cardStateView({ kind: "CONTRACT", state: "ACTED" }).label).toBe("Đã ký");
    expect(cardStateView({ kind: "INVOICE", state: "SUPERSEDED" }).label).toBe(
      "Đã thay bằng bản mới",
    );
  });

  it("a quote request with an unknown design status shows a neutral label", async () => {
    renderConversation([
      card(
        "QUOTE_REQUEST",
        "OPEN",
        { scope: "DESIGN", designName: "Ly A", cartons: 10, designStatus: "SOMETHING_NEW" },
        13,
      ),
    ]);
    expect(await screen.findByText(/Chưa rõ trạng thái thiết kế/)).toBeInTheDocument();
    expect(screen.queryByText(/SOMETHING_NEW/)).not.toBeInTheDocument();
  });
});

describe("BO-UX-46 — the message list is reachable and labelled", () => {
  it("the scroll region takes keyboard focus and has a name; a polite log exists for new messages", async () => {
    renderConversation([customerText]);
    const region = await screen.findByRole("region", { name: "Tin nhắn của hội thoại" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("log", { name: "Tin mới" })).toHaveAttribute("aria-live", "polite");
    // The history the list opened with is not read out.
    expect(screen.getByRole("log", { name: "Tin mới" })).toBeEmptyDOMElement();
  });
});

describe("BO-UX-46 — new messages are announced, once, and only others'", () => {
  const msg = (over: Record<string, unknown>) =>
    chatMessageSchema.parse({ ...customerText, ...over });

  it("announces a message that arrives after the list opened, not the history nor my own", () => {
    const opened = msg({});
    const { result, rerender } = renderHook(({ newest }) => useNewMessageAnnouncer(newest, ME), {
      initialProps: { newest: opened },
    });
    expect(result.current).toEqual([]);
    act(() => rerender({ newest: msg({ id: "m-4", seq: 4, body: "Cho em xin báo giá nhé" }) }));
    expect(result.current).toEqual(["Tin mới từ Khách hàng demo: Cho em xin báo giá nhé"]);
    act(() => rerender({ newest: msg({ id: "m-5", seq: 5, senderId: ME, senderType: "AGENT" }) }));
    expect(result.current).toHaveLength(1);
    // An older page loaded on request does not move the newest message: nothing new to say.
    act(() => rerender({ newest: msg({ id: "m-4", seq: 4, body: "Cho em xin báo giá nhé" }) }));
    expect(result.current).toHaveLength(1);
  });

  it("names a card or a file when there is no text, and cuts long text", () => {
    expect(
      newMessageAnnouncement(
        msg({
          senderName: undefined,
          senderType: "SYSTEM",
          body: undefined,
          card: { kind: "QUOTE", state: "OPEN" },
        }),
      ),
    ).toBe("Tin mới từ Hệ thống: Báo giá");
    expect(newMessageAnnouncement(msg({ body: "x".repeat(200) }))).toMatch(/x{140}…$/);
  });
});

describe("BO-UX-47 — inbox unread rows and scope filter", () => {
  it("unread rows are bold with a spoken count; the scope filter is a toggle group", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/chat/conversations": () =>
          bePage([
            { ...myConversation, unread: 3 },
            { ...myConversation, id: "c-2", subject: "Đã đọc hết", unread: 0 },
          ]),
      },
    });
    renderScreen(<ChatInbox />, "SALES_STAFF");
    const unread = await screen.findByText("Báo giá ly logo xanh");
    expect(unread).toHaveClass("font-bold");
    expect(screen.getByText("Đã đọc hết")).not.toHaveClass("font-bold");
    expect(screen.getByText("3 tin chưa đọc")).toHaveClass("sr-only");

    const group = screen.getByRole("group", { name: "Phạm vi" });
    expect(within(group).getByRole("button", { name: "Tất cả" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(group).getByRole("button", { name: "Của tôi" }));
    expect(within(group).getByRole("button", { name: "Của tôi" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
