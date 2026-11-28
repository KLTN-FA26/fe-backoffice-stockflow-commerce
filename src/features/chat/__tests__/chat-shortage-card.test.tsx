/**
 * Thẻ "Đơn thiếu N thùng" trong chat, phía Sale (docs 16 §4.7, BR-15; 17 §4.14): chỉ xem, trạng thái đọc từ payload, tên thẻ
 * là mã TT-… (hoặc ngày gửi), Sale không chọn thay khách; "Thực hiện" dẫn tới mục #shortage của đơn.
 */
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, renderScreen } from "@/test/api-screen";

import { cardStateView, cardTitle } from "../card-view";
import { ChatCardView } from "../components/ChatCardView";
import { chatMessageSchema } from "../schemas";

import { answeredCard, baseCard } from "../../order/__fixtures__/shortage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
afterEach(() => vi.restoreAllMocks());

const message = (payload: Record<string, unknown>, state = "OPEN") =>
  chatMessageSchema.parse({
    id: "m-1",
    conversationId: "c-1",
    seq: 1,
    kind: "CARD",
    visibility: "CUSTOMER",
    senderType: "SYSTEM",
    body: "Đơn thiếu 2 thùng",
    card: { kind: "SHORTAGE_CHOICE", state, payload },
    sentAt: "2026-11-28T03:00:00Z",
  });

const show = (payload: Record<string, unknown>, state = "OPEN") => {
  mockApi("SALES_STAFF", {});
  renderScreen(
    <ChatCardView message={message(payload, state)} quoteGate={{ allowed: false, hint: null }} />,
    "SALES_STAFF",
  );
};

describe("SHORTAGE_CHOICE card — staff view", () => {
  it("title 'Đơn thiếu N thùng' and status from payload.status (SENT / ANSWERED are both state OPEN)", () => {
    expect(cardTitle({ kind: "SHORTAGE_CHOICE", payload: baseCard })).toBe("Đơn thiếu 2 thùng");
    const sent = cardStateView({ kind: "SHORTAGE_CHOICE", state: "OPEN", payload: baseCard });
    expect(sent.label).toBe("Chờ khách chọn");
    const answered = cardStateView({
      kind: "SHORTAGE_CHOICE",
      state: "OPEN",
      payload: answeredCard("REDUCE_CARTONS"),
    });
    expect(answered.label).toBe("Khách đã chọn");
    const executed = cardStateView({
      kind: "SHORTAGE_CHOICE",
      state: "CLOSED",
      payload: { ...baseCard, status: "EXECUTED" },
    });
    expect(executed.label).toBe("Sale đã thực hiện");
  });

  it("SENT: shows code, SKUs short, the four options with effects, link to the order; no choose button", async () => {
    show(baseCard);
    expect(await screen.findByText(/TT-20261128-0001/)).toBeInTheDocument();
    expect(screen.getByText("Ly giấy 2 lớp 12oz")).toBeInTheDocument();
    expect(screen.getByText("Giao một phần rồi đóng phần còn lại")).toBeInTheDocument();
    expect(screen.getByText(/Dự kiến giao từ 22\/12\/2026/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Mở đơn" })).toHaveAttribute(
      "href",
      `/admin/orders/${baseCard.orderId}#shortage`,
    );
  });

  it("no code yet → 'Thẻ thiếu thùng ngày …', never the card UUID", async () => {
    show({ ...baseCard, number: null });
    expect(await screen.findByText(/Thẻ thiếu thùng ngày 28\/11\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(baseCard.cardId))).not.toBeInTheDocument();
  });

  it("ANSWERED: names the customer's choice and offers 'Thực hiện trên trang đơn'", async () => {
    show(answeredCard("CANCEL_ORDER"));
    expect(await screen.findByText(/Khách đã chọn: Huỷ đơn lúc/)).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: "Thực hiện trên trang đơn" }),
    ).toBeInTheDocument();
  });

  it("SUPERSEDED / EXPIRED: says why, nothing to do", async () => {
    show({ ...baseCard, status: "EXPIRED", endedReason: "REALLOCATED" }, "EXPIRED");
    expect(await screen.findByText("Đơn đã đủ hàng")).toBeInTheDocument();
    expect(screen.getByText("Không cần chọn nữa")).toBeInTheDocument();
  });
});
