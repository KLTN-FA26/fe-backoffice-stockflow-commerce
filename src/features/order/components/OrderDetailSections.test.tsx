import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { RouteHandler } from "../__fixtures__/render";
import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;

const customLine = {
  lineId: "5e5e5e5e-0000-4000-8000-000000000002",
  sku: "CUP-PRINT-12OZ",
  quantity: 500,
  unitPrice: 4000,
  lineTotal: 2_000_000,
  reservationIds: ["7a7a7a7a-0000-4000-8000-000000000009"],
  designSnapshotId: "c0ffee00-0000-4000-8000-000000000001",
  designChecksum: "sha256:abc",
};

async function renderDetail(order: OrderDto, routes: Record<string, RouteHandler> = {}) {
  mockOrderApiGet(ORDER_PERMISSION_SETS.salesStaff, { [DETAIL_PATH]: () => order, ...routes });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — dòng hàng sẵn / dòng in + giữ hàng", () => {
  it("docs 14 BR-02: dòng có design snapshot gắn nhãn 'Hàng in theo thiết kế', dòng còn lại 'Hàng sẵn'", async () => {
    await renderDetail({ ...apiOrder, lines: [...apiOrder.lines, customLine] });

    const printed = await screen.findByRole("listitem", { name: `Dòng ${customLine.sku}` });
    expect(within(printed).getByText("Hàng in theo thiết kế")).toBeInTheDocument();
    const standard = screen.getByRole("listitem", { name: `Dòng ${apiOrder.lines[0]?.sku}` });
    expect(within(standard).getByText("Hàng sẵn")).toBeInTheDocument();
    expect(screen.getByText(/1 dòng in, 1 dòng hàng sẵn/)).toBeInTheDocument();
  });

  it("hiện mã phiếu giữ hàng của dòng; dòng chưa giữ → 'Chưa giữ hàng'", async () => {
    await renderDetail({
      ...apiOrder,
      lines: [customLine, { ...customLine, lineId: "x", sku: "B", reservationIds: [] }],
    });

    expect(await screen.findByText(customLine.reservationIds[0] ?? "")).toBeInTheDocument();
    expect(screen.getByText("Chưa giữ hàng")).toBeInTheDocument();
  });
});

