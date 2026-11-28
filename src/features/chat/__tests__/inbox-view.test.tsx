import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { CUSTOMER_ID, conversation, overview } from "../__fixtures__/chat";
import { CustomerPanel } from "../components/CustomerPanel";
import { DocumentCardBody } from "../components/DocumentCardBody";
import { InboxRow } from "../components/InboxRow";
import { inboxTime, messagePreview, openDocuments } from "../inbox-view";
import { chatCardSchema, chatConversationSchema, chatCustomerOverviewSchema } from "../schemas";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const orderStatusCard = chatCardSchema.parse({
  kind: "ORDER_STATUS",
  state: "OPEN",
  payload: { orderId: "o-1", orderNumber: "SO-20261126-000001", status: "DELIVERED" },
});

describe("bo-32 — tin cuối trong hộp thư không lộ mã trạng thái", () => {
  it("thẻ trạng thái đơn: đọc số đơn + trạng thái từ payload", () => {
    expect(
      messagePreview({ body: "Đơn SO-20261126-000001: DELIVERED", card: orderStatusCard }),
    ).toBe("Đơn SO-20261126-000001: Đã giao");
  });

  it("thẻ khác có đuôi mã trạng thái → thay bằng chữ; mã lạ / tin thường giữ nguyên", () => {
    const card = chatCardSchema.parse({ kind: "INVOICE", state: "OPEN" });
    expect(messagePreview({ body: "Đơn SO-1: HANDED_OVER", card })).toBe("Đơn SO-1: Đã bàn giao");
    expect(messagePreview({ body: "Đơn SO-1: WHATEVER_NEW", card })).toBe("Đơn SO-1: WHATEVER_NEW");
    expect(messagePreview({ body: "Gửi anh: OK", card: null })).toBe("Gửi anh: OK");
  });

  it("thẻ trạng thái đơn trong hội thoại ghi trạng thái lô giao bằng chữ", () => {
    mockApi("SALES_STAFF");
    renderScreen(<DocumentCardBody card={orderStatusCard} />, "SALES_STAFF");
    expect(screen.getByText("Lô giao: Đã giao")).toBeInTheDocument();
    expect(screen.queryByText(/DELIVERED/)).toBeNull();
  });
});

describe("bo-32 — giờ ngắn, một dòng", () => {
  const now = new Date("2026-11-27T08:00:00Z"); // 15:00 giờ Việt Nam
  it("hôm nay → HH:mm; trong năm → dd/MM; năm khác → dd/MM/yyyy (giờ Việt Nam)", () => {
    expect(inboxTime("2026-11-27T05:20:00Z", now)).toBe("12:20");
    expect(inboxTime("2026-11-26T18:00:00Z", now)).toBe("01:00"); // 27/11 01:00 giờ VN = hôm nay
    expect(inboxTime("2026-11-26T12:46:00Z", now)).toBe("26/11");
    expect(inboxTime("2025-12-31T02:00:00Z", now)).toBe("31/12/2025");
  });

  it("dòng hộp thư: giờ không xuống dòng, bản đầy đủ ở title; 'Quá hạn' cùng kiểu chấm + chữ với trạng thái", () => {
    mockApi("SALES_STAFF");
    const item = chatConversationSchema.parse({
      ...conversation,
      firstResponseOverdue: true,
      lastMessageAt: "2025-11-27T05:20:00Z",
      lastMessage: {
        id: "m-1",
        conversationId: conversation.id,
        seq: 3,
        kind: "CARD",
        visibility: "CUSTOMER",
        senderType: "SYSTEM",
        body: "Đơn SO-20261126-000001: DELIVERED",
        card: orderStatusCard,
        sentAt: "2025-11-27T05:20:00Z",
      },
    });
    renderScreen(<InboxRow item={item} />, "SALES_STAFF");
    const time = screen.getByText("27/11/2025");
    expect(time).toHaveAttribute("title", "27/11/2025 12:20");
    expect(time.className).toMatch(/whitespace-nowrap/);
    expect(screen.getByText(/Đơn SO-20261126-000001: Đã giao/)).toBeInTheDocument();
    expect(screen.queryByText(/DELIVERED/)).toBeNull();
    const overdue = screen.getByText("Quá hạn");
    expect(overdue.className).not.toMatch(/text-danger/);
  });
});

describe("bo-33 — panel khách: báo giá / đơn đang mở, số tiền đợt không bị cắt", () => {
  const withDocuments = {
    ...overview,
    quotes: [
      { id: "q-open", number: "QT-OPEN", status: "SENT", amount: 16_446_780, currency: "VND" },
      { id: "q-done", number: "QT-DONE", status: "CONVERTED" },
    ],
    orders: [
      { id: "o-run", number: "SO-RUN", status: "PENDING_PAYMENT" },
      { id: "o-done", number: "SO-DONE", status: "COMPLETED" },
    ],
  };

  it("openDocuments giữ báo giá còn chờ và đơn còn chạy", () => {
    const docs = openDocuments(chatCustomerOverviewSchema.parse(withDocuments));
    expect(docs.quotes.map((q) => q.id)).toEqual(["q-open"]);
    expect(docs.orders.map((o) => o.id)).toEqual(["o-run"]);
  });

  it("panel liệt kê chứng từ đang mở (link) và đợt còn phải thu với số tiền trọn một dòng", async () => {
    mockApi("SALES_STAFF", {
      get: { [`/chat/customers/${CUSTOMER_ID}/overview`]: () => withDocuments },
    });
    renderScreen(
      <CustomerPanel
        conversation={chatConversationSchema.parse(conversation)}
        canSend={false}
        canAttach={false}
      />,
      "SALES_STAFF",
    );
    expect(await screen.findByRole("link", { name: "QT-OPEN" })).toHaveAttribute(
      "href",
      "/admin/quotes/q-open",
    );
    expect(screen.getByRole("link", { name: "SO-RUN" })).toHaveAttribute(
      "href",
      "/admin/orders/o-run",
    );
    expect(screen.queryByText("QT-DONE")).toBeNull();
    expect(screen.queryByText("SO-DONE")).toBeNull();
    const row = screen.getByText(/HD-20261120-900001-1/).closest("li") as HTMLElement;
    const amount = within(row).getByText(/23\.265\.000/);
    expect(amount.className).toMatch(/whitespace-nowrap/);
    expect(within(row).getByText("hạn 21/11/2026")).toBeInTheDocument();
  });

  it("không có chứng từ đang mở → nói rõ", async () => {
    mockApi("SALES_STAFF", {
      get: { [`/chat/customers/${CUSTOMER_ID}/overview`]: () => overview },
    });
    renderScreen(
      <CustomerPanel
        conversation={chatConversationSchema.parse(conversation)}
        canSend={false}
        canAttach={false}
      />,
      "SALES_STAFF",
    );
    expect(await screen.findByText("Không có báo giá hay đơn đang mở.")).toBeInTheDocument();
  });
});
