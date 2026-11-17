import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SALES_CONTRACT_PERMISSIONS, UI_LABELS } from "@/constants";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";

import { HandoverReasonLink } from "./HandoverReasonLink";

const B = UI_LABELS.shipping.waybill.blocked;
let granted: string[] = [];

vi.mock("@/lib/auth/components/Can", () => ({
  useCan: (code: string) => granted.includes(code),
}));

beforeEach(() => {
  granted = [];
});

describe("HandoverReasonLink — liên kết từ lý do chặn bàn giao tới màn xử lý (theo mã quyền)", () => {
  it("chưa thu đợt trước khi giao + có payment-installments:READ → liên kết tới các đợt của đơn", () => {
    granted = [PAYMENT_INSTALLMENT_PERMISSIONS.read];
    render(<HandoverReasonLink orderId="o-1" reasonCode="ORDER_BALANCE_NOT_PAID" />);
    expect(screen.getByRole("link", { name: B.linkCollectPayment })).toHaveAttribute(
      "href",
      PAYMENT_ROUTES.installments.ofOrder("o-1"),
    );
  });

  it("chưa tới cửa sổ giao + có sales-contracts:READ và UPDATE → liên kết tới chi tiết đơn (lịch giao)", () => {
    granted = [SALES_CONTRACT_PERMISSIONS.read, SALES_CONTRACT_PERMISSIONS.update];
    render(<HandoverReasonLink orderId="o-1" reasonCode="DELIVERY_BATCH_WINDOW_NOT_OPEN" />);
    expect(screen.getByRole("link", { name: B.linkMoveWindow })).toHaveAttribute(
      "href",
      "/admin/orders/o-1",
    );
  });

  it("thiếu quyền → không hiện liên kết", () => {
    render(
      <>
        <HandoverReasonLink orderId="o-1" reasonCode="ORDER_BALANCE_NOT_PAID" />
        <HandoverReasonLink orderId="o-1" reasonCode="DELIVERY_BATCH_WINDOW_NOT_OPEN" />
      </>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("chỉ có quyền đọc lịch (không có UPDATE) → không hiện liên kết dời cửa sổ", () => {
    granted = [SALES_CONTRACT_PERMISSIONS.read];
    render(<HandoverReasonLink orderId="o-1" reasonCode="DELIVERY_BATCH_WINDOW_NOT_OPEN" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("lý do khác → không có liên kết dù đủ quyền", () => {
    granted = [
      PAYMENT_INSTALLMENT_PERMISSIONS.read,
      SALES_CONTRACT_PERMISSIONS.read,
      SALES_CONTRACT_PERMISSIONS.update,
    ];
    render(<HandoverReasonLink orderId="o-1" reasonCode="ORDER_INVALID_TRANSITION" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