describe("OrderDetail — thanh toán / cọc / công nợ / huỷ", () => {
  it("đơn đặt cọc chưa nhận cọc → 'Chưa nhận cọc' (docs 19 BR-09)", async () => {
    await renderDetail({
      ...apiOrder,
      paymentTerm: "DEPOSIT",
      paymentStatus: "UNPAID",
      paidAmount: 0,
      depositRequired: 105_000,
    });

    expect(await screen.findByText("Đặt cọc")).toBeInTheDocument();
    expect(screen.getByText("Chưa nhận cọc")).toBeInTheDocument();
    expect(screen.getByText("Chưa thanh toán")).toBeInTheDocument();
  });

  it("đơn đặt cọc đã nhận cọc → 'Đã nhận cọc'", async () => {
    await renderDetail({
      ...apiOrder,
      status: "CONFIRMED",
      paymentTerm: "DEPOSIT",
      depositRequired: 105_000,
      depositReceivedAt: "2026-09-08T02:00:00Z",
    });

    expect(await screen.findByText(/Đã nhận cọc/)).toBeInTheDocument();
  });

  /** Card "Thanh toán" — "Tạm giữ" còn xuất hiện ở badge trạng thái đơn nên phải giới hạn phạm vi. */
  async function financeCard() {
    const heading = await screen.findByRole("heading", { name: "Thanh toán" });
    return within(heading.closest("section") as HTMLElement);
  }

  it("E/F. đơn công nợ On Hold → trạng thái 'Tạm giữ', KHÔNG đoán 'Vượt hạn mức' (đơn không mang lý do)", async () => {
    await renderDetail({
      ...apiOrder,
      status: "ON_HOLD",
      paymentTerm: "CREDIT",
      paymentStatus: "ON_CREDIT",
      creditTermDays: 30,
    });

    const card = await financeCard();
    expect(card.getByText("Tạm giữ")).toBeInTheDocument();
    expect(card.queryByText(/Vượt hạn mức|công nợ quá hạn/)).not.toBeInTheDocument();
    expect(card.getByText("Kỳ hạn 30 ngày")).toBeInTheDocument();
  });

  it("G. đơn công nợ không On Hold → giữ nguyên 'Đã qua kiểm hạn mức'", async () => {
    await renderDetail({
      ...apiOrder,
      status: "CONFIRMED",
      paymentTerm: "CREDIT",
      paymentStatus: "ON_CREDIT",
      creditTermDays: 30,
    });

    const card = await financeCard();
    expect(card.getByText("Đã qua kiểm hạn mức")).toBeInTheDocument();
    expect(card.queryByText("Tạm giữ")).not.toBeInTheDocument();
  });

  it('đơn đã huỷ → nhãn lý do + ghi chú tách khỏi cột BE "CODE: ghi chú", không lộ mã', async () => {
    await renderDetail({
      ...apiOrder,
      status: "CANCELLED",
      // BE Order#cancel lưu `reason` = "CODE: ghi chú"
      cancellation: {
        reasonCode: "OUT_OF_STOCK",
        reason: "OUT_OF_STOCK: Hết phôi",
        retainedAmount: 0,
      },
    });

    expect(await screen.findByText("Hết hàng, không thể giao")).toBeInTheDocument();
    expect(screen.getByText("Hết phôi")).toBeInTheDocument();
    expect(screen.queryByText(/OUT_OF_STOCK/)).not.toBeInTheDocument();
  });

  it("đơn huỷ không ghi chú (reason = mã) → chỉ nhãn, không có dòng ghi chú trống / mã thô", async () => {
    await renderDetail({
      ...apiOrder,
      status: "CANCELLED",
      cancellation: {
        reasonCode: "CUSTOMER_REQUEST",
        reason: "CUSTOMER_REQUEST",
        retainedAmount: 0,
      },
    });

    expect(await screen.findByText("Khách yêu cầu")).toBeInTheDocument();
    expect(screen.queryByText("Ghi chú huỷ")).not.toBeInTheDocument();
    expect(screen.queryByText(/CUSTOMER_REQUEST/)).not.toBeInTheDocument();
  });

  it("mã lý do BE mới FE chưa có nhãn → vẫn đọc được, ghi chú tách đúng", async () => {
    await renderDetail({
      ...apiOrder,
      status: "CANCELLED",
      cancellation: {
        reasonCode: "FRAUD_REVIEW",
        reason: "FRAUD_REVIEW: kiểm tra lại",
        retainedAmount: 0,
      },
    });

    expect(await screen.findByText("FRAUD_REVIEW")).toBeInTheDocument();
    expect(screen.getByText("kiểm tra lại")).toBeInTheDocument();
  });

  it("chưa release → kho xuất 'Chưa release'", async () => {
    await renderDetail(apiOrder);
    expect(await screen.findByText("Chưa release")).toBeInTheDocument();
  });
});

describe("OrderDetail — lịch sử trạng thái", () => {
  it("GET /orders/{id}/history → mới nhất ở trên, có lý do", async () => {
    await renderDetail(
      { ...apiOrder, status: "CONFIRMED" },
      {
        [`${DETAIL_PATH}/history`]: () => [
          { to: "PENDING_PAYMENT", occurredAt: "2026-09-07T03:15:00Z" },
          {
            from: "PENDING_PAYMENT",
            to: "CONFIRMED",
            reason: "Đã nhận đủ cọc",
            occurredAt: "2026-09-08T02:00:00Z",
          },
        ],
      },
    );

    const history = await screen.findByRole("region", { name: "Lịch sử trạng thái" });
    const items = await within(history).findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText("Đã nhận đủ cọc")).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText(/Tạo đơn/)).toBeInTheDocument();
  });

  it('bước huỷ: lý do BE "CODE: ghi chú" → "Khách yêu cầu — khách đổi ý"; lý do cũ tự do giữ nguyên', async () => {
    await renderDetail(
      { ...apiOrder, status: "CANCELLED" },
      {
        [`${DETAIL_PATH}/history`]: () => [
          { to: "PENDING_PAYMENT", occurredAt: "2026-09-07T03:15:00Z" },
          {
            from: "PENDING_PAYMENT",
            to: "CANCELLED",
            reason: "CUSTOMER_REQUEST: khách đổi ý",
            occurredAt: "2026-09-08T02:00:00Z",
          },
        ],
      },
    );

    const history = await screen.findByRole("region", { name: "Lịch sử trạng thái" });
    expect(await within(history).findByText("Khách yêu cầu — khách đổi ý")).toBeInTheDocument();
    expect(within(history).queryByText(/CUSTOMER_REQUEST/)).not.toBeInTheDocument();
  });
});
