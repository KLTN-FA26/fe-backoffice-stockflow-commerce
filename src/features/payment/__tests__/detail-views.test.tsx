import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError } from "@/test/api-screen";

import { InstallmentDetail, OrderInstallmentsView } from "..";
import {
  ACCOUNTANT_GRANTS,
  PAGE_ONLY_GRANTS,
  SALES_GRANTS,
  installmentJson,
  mockPaymentApi,
  renderPaymentScreen,
} from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const signing = installmentJson({
  installmentId: "inst-1",
  seq: 1,
  name: "Đặt cọc",
  milestone: "ON_SIGNING",
  deliveryBatchSeq: undefined,
  paidAmount: 20_000_000,
  outstanding: 0,
  status: "PAID",
});
const batch1 = installmentJson();
const batch2 = installmentJson({
  installmentId: "inst-3",
  seq: 3,
  name: "Trả trước khi nhận đợt giao 2",
  deliveryBatchSeq: 2,
  reachedAt: undefined,
  status: "NOT_DUE",
});

const orderView = (over: Record<string, unknown> = {}) => ({
  orderId: "ord-13",
  orderNumber: "SO-20261108-000013",
  contractNumber: "HD-20261108-000013-1",
  paymentStatus: "PARTIALLY_PAID",
  total: 70_000_000,
  paid: 20_000_000,
  outstanding: 50_000_000,
  onSigningPaid: true,
  beforeDeliveryUnpaid: 50_000_000,
  dueBeforeHandover: 50_000_000,
  currency: "VND",
  installments: [signing, batch1, batch2],
  ...over,
});

describe("OrderInstallmentsView — an order's installments and handover blocking (docs 15 §5.2, BR-07, BR-08)", () => {
  const routes = (view = orderView()) => ({ get: { "/installments/orders/ord-13": () => view } });

  it("summarises the order's payment status and what must be paid before the goods leave", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />);
    expect(await screen.findByText("Thanh toán một phần")).toBeInTheDocument();
    expect(screen.getByText("Đã thu đủ")).toBeInTheDocument();
    expect(screen.getByText("Phải thu trước khi bàn giao")).toBeInTheDocument();
  });

  it("a batch-tied BEFORE_DELIVERY installment names its delivery batch; each unpaid one flags the handover block", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />);
    await screen.findByText("Đợt giao 2");
    expect(screen.getByText("Đợt giao 1")).toBeInTheDocument();
    expect(screen.getAllByText("Đang chặn bàn giao")).toHaveLength(2);
  });

  it("accountant can record a receipt on a payable row; sales sees the same rows without the button", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        ...routes().get,
        "/installments": () => ({
          items: [],
          page: 0,
          size: 200,
          totalElements: 0,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
        }),
      },
    });
    const view = renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />);
    await screen.findByText("Đợt giao 2");
    // Due (batch 1) and Not Due (batch 2, paid early allowed) take money; the paid deposit does not
    expect(screen.getAllByRole("button", { name: "Lập phiếu thu" })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole("button", { name: "Lập phiếu thu" })[0]!);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    view.unmount();
    mockPaymentApi(SALES_GRANTS, routes());
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />);
    await screen.findByText("Đợt giao 2");
    expect(screen.queryByRole("button", { name: "Lập phiếu thu" })).not.toBeInTheDocument();
  });

  it("when every installment is cancelled the order has no payment status", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes(orderView({ paymentStatus: undefined })));
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />);
    expect(await screen.findByText("Mọi đợt đã huỷ")).toBeInTheDocument();
  });

  it("a missing order explains that no installments exist for it", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/installments/orders/ord-x": () => {
          throw apiError(404, "INSTALLMENT_NOT_FOUND");
        },
      },
    });
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-x" />);
    expect(await screen.findByText("Đơn này chưa có đợt thanh toán")).toBeInTheDocument();
  });

  it("no read permission: told so, nothing requested", async () => {
    const api = mockPaymentApi(PAGE_ONLY_GRANTS, routes());
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />);
    expect(await screen.findByText(/chưa có quyền xem đợt thanh toán/)).toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => String(url).startsWith("/installments"))).toBe(false);
  });
});

describe("InstallmentDetail — the receipts that paid an installment, voided ones included", () => {
  const detail = installmentJson({
    paidAmount: 5_000_000,
    outstanding: 20_000_000,
    status: "PARTIALLY_PAID",
    receipts: [
      {
        receiptId: "rcp-1",
        reference: "FT26313123456",
        receivedOn: "2026-11-10",
        amount: 5_000_000,
        status: "RECORDED",
        recordedAt: "2026-11-10T03:00:00Z",
      },
      {
        receiptId: "rcp-0",
        reference: "FT26311999333",
        receivedOn: "2026-11-09",
        amount: 5_000_000,
        status: "VOIDED",
        recordedAt: "2026-11-09T03:00:00Z",
      },
    ],
  });
  const routes = { get: { "/installments/inst-2": () => detail } };

  it("shows milestone, tied batch, the transfer reference the customer writes, and each receipt with its status", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes);
    renderPaymentScreen(<InstallmentDetail id="inst-2" />);
    expect(await screen.findByText("HD-20261108-000013-1 DOT2")).toBeInTheDocument();
    expect(screen.getByText("Đợt giao 1")).toBeInTheDocument();
    const recorded = screen.getByRole("link", { name: "FT26313123456" }).closest("li")!;
    expect(within(recorded).getByText("Đã ghi nhận")).toBeInTheDocument();
    const voided = screen.getByRole("link", { name: "FT26311999333" }).closest("li")!;
    expect(within(voided).getByText("Đã huỷ")).toBeInTheDocument();
  });

  it("a Paid installment offers no receipt button; a payable one does for the accountant only", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes);
    const view = renderPaymentScreen(<InstallmentDetail id="inst-2" />);
    expect(await screen.findByRole("button", { name: "Lập phiếu thu" })).toBeInTheDocument();
    view.unmount();
    mockPaymentApi(SALES_GRANTS, routes);
    const salesView = renderPaymentScreen(<InstallmentDetail id="inst-2" />);
    await screen.findByText("HD-20261108-000013-1 DOT2");
    expect(screen.queryByRole("button", { name: "Lập phiếu thu" })).not.toBeInTheDocument();
    salesView.unmount();
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/installments/inst-2": () =>
          installmentJson({ status: "PAID", outstanding: 0, paidAmount: 25_000_000, receipts: [] }),
      },
    });
    renderPaymentScreen(<InstallmentDetail id="inst-2" />);
    await screen.findByText("Chưa có phiếu thu nào cho đợt này.");
    expect(screen.queryByRole("button", { name: "Lập phiếu thu" })).not.toBeInTheDocument();
  });
});
