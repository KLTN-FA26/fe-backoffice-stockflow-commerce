import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SETTLEMENT_READINESS_LABELS } from "@/constants";

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_REFUND_PERMISSIONS } from "@/constants/payment";
import { ApiError } from "@/lib/api/error";
import {
  bePage,
  detailJson,
  listItemJson,
  mockEInvoiceApi,
  renderEInvoiceScreen,
} from "@/features/einvoice/__fixtures__/screen";

import { settlementReadinessDtoSchema } from "@/features/order/schemas";

import { OrderSettlementPanel } from "./OrderSettlementPanel";

import type { SettlementReadiness } from "@/features/order/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/orders/ord-13",
  useSearchParams: () => new URLSearchParams(),
}));

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
  completionHeld: false as boolean | null,
  settlementReadiness: null as SettlementReadiness | null,
  returnWindowDays: null as number | null,
};
/** Khối điều kiện của BE (F-1) đã qua mapper — mọi field có giá trị mặc định "không chặn". */
const readiness = (over: Partial<SettlementReadiness> = {}): SettlementReadiness => ({
  branch: "COMPLETION",
  returnWindowDays: 14,
  returnWindowEndsAt: "2026-11-15T17:00:00Z",
  owing: false,
  openReturn: false,
  uninvoicedShipmentIds: [],
  shippingFeeUninvoiced: false,
  refundOutstanding: false,
  completionHeld: false,
  completesAt: null,
  closesAt: null,
  blockers: [],
  returnAdjustmentUnissued: false,
  completionHoldable: false,
  deliveryReductionUnissued: false,
  ...over,
});
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
    expect(row(/Mọi lô giao đã có hoá đơn/)).toHaveAttribute("data-met", "false");
    expect(within(checks).getByText(/Còn 1 lô giao chưa có hoá đơn phát hành/)).toBeInTheDocument();
    expect(row(/Không bị Sale giữ hoàn tất/)).toHaveAttribute("data-met", "true");
  });

  it("WF-05 GH-2: an open completion hold is a condition not met, pointing at the hold card", async () => {
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(<OrderSettlementPanel {...props} completionHeld />);
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    const row = within(checks)
      .getByText(/Không bị Sale giữ hoàn tất/)
      .closest("li");
    expect(row).toHaveAttribute("data-met", "false");
    expect(within(checks).getByText(/gỡ giữ ở thẻ/)).toBeInTheDocument();
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

  it("BO-02: BE readiness present → only the BE's blockers are listed, no local rule is recomputed", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-20T00:00:00Z"), shouldAdvanceTime: true });
    // Local data would say "unpaid" and "1 shipment without invoice"; the BE says only the window is open
    mockEInvoiceApi(ALL, routes(5_000_000, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        settlementReadiness={readiness({
          blockers: [{ code: "RETURN_WINDOW_OPEN", known: true }],
          returnWindowEndsAt: "2026-11-25T17:00:00Z",
          returnWindowDays: 14,
        })}
      />,
    );
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    expect(within(checks).getByText(/Chưa hết hạn đổi \/ trả/)).toBeInTheDocument();
    expect(within(checks).getByText(/14 ngày theo hợp đồng/)).toBeInTheDocument();
    expect(within(checks).queryByText(/Mọi đợt thanh toán/)).not.toBeInTheDocument();
    expect(within(checks).queryByText(/lô giao chưa có hoá đơn/)).not.toBeInTheDocument();
    expect(within(checks).queryByText(/Ước tính/)).not.toBeInTheDocument();
  });

  it("BO-02: refund branch shows its closing conditions (refund outstanding, invoices) and the Q-16 info row", async () => {
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        status="Partially Refunded"
        settlementReadiness={readiness({
          branch: "REFUND_CLOSE",
          blockers: [
            { code: "REFUND_OUTSTANDING", known: true },
            { code: "SHIPMENT_UNINVOICED", known: true },
            { code: "SOMETHING_NEW", known: false },
          ],
          uninvoicedShipmentIds: ["shp-2"],
          returnAdjustmentUnissued: true,
        })}
      />,
    );
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    expect(within(checks).getByText(/tự đóng đơn sau hoàn tiền/)).toBeInTheDocument();
    expect(within(checks).getByText(/Còn tiền phải hoàn cho khách/)).toBeInTheDocument();
    expect(within(checks).getByText(/1 lô giao chưa có hoá đơn phát hành/)).toBeInTheDocument();
    expect(
      within(checks).getByText(/Điều kiện khác chưa đạt \(SOMETHING_NEW\)/),
    ).toBeInTheDocument();
    expect(within(checks).getByText(/không chặn đóng đơn/)).toBeInTheDocument();
  });

  it("audit r2 M-4 / money L-2: a completed order (branch NONE) still lists its blockers and promises no closing day", async () => {
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        status="Return Requested"
        completedAt="2026-11-10T17:30:00Z"
        settlementReadiness={readiness({
          branch: "NONE",
          closesAt: "2026-12-10T17:30:00Z",
          blockers: [{ code: "OPEN_RETURN", known: true }],
        })}
      />,
    );
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    expect(within(checks).getByText("Còn yêu cầu trả hàng đang mở")).toBeInTheDocument();
    expect(within(checks).queryByText(/tự đóng trong lần chạy đêm/)).not.toBeInTheDocument();
  });

  it("branch NONE with no blocker keeps the BE's closing day", async () => {
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        status="Completed"
        completedAt="2026-11-10T17:30:00Z"
        settlementReadiness={readiness({ branch: "NONE", closesAt: "2026-12-10T17:30:00Z" })}
      />,
    );
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    expect(within(checks).getByText(/tự đóng trong lần chạy đêm/)).toBeInTheDocument();
    expect(within(checks).queryByRole("list")).not.toBeInTheDocument();
  });

  it("BO-02: no blocker → met line and the BE's completion day", async () => {
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        settlementReadiness={readiness({ completesAt: "2026-11-20T17:30:00Z" })}
      />,
    );
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    expect(within(checks).getByText("Đủ điều kiện.").closest("li")).toHaveAttribute(
      "data-met",
      "true",
    );
    expect(within(checks).getByText(/tự hoàn tất trong lần chạy đêm/)).toBeInTheDocument();
  });

  it("BO-02 fallback (BE without readiness): window from the contract, not a fixed 7 days", async () => {
    // Delivered 1/11, 7 days would have passed on 20/11; the contract says 30
    vi.useFakeTimers({ now: new Date("2026-11-20T00:00:00Z"), shouldAdvanceTime: true });
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(<OrderSettlementPanel {...props} returnWindowDays={30} />);
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    const row = within(checks)
      .getByText(/Hết hạn đổi \/ trả 30 ngày/)
      .closest("li");
    expect(row).toHaveAttribute("data-met", "false");
    expect(within(checks).getByText(/Ước tính/)).toBeInTheDocument();
  });

  it("BO-02 fallback: an order without an installment plan (404) is not owing", async () => {
    mockEInvoiceApi(ALL, {
      get: {
        ...routes(0, []).get,
        "/installments/orders/ord-13": () => {
          throw new ApiError(404, "NOT_FOUND", "no plan");
        },
      },
    });
    renderEInvoiceScreen(<OrderSettlementPanel {...props} />);
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    await vi.waitFor(() =>
      expect(
        within(checks)
          .getByText(/Mọi đợt thanh toán/)
          .closest("li"),
      ).toHaveAttribute("data-met", "true"),
    );
  });

  describe("audit r2 FE pass 2", () => {
    const refundJson = (over: Record<string, unknown> = {}) => ({
      orderId: "ord-13",
      orderNumber: "SO-13",
      currency: "VND",
      refundStatus: "NONE",
      refundable: 0,
      refunded: 0,
      remaining: 0,
      feeOwed: 0,
      settlements: [],
      ...over,
    });
    const settlement = (shippingFeeWaived: number) => ({
      settlementId: "stl-1",
      kind: "SHIPMENT_RETURNED",
      collected: 0,
      closed: 0,
      reduced: 0,
      surplus: 0,
      fee: 0,
      feeCovered: 0,
      refundable: 0,
      feeOwed: 0,
      settledAt: "2026-11-20T00:00:00Z",
      shippingFeeWaived,
    });
    const withRefund = (refund: unknown) => ({
      get: { ...routes(0, []).get, "/refunds/orders/ord-13": () => refund },
    });

    it("money M-4 (BO): nothing refundable but a waived shipping fee → the Hoàn tiền row still shows, with the fee", async () => {
      mockEInvoiceApi(ALL, withRefund(refundJson({ settlements: [settlement(300_000)] })));
      renderEInvoiceScreen(<OrderSettlementPanel {...props} status="Returned" />);
      const row = await screen.findByRole("region", { name: "Hoàn tiền" });
      expect(row).toHaveTextContent("Không có tiền phải hoàn");
      expect(row).toHaveTextContent(/phí vận chuyển được miễn 300\.000/);
      expect(row).not.toHaveTextContent("Đã hoàn");
    });

    it("nothing refundable, waived or owed → no Hoàn tiền row", async () => {
      mockEInvoiceApi(ALL, withRefund(refundJson()));
      renderEInvoiceScreen(<OrderSettlementPanel {...props} />);
      expect(await screen.findByRole("region", { name: "Hoá đơn điện tử" })).toBeInTheDocument();
      await screen.findByText(/Chưa có hoá đơn/);
      expect(screen.queryByRole("region", { name: "Hoàn tiền" })).not.toBeInTheDocument();
    });

    it("M-6: a PARTIALLY_REFUNDED order with 0 refunded says nothing was refunded", async () => {
      mockEInvoiceApi(ALL, withRefund(refundJson({ feeOwed: 50_000 })));
      renderEInvoiceScreen(<OrderSettlementPanel {...props} status="Partially Refunded" />);
      expect(await screen.findByText(/Đơn chưa hoàn đồng nào cho khách/)).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Hoàn tiền" })).toHaveTextContent(
        /phí khách còn thiếu 50\.000/,
      );
    });

    it("BE-45: REFUND_CLOSE of an order the carrier ended is not called “after a refund”; the fee rest includes the plate fee", async () => {
      mockEInvoiceApi(ALL, routes(0, []));
      renderEInvoiceScreen(
        <OrderSettlementPanel
          {...props}
          status="Returned"
          deliveredAt={null}
          settlementReadiness={readiness({
            branch: "REFUND_CLOSE",
            blockers: [{ code: "SHIPPING_FEE_UNINVOICED", known: true }],
            shippingFeeUninvoiced: true,
          })}
        />,
      );
      const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
      expect(within(checks).getByText(/hàng không giao được/)).toBeInTheDocument();
      expect(within(checks).queryByText(/sau hoàn tiền/)).not.toBeInTheDocument();
      expect(within(checks).getByText(/vận chuyển, phí khuôn/)).toBeInTheDocument();
    });
  });
});

