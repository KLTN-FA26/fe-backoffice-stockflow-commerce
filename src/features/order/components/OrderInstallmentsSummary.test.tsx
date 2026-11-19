/**
 * Khối "Thanh toán" của chi tiết đơn đọc các đợt thanh toán (BE `GET /installments/orders/{id}`, docs 15 §5.2):
 * số đợt, đã thu / tổng, trạng thái từng đợt; chỉ khi có `payment-installments:READ`, không bao giờ dòng "—".
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";

import { OrderDetail } from "./OrderDetail";

import { DETAIL_PATH, HISTORY_PATH } from "../__fixtures__/detail";
import { apiOrder, apiOrderAt } from "../__fixtures__/order";
import { mockOrderApiGet, ORDER_PERMISSION_SETS, renderOrderScreen } from "../__fixtures__/render";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const INSTALLMENTS_PATH = `/installments/orders/${apiOrder.orderId}`;
const installment = (seq: number, name: string, over: Record<string, unknown> = {}) => ({
  installmentId: `i-${seq}`,
  seq,
  name,
  amount: 40_000_000,
  paidAmount: 0,
  status: "NOT_DUE",
  ...over,
});
const INSTALLMENTS = {
  total: 100_000_000,
  paid: 40_000_000,
  currency: "VND",
  installments: [
    installment(1, "Ký hợp đồng", { paidAmount: 40_000_000, status: "PAID" }),
    installment(2, "Trước khi giao", { amount: 60_000_000, status: "DUE" }),
  ],
};

async function renderOrder(permissions: readonly PermissionCode[], installments: unknown) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => apiOrderAt("CONFIRMED"),
    [HISTORY_PATH]: () => [],
    [INSTALLMENTS_PATH]: () => {
      if (installments instanceof Error) throw installments;
      return installments;
    },
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  await screen.findByRole("heading", { name: apiOrder.orderNumber });
}

const block = () => screen.getByRole("heading", { name: "Thanh toán" }).closest("section")!;

describe("Khối Thanh toán — các đợt thanh toán của đơn", () => {
  it("có payment-installments:READ → số đợt, đã thu / tổng, trạng thái từng đợt bằng tiếng Việt", async () => {
    await renderOrder(
      [...ORDER_PERMISSION_SETS.readOnly, PAYMENT_INSTALLMENT_PERMISSIONS.read],
      INSTALLMENTS,
    );
    const card = within(block());
    expect(await card.findByText("2 đợt")).toBeInTheDocument();
    expect(card.getByText(/40\.000\.000.*\/.*100\.000\.000/)).toBeInTheDocument();
    expect(card.getByText(/1\. Ký hợp đồng/)).toBeInTheDocument();
    expect(card.getByText(/2\. Trước khi giao/)).toBeInTheDocument();
    expect(card.getByText("Đã thanh toán")).toBeInTheDocument();
    // Đợt không mang phương thức → không có dòng đó, không có "—" thay chỗ
    expect(card.queryByText("Phương thức")).not.toBeInTheDocument();
    expect(card.queryByText("—")).not.toBeInTheDocument();
  });

  it("tình trạng thanh toán, còn phải thu, phải thu trước khi xuất (chỉ khi > 0) theo BE", async () => {
    await renderOrder([...ORDER_PERMISSION_SETS.readOnly, PAYMENT_INSTALLMENT_PERMISSIONS.read], {
      ...INSTALLMENTS,
      paymentStatus: "PARTIALLY_PAID",
      outstanding: 60_000_000,
      dueBeforeHandover: 60_000_000,
    });
    const card = within(block());
    expect(await card.findByText("Tình trạng thanh toán")).toBeInTheDocument();
    expect(card.getByText("Thanh toán một phần")).toBeInTheDocument();
    expect(card.getByText("Còn phải thu")).toBeInTheDocument();
    expect(card.getByText("Phải thu trước khi xuất")).toBeInTheDocument();
    expect(card.getAllByText(/60\.000\.000/).length).toBeGreaterThanOrEqual(2);
  });

  it("trạng thái lạ → Không rõ; phải thu trước khi xuất = 0 → không hiện; field vắng → không dòng", async () => {
    await renderOrder([...ORDER_PERMISSION_SETS.readOnly, PAYMENT_INSTALLMENT_PERMISSIONS.read], {
      ...INSTALLMENTS,
      paymentStatus: "OVERPAID",
      dueBeforeHandover: 0,
    });
    const card = within(block());
    expect(await card.findByText("Không rõ")).toBeInTheDocument();
    expect(card.queryByText("Phải thu trước khi xuất")).not.toBeInTheDocument();
    expect(card.queryByText("Còn phải thu")).not.toBeInTheDocument();
  });

  it("thiếu payment-installments:READ → không gọi API, không hiện phần các đợt, không dòng '—'", async () => {
    await renderOrder(ORDER_PERMISSION_SETS.readOnly, INSTALLMENTS);
    expect(api.get).not.toHaveBeenCalledWith(INSTALLMENTS_PATH, expect.anything());
    const card = within(block());
    expect(card.queryByText("Số đợt thanh toán")).not.toBeInTheDocument();
    expect(card.queryByText("Phương thức")).not.toBeInTheDocument();
    expect(card.queryByText("—")).not.toBeInTheDocument();
  });

  it("đơn chưa có đợt (lỗi / danh sách rỗng) → không hiện phần các đợt", async () => {
    await renderOrder([...ORDER_PERMISSION_SETS.readOnly, PAYMENT_INSTALLMENT_PERMISSIONS.read], {
      ...INSTALLMENTS,
      installments: [],
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(INSTALLMENTS_PATH, expect.anything()));
    expect(within(block()).queryByText("Số đợt thanh toán")).not.toBeInTheDocument();
  });
});
