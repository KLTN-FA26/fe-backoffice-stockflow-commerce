import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage } from "@/test/api-screen";

import { RefundDetail, RefundList } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  mockPaymentApi,
  refundJson,
  renderPaymentScreen,
} from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const settlement = {
  settlementId: "stl-1",
  kind: "ORDER_CANCELLED",
  collected: 12_000_000,
  closed: 0,
  reduced: 28_000_000,
  surplus: 12_000_000,
  fee: 0,
  feeCovered: 0,
  refundable: 12_000_000,
  feeOwed: 0,
  settledAt: "2026-10-25T04:00:00Z",
};
const record = {
  refundRecordId: "rfd-1",
  orderId: "ord-15",
  orderNumber: "SO-20261108-000015",
  customerId: "cust-4",
  amount: 5_000_000,
  currency: "VND",
  refundedOn: "2026-11-01",
  reference: "FT26313987654",
  status: "RECORDED",
  recordedAt: "2026-11-01T03:00:00Z",
};
const detail = (over: Record<string, unknown> = {}) =>
  refundJson({ settlements: [settlement], records: [], ...over });

describe("RefundList (docs 15 §4.5, §5.3)", () => {
  it("shows refund standing as 'Chờ hoàn' / 'Hoàn một phần' / 'Đã hoàn', with the amount still to refund", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/refunds": () =>
          bePage([
            refundJson(),
            refundJson({
              orderId: "ord-2",
              orderNumber: "SO-2",
              refundStatus: "PARTIALLY_REFUNDED",
              refunded: 4_000_000,
              remaining: 8_000_000,
            }),
            refundJson({
              orderId: "ord-3",
              orderNumber: "SO-3",
              refundStatus: "REFUNDED",
              refunded: 12_000_000,
              remaining: 0,
            }),
          ]),
      },
    });
    renderPaymentScreen(<RefundList />);
    expect(await screen.findByText("Chờ hoàn")).toBeInTheDocument();
    expect(screen.getByText("Hoàn một phần")).toBeInTheDocument();
    // "Đã hoàn" is also a column header ("Đã hoàn" = amount refunded) — pick the status cell
    const row = screen.getByText("SO-3").closest("tr")!;
    expect(within(row).getByText("Đã hoàn")).toBeInTheDocument();
  });

  it("'outstanding=true' from the URL is sent to the BE", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: { "/refunds": () => bePage([refundJson()]) },
    });
    renderPaymentScreen(<RefundList />, "?outstanding=true");
    await screen.findByText("Chờ hoàn");
    const query = (
      api.get.mock.calls.find(([url]) => url === "/refunds")?.[1] as {
        params: URLSearchParams;
      }
    ).params;
    expect(query.get("outstanding")).toBe("true");
  });
});

describe("RefundDetail — record a refund paid outside the system (docs 15 §4.5 step 16, BR-14)", () => {
  const routes = (post?: () => unknown, got = detail()) => ({
    get: { "/refunds/orders/ord-15": () => got },
    post: {
      "/refunds/orders/ord-15/records": post ?? (() => detail({ records: [record] })),
      "/refunds/records/rfd-1/void": () => detail(),
    },
  });

  it("explains the amount, settlements and that the transfer itself is outside the system", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    expect(await screen.findByText("Huỷ đơn")).toBeInTheDocument();
    expect(screen.getByText(/ngoài hệ thống/)).toBeInTheDocument();
    expect(screen.getByText("Chưa ghi nhận lần hoàn nào.")).toBeInTheDocument();
  });

  it("records an amount, date and outgoing statement reference — amount prefilled with what is left", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ghi nhận đã hoàn" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByLabelText(/Số tiền đã hoàn/)).toHaveValue("12000000");
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313987654");
    await userEvent.click(dialog.getByRole("button", { name: "Ghi nhận đã hoàn" }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body] = api.post.mock.calls[0]!;
    expect(url).toBe("/refunds/orders/ord-15/records");
    expect(body).toMatchObject({ amount: 12_000_000, reference: "FT26313987654" });
  });

  it("BR-14: more than what is left to refund is refused inline", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ghi nhận đã hoàn" }));
    const dialog = within(await screen.findByRole("dialog"));
    const amount = dialog.getByLabelText(/Số tiền đã hoàn/);
    await userEvent.clear(amount);
    await userEvent.type(amount, "12000001");
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT1");
    await userEvent.click(dialog.getByRole("button", { name: "Ghi nhận đã hoàn" }));
    expect(await dialog.findByText("Không vượt số còn phải hoàn")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("a BE refusal is shown in Vietnamese", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS,
      routes(() => {
        throw apiError(409, "REFUND_REFERENCE_IN_USE");
      }),
    );
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ghi nhận đã hoàn" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313987654");
    await userEvent.click(dialog.getByRole("button", { name: "Ghi nhận đã hoàn" }));
    expect(
      await dialog.findByText("Mã tham chiếu sao kê này đã được ghi cho một lần hoàn khác."),
    ).toBeInTheDocument();
  });

  it("a record made wrong is voided with a reason", async () => {
    const api = mockPaymentApi(
      ACCOUNTANT_GRANTS,
      routes(
        undefined,
        detail({
          records: [record],
          refunded: 5_000_000,
          remaining: 7_000_000,
          refundStatus: "PARTIALLY_REFUNDED",
        }),
      ),
    );
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ ghi nhận" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Lý do huỷ ghi nhận/), "Nhập nhầm số tiền");
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ ghi nhận" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/refunds/records/rfd-1/void", {
        reason: "Nhập nhầm số tiền",
      }),
    );
  });

  it("sales follows the refund but cannot record or void; nothing left to refund hides the record button", async () => {
    mockPaymentApi(SALES_GRANTS, routes(undefined, detail({ records: [record] })));
    const view = renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await screen.findByText("FT26313987654");
    expect(screen.queryByRole("button", { name: "Ghi nhận đã hoàn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ ghi nhận" })).not.toBeInTheDocument();
    view.unmount();
    mockPaymentApi(
      ACCOUNTANT_GRANTS,
      routes(undefined, detail({ refundStatus: "REFUNDED", refunded: 12_000_000, remaining: 0 })),
    );
    renderPaymentScreen(<RefundDetail orderId="ord-15" />);
    await screen.findByText("Huỷ đơn");
    expect(screen.queryByRole("button", { name: "Ghi nhận đã hoàn" })).not.toBeInTheDocument();
  });
});