describe("audit r3 (BE r3b): EINV-7 information line, LM-2 fee-rest draw-up", () => {
  it("EINV-7: an unissued failed-delivery reduction is an information line, never a blocker", async () => {
    mockEInvoiceApi(ALL, routes(0, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        status="Returned"
        settlementReadiness={readiness({ branch: "REFUND_CLOSE", deliveryReductionUnissued: true })}
      />,
    );
    const checks = await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    expect(
      within(checks).getByText(SETTLEMENT_READINESS_LABELS.deliveryReductionUnissued),
    ).toBeInTheDocument();
    expect(within(checks).getByText("Đủ điều kiện.")).toBeInTheDocument();
  });

  it("an older BE without the flag shows no such line", () => {
    const parsed = settlementReadinessDtoSchema.parse({ branch: "REFUND_CLOSE" });
    expect(parsed.deliveryReductionUnissued).toBe(false);
  });

  it("SHIPPING_FEE_UNINVOICED offers the fee-rest draw-up to whoever may create invoices, posting the order only", async () => {
    const user = userEvent.setup();
    const api = mockEInvoiceApi(ALL, {
      ...routes(0, []),
      post: {
        "/einvoices": () => detailJson({ id: "e-rest", type: "ADJUSTMENT", status: "DRAFT" }),
      },
    });
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        status="Returned"
        settlementReadiness={readiness({
          branch: "REFUND_CLOSE",
          shippingFeeUninvoiced: true,
          blockers: [{ code: "SHIPPING_FEE_UNINVOICED", known: true }],
        })}
      />,
    );
    await user.click(
      await screen.findByRole("button", { name: SETTLEMENT_READINESS_LABELS.drawUpFeeRest }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Lập/ }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/einvoices",
        expect.objectContaining({ orderId: "ord-13", shipmentId: undefined }),
      ),
    );
  });

  it("SHIPMENT_UNINVOICED offers the draw-up too: a delivered shipment whose automatic draft was refused can be picked and posted", async () => {
    const user = userEvent.setup();
    const api = mockEInvoiceApi(ALL, {
      get: {
        ...routes(0, []).get,
        "/orders/ord-13": () => ({
          orderId: "ord-13",
          shipments: [
            { shipmentId: "shp-7", status: "DELIVERED", outcomeAt: "2026-11-12T03:00:00Z" },
          ],
        }),
      },
      post: { "/einvoices": () => detailJson({ id: "e-new", status: "DRAFT" }) },
    });
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        status="Delivered"
        settlementReadiness={readiness({
          branch: "COMPLETION",
          uninvoicedShipmentIds: ["shp-7"],
          blockers: [{ code: "SHIPMENT_UNINVOICED", known: true }],
        })}
      />,
    );
    await user.click(
      await screen.findByRole("button", { name: SETTLEMENT_READINESS_LABELS.drawUpShipment }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("combobox", { name: /Lô giao/ }));
    await user.click(await screen.findByRole("option", { name: /chưa có hoá đơn/ }));
    await user.click(within(dialog).getByRole("button", { name: "Lập nháp" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/einvoices",
        expect.objectContaining({ orderId: "ord-13", shipmentId: "shp-7" }),
      ),
    );
  });

  it("without einvoices:CREATE the blocker has no button", async () => {
    mockEInvoiceApi([EINVOICE_PERMISSIONS.read], routes(0, []));
    renderEInvoiceScreen(
      <OrderSettlementPanel
        {...props}
        status="Returned"
        settlementReadiness={readiness({
          branch: "REFUND_CLOSE",
          blockers: [{ code: "SHIPPING_FEE_UNINVOICED", known: true }],
        })}
      />,
    );
    await screen.findByRole("region", { name: "Điều kiện hoàn tất" });
    expect(
      screen.queryByRole("button", { name: SETTLEMENT_READINESS_LABELS.drawUpFeeRest }),
    ).not.toBeInTheDocument();
  });
});
