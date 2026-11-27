import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { RouteHandler } from "../__fixtures__/render";
import type { OrderDto } from "../types";
import { clickOrderDetailTab } from "../__fixtures__/render";

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

/** Hàng dữ liệu của bảng lịch sử đơn (bỏ hàng tiêu đề). */
async function historyRows(history: HTMLElement): Promise<HTMLTableRowElement[]> {
  const rows = await within(history).findAllByRole("row");
  return rows.slice(1) as HTMLTableRowElement[];
}

describe("OrderDetail — dòng hàng sẵn / dòng in + giữ hàng", () => {
  it("docs 14 BR-02: dòng có design snapshot gắn nhãn 'Hàng in theo thiết kế', dòng còn lại 'Hàng sẵn'", async () => {
    await renderDetail({ ...apiOrder, lines: [...apiOrder.lines, customLine] });

    const printed = await screen.findByRole("listitem", { name: `Dòng ${customLine.sku}` });
    expect(within(printed).getByText("Hàng in theo thiết kế")).toBeInTheDocument();
    const standard = screen.getByRole("listitem", { name: `Dòng ${apiOrder.lines[0]?.sku}` });
    expect(within(standard).getByText("Hàng sẵn")).toBeInTheDocument();
    expect(screen.getByText(/1 dòng in, 1 dòng hàng sẵn/)).toBeInTheDocument();
  });

  it("BO-UX-23: says the line is held without counting internal holds (no UUID); none → 'Chưa giữ hàng'", async () => {
    await renderDetail({
      ...apiOrder,
      lines: [customLine, { ...customLine, lineId: "x", sku: "B", reservationIds: [] }],
    });

    expect(await screen.findByText("Đã giữ hàng ở kho xuất")).toBeInTheDocument();
    expect(screen.queryByText(/phiếu giữ/)).not.toBeInTheDocument();
    expect(screen.queryByText(customLine.reservationIds[0] ?? "")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(customLine.reservationIds[0]);
    expect(screen.getByText("Chưa giữ hàng")).toBeInTheDocument();
  });
});

describe("OrderDetail — thanh toán / cọc / công nợ / huỷ", () => {
  /** Card "Thanh toán" — giới hạn phạm vi (nhãn tiền có thể trùng chỗ khác). */
  async function financeCard() {
    const heading = await screen.findByRole("heading", { name: "Thanh toán" });
    return within(heading.closest("section") as HTMLElement);
  }

  it("4B-3: tổng, tạm tính trước thuế, từng dòng phí (phí khuôn kèm SKU) và VAT theo BE", async () => {
    // Response thô (loại phí lạ chỉ có ở wire, chưa qua parse) — route ghi đè DETAIL_PATH
    const wire = {
      ...apiOrder,
      totalAmount: 2_376_000,
      netAmount: 2_200_000,
      taxAmount: 176_000,
      fees: [
        {
          kind: "PLATE_FEE",
          sku: "CUP-PRINT-12OZ",
          amount: 150_000,
          taxRate: 8,
          taxAmount: 12_000,
        },
        { kind: "SHIPPING_FEE", amount: 50_000, taxRate: 8, taxAmount: 4_000 },
        { kind: "INSURANCE_FEE", amount: 1_000 },
      ],
    };
    await renderDetail(apiOrder, { [DETAIL_PATH]: () => wire });
    await screen.findByRole("tab", { name: "Thanh toán" });
    clickOrderDetailTab("Thanh toán");

    const card = await financeCard();
    expect(card.getByText("Tạm tính (trước thuế)")).toBeInTheDocument();
    expect(card.getByText(/2\.200\.000/)).toBeInTheDocument();
    expect(card.getByText("Phí khuôn / bản in · CUP-PRINT-12OZ")).toBeInTheDocument();
    expect(card.getByText("Phí vận chuyển")).toBeInTheDocument();
    // Loại phí BE thêm sau → nhãn chung, không lộ mã
    expect(card.getByText("Phí khác")).toBeInTheDocument();
    expect(card.queryByText(/INSURANCE_FEE/)).not.toBeInTheDocument();
    expect(card.getByText("Thuế GTGT")).toBeInTheDocument();
    expect(card.getByText(/176\.000/)).toBeInTheDocument();
  });

  it("BE không gửi netAmount / taxAmount / fees → không dòng nào, không '0 ₫' bịa", async () => {
    await renderDetail(apiOrder);
    await screen.findByRole("tab", { name: "Thanh toán" });
    clickOrderDetailTab("Thanh toán");
    const card = await financeCard();
    expect(card.queryByText("Tạm tính (trước thuế)")).not.toBeInTheDocument();
    expect(card.queryByText("Thuế GTGT")).not.toBeInTheDocument();
  });

  it("không còn dòng cọc / công nợ suy từ field BE đã bỏ (paymentTerm, deposit*, creditTermDays)", async () => {
    await renderDetail({
      ...apiOrder,
      status: "ON_HOLD",
      paymentTerm: "CREDIT",
      creditTermDays: 30,
      holdReason: "CREDIT",
      depositRequired: 105_000,
    });
    await screen.findByRole("tab", { name: "Thanh toán" });
    clickOrderDetailTab("Thanh toán");

    const card = await financeCard();
    expect(card.queryByText("Tiền cọc")).not.toBeInTheDocument();
    expect(card.queryByText(/nhận cọc/)).not.toBeInTheDocument();
    expect(card.queryByText("Công nợ")).not.toBeInTheDocument();
    expect(card.queryByText(/Kỳ hạn 30 ngày|Đã qua kiểm hạn mức/)).not.toBeInTheDocument();
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
    await screen.findByRole("tab", { name: "Thanh toán" });
    clickOrderDetailTab("Thanh toán");

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
    await screen.findByRole("tab", { name: "Thanh toán" });
    clickOrderDetailTab("Thanh toán");

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
    await screen.findByRole("tab", { name: "Thanh toán" });
    clickOrderDetailTab("Thanh toán");

    expect(await screen.findByText("FRAUD_REVIEW")).toBeInTheDocument();
    expect(screen.getByText("kiểm tra lại")).toBeInTheDocument();
  });

  it("L-5: chưa chọn kho → 'Chưa chọn kho xuất' (không còn chữ 'release')", async () => {
    await renderDetail(apiOrder);
    expect(await screen.findByText("Chưa chọn kho xuất")).toBeInTheDocument();
    expect(screen.queryByText("Chưa release")).not.toBeInTheDocument();
  });
});

describe("OrderDetail — lịch sử trạng thái", () => {
  it("GET /orders/{id}/history → cũ nhất trước (lịch sử đơn của develop), có lý do", async () => {
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
    await screen.findByRole("tab", { name: "Lịch sử" });
    clickOrderDetailTab("Lịch sử");

    const history = await screen.findByRole("region", { name: "Lịch sử đơn" });
    const items = await historyRows(history);
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText("Đặt đơn")).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText("Đã nhận đủ cọc")).toBeInTheDocument();
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
    await screen.findByRole("tab", { name: "Lịch sử" });
    clickOrderDetailTab("Lịch sử");

    const history = await screen.findByRole("region", { name: "Lịch sử đơn" });
    expect(await within(history).findByText("Khách yêu cầu — khách đổi ý")).toBeInTheDocument();
    expect(within(history).queryByText(/CUSTOMER_REQUEST/)).not.toBeInTheDocument();
  });
});
