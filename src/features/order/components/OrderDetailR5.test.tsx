import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { installmentDue } from "../selectors";

import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../__fixtures__/render";
import type { OrderDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const QUOTE_ID = "6f3b5c1e-2d4a-4b8f-9c0d-1e2f3a4b5c6d";

async function renderDetail(
  order: OrderDto,
  routes: Record<string, RouteHandler> = {},
  permissions: PermissionCode[] = ORDER_PERMISSION_SETS.salesStaff,
) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => order,
    // Khối Hợp đồng không có quyền đọc ở bộ quyền này; lịch sử mặc định rỗng.
    ...routes,
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  await screen.findByRole("heading", { name: apiOrder.orderNumber });
}

afterEach(() => vi.restoreAllMocks());

describe("installmentDue", () => {
  it("reads the BE's dueDate, prefers its daysOverdue (R5-12), else counts from dueDate when overdue", () => {
    expect(installmentDue({ dueDate: "2026-11-20", daysOverdue: 2 }, "2026-11-23")).toEqual({
      dueDate: "2026-11-20",
      daysOverdue: 2,
    });
    expect(installmentDue({ dueDate: "2026-11-20", overdue: true }, "2026-11-23")).toEqual({
      dueDate: "2026-11-20",
      daysOverdue: 3,
    });
    expect(installmentDue({ dueDate: "2026-11-30", overdue: false }, "2026-11-23")).toEqual({
      dueDate: "2026-11-30",
      daysOverdue: 0,
    });
    expect(installmentDue({}, "2026-11-23")).toEqual({ dueDate: null, daysOverdue: 0 });
  });
});

describe("Order detail — round 5", () => {
  it("BO-UX-22: a draft says the next step and hides warehouse and delivery cards", async () => {
    await renderDetail({ ...apiOrder, status: "DRAFT", allowPartialShipment: false });
    const card = screen.getByRole("region", { name: "Thao tác đơn" });
    expect(within(card).getByText(/Bước tiếp theo:/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Lập hợp đồng/ })).toHaveAttribute(
      "href",
      "#contract",
    );
    expect(screen.queryByRole("region", { name: "Giao một phần" })).not.toBeInTheDocument();
  });

  it("BO-UX-22: past the contract, the warehouse cards come back", async () => {
    await renderDetail({ ...apiOrder, status: "CONFIRMED", allowPartialShipment: false });
    expect(await screen.findByRole("region", { name: "Giao một phần" })).toBeInTheDocument();
    expect(screen.queryByText(/Bước tiếp theo:/)).not.toBeInTheDocument();
  });

  it("BO-UX-22: status and actions, then customer and money, then warehouse cards", async () => {
    await renderDetail({ ...apiOrder, status: "CONFIRMED", allowPartialShipment: false });
    const action = screen.getByRole("region", { name: "Thao tác đơn" });
    const info = screen.getByRole("heading", { name: "Thông tin" });
    const partial = await screen.findByRole("region", { name: "Giao một phần" });
    expect(action.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(info.compareDocumentPosition(partial) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("BO-UX-22 / L-4: the company is in the heading; name and code are on separate lines", async () => {
    await renderDetail({
      ...apiOrder,
      customerName: "Khách hàng demo",
      customerCode: "0399990001",
    });
    expect(screen.getAllByText(/Khách hàng demo/).length).toBeGreaterThan(0);
    const name = screen.getAllByText("Khách hàng demo").find((el) => el.tagName === "SPAN");
    expect(name).toBeDefined();
    // Two block elements: the name and, under it, the code — never one run of text.
    const code = screen.getByText("0399990001");
    expect(code.tagName).toBe("SPAN");
    expect(code).toHaveClass("block");
    expect(name).toHaveClass("block");
  });

  it("BO-UX-25: an order converted from a quote links back to it (R5-7)", async () => {
    await renderDetail({ ...apiOrder, sourceQuoteId: QUOTE_ID, sourceQuoteNumber: "QT-0012" });
    expect(screen.getByRole("link", { name: /Từ báo giá QT-0012/ })).toHaveAttribute(
      "href",
      `/admin/quotes/${QUOTE_ID}`,
    );
  });

  it("BO-UX-23: a line reads 'x thùng (y cái)' with its design name, no placeholder icon", async () => {
    await renderDetail({
      ...apiOrder,
      lines: [
        {
          ...apiOrder.lines[0],
          lineId: "l-1",
          sku: "LY-12OZ",
          quantity: 60_000,
          cartons: 60,
          unitsPerCarton: 1000,
          designName: "Ly logo Tết",
          reservationIds: [],
          unitPrice: 1150,
          lineTotal: 69_000_000,
        },
      ],
    });
    const line = screen.getByRole("listitem", { name: "Dòng LY-12OZ" });
    expect(within(line).getByText("60 thùng (60.000 cái)")).toBeInTheDocument();
    expect(within(line).getByText("Ly logo Tết")).toBeInTheDocument();
    expect(within(line).getByText(/\/cái/)).toBeInTheDocument();
  });

  it("BO-UX-24: installments show their due date and days overdue, with a link to all of them", async () => {
    await renderDetail(
      apiOrder,
      {
        [`/installments/orders/${apiOrder.orderId}`]: () => ({
          total: 350_000,
          paid: 0,
          currency: "VND",
          installments: [
            {
              installmentId: "i-1",
              seq: 1,
              name: "Khi ký",
              amount: 350_000,
              paidAmount: 0,
              status: "DUE",
              dueDate: "2026-11-20",
              daysOverdue: 3,
              overdue: true,
            },
          ],
        }),
      },
      [...ORDER_PERMISSION_SETS.salesStaff, PAYMENT_INSTALLMENT_PERMISSIONS.read],
    );
    expect(await screen.findByText("quá hạn 3 ngày")).toBeInTheDocument();
    expect(screen.getByText(/hạn 20 thg 11, 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem các đợt" })).toHaveAttribute(
      "href",
      `/admin/payment/installments/orders/${apiOrder.orderId}`,
    );
  });
});
