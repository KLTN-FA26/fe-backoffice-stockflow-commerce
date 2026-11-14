import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_REFUND_PERMISSIONS } from "@/constants/payment";
import { ApiError } from "@/lib/api/error";
import {
  bePage,
  listItemJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "@/features/einvoice/__fixtures__/screen";

import { OrderSettlementPanel } from "./OrderSettlementPanel";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const ALL = [
  ...Object.values(PAYMENT_INSTALLMENT_PERMISSIONS),
  ...Object.values(PAYMENT_REFUND_PERMISSIONS),
  ...Object.values(EINVOICE_PERMISSIONS),
];
const plan = (outstanding: number) => ({
  orderId: "ord-13",
  orderNumber: "SO-13",
  contractNumber: "HD-20261108-000013-1",
  paymentStatus: outstanding ? "PARTIALLY_PAID" : "PAID",
  total: 50_000_000,
  paid: 50_000_000 - outstanding,
  outstanding,
  onSigningPaid: true,
  beforeDeliveryUnpaid: 0,
  dueBeforeHandover: 0,
  currency: "VND",
  installments: [],
});
const props = {
  orderId: "ord-13",
  orderNumber: "SO-13",
  status: "Delivered",
  deliveredAt: "2026-11-01T10:00:00Z",
  completedAt: null,
  closedAt: null,
  deliveredShipmentIds: ["shp-1", "shp-2"],
};
const routes = (outstanding: number, invoices: unknown[]) => ({
  get: {
    "/installments/orders/ord-13": () => plan(outstanding),
    "/einvoices": () => bePage(invoices),
    "/refunds/orders/ord-13": () => {
      throw new ApiError(404, "NOT_FOUND", "none");
    },
  },
});

describe("OrderSettlementPanel (WF-05 BO-10)", () => {
  it("shows the contract's money, the order's invoices and why a delivered order is not completed yet", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-20T00:00:00Z"), shouldAdvanceTime: true });
    mockEInvoiceApi(
      ALL,
      routes(5_000_000, [
        listItemJson({
          id: "e-1",
          shipmentId: "shp-1",
          status: "ISSUED",
          invoiceNumber: 42,
          symbol: "C26TAA",
          templateCode: "1",
        }),
        listItemJson({ id: "e-2", shipmentId: "shp-2", status: "DRAFT", code: "HDDT-0002" }),
      ]),
    );
    renderEInvoiceScreen(<OrderSettlementPanel {...props} />);
    expect(await screen.findByText("HD-20261108-000013-1")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "1C26TAA-0000042" })).toBeInTheDocument();
    const checks = screen.getByRole("region", { name: "Điều kiện hoàn tất" });
    const row = (text: RegExp) => within(checks).getByText(text).closest("li")!;
    expect(row(/Hết hạn đổi \/ trả/)).toHaveAttribute("data-met", "true");
    expect(row(/Mọi đợt thanh toán/)).toHaveAttribute("data-met", "false");
    expect(row(/Không có yêu cầu trả hàng/)).toHaveAttribute("data-met", "true");
    expect(row(/Mọi lần giao đã có hoá đơn/)).toHaveAttribute("data-met", "false");
    expect(
      within(checks).getByText(/Còn 1 lần giao chưa có hoá đơn phát hành/),
    ).toBeInTheDocument();
  });

  it("says when a completed order closes, and lists no conditions", async () => {
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel {...props} status="Completed" completedAt="2026-11-10T17:30:00Z" />,
    );
    expect(await screen.findByText(/tự đóng ngày/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Điều kiện hoàn tất" })).not.toBeInTheDocument();
  });

  it("shows only the parts the account may read; nothing without any of the permissions", async () => {
    const api = mockEInvoiceApi([EINVOICE_PERMISSIONS.read], routes(0, []));
    renderEInvoiceScreen(<OrderSettlementPanel {...props} />);
    expect(await screen.findByRole("region", { name: "Hoá đơn điện tử" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Đợt thanh toán" })).not.toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/installments/orders/ord-13")).toBe(false);
  });
});
