import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage } from "@/test/api-screen";

import { ReceiptDetail, ReceiptList } from "..";
import {
  ACCOUNTANT_GRANTS,
  SALES_GRANTS,
  installmentJson,
  mockPaymentApi,
  receiptJson,
  renderPaymentScreen,
} from "../__fixtures__/screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => vi.restoreAllMocks());

const detail = (over: Record<string, unknown> = {}) =>
  receiptJson({
    note: "Chuyển khoản đợt giao 1",
    lines: [
      {
        installmentId: "inst-2",
        amount: 25_000_000,
        contractNumber: "HD-20261108-000013-1",
        orderId: "ord-13",
        orderNumber: "SO-20261108-000013",
        seq: 2,
        name: "Trả trước khi nhận đợt giao 1",
        milestone: "BEFORE_DELIVERY",
      },
    ],
    ...over,
  });

describe("ReceiptList (docs 15 §5.3)", () => {
  it("lists receipts with their status; Recorded and Voided read differently", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/payment-receipts": () =>
          bePage([
            receiptJson(),
            receiptJson({ receiptId: "rcp-2", reference: "FT26311999333", status: "VOIDED" }),
          ]),
      },
    });
    renderPaymentScreen(<ReceiptList />);
    expect(await screen.findByText("FT26313123456")).toBeInTheDocument();
    expect(screen.getByText("Đã ghi nhận")).toBeInTheDocument();
    expect(screen.getByText("Đã huỷ")).toBeInTheDocument();
  });

  it("sends the exact statement reference and status from the URL", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: { "/payment-receipts": () => bePage([receiptJson()]) },
    });
    renderPaymentScreen(
      <ReceiptList />,
      "?reference=FT26313123456&status=RECORDED&customerId=cust-9",
    );
    await screen.findByText("FT26313123456");
    const query = (
      api.get.mock.calls.find(([url]) => url === "/payment-receipts")?.[1] as {
        params: URLSearchParams;
      }
    ).params;
    expect(Object.fromEntries(query)).toMatchObject({
      reference: "FT26313123456",
      status: "RECORDED",
      customerId: "cust-9",
    });
  });
});

describe("ReceiptDetail — void a wrongly entered receipt (docs 15 §4.4, BR-04)", () => {
  const routes = (post?: () => unknown) => ({
    get: { "/payment-receipts/rcp-1": () => detail() },
    post: {
      "/payment-receipts/rcp-1/void":
        post ?? (() => detail({ status: "VOIDED", voidReason: "Nhầm khách" })),
    },
  });

  it("accountant voids with a reason; holdOrders defaults to false", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Lý do huỷ phiếu thu/), "Nhầm khách");
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/payment-receipts/rcp-1/void", {
        reason: "Nhầm khách",
        holdOrders: false,
      }),
    );
  });

  it("a reason is required — nothing is sent without it", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    expect(await dialog.findByText("Nhập lý do")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("BR-13: when the void leaves a confirmed order short, BE asks for the hold; ticking 'Treo đơn' retries with holdOrders", async () => {
    const post = vi
      .fn()
      .mockImplementationOnce(() => {
        throw apiError(409, "PAYMENT_RECEIPT_VOID_NEEDS_HOLD");
      })
      .mockImplementation(() => detail({ status: "VOIDED" }));
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, routes(post));
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Huỷ phiếu thu" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Lý do huỷ phiếu thu/), "Ghi sai số tiền");
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    expect(
      await dialog.findByText(/Huỷ phiếu này làm đơn đã xác nhận thiếu đợt khi ký/),
    ).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("checkbox"));
    await userEvent.click(dialog.getByRole("button", { name: "Huỷ phiếu thu" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenLastCalledWith("/payment-receipts/rcp-1/void", {
        reason: "Ghi sai số tiền",
        holdOrders: true,
      }),
    );
  });

  it("a voided receipt keeps its history and shows no void button", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/payment-receipts/rcp-1": () =>
          detail({
            status: "VOIDED",
            voidedAt: "2026-11-11T03:00:00Z",
            voidReason: "Nhầm khách",
          }),
      },
    });
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    expect(await screen.findByText(/Nhầm khách/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ phiếu thu" })).not.toBeInTheDocument();
  });

  it("without payment-receipts:UPDATE the receipt is readable but cannot be voided", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS.filter((code) => code !== "payment-receipts:UPDATE"),
      routes(),
    );
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    expect(await screen.findByText("FT26313123456")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Huỷ phiếu thu" })).not.toBeInTheDocument();
  });

  it("a user without payment-receipts permissions is refused the page", async () => {
    mockPaymentApi(SALES_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("FT26313123456")).not.toBeInTheDocument();
  });

  it("lists the installments the receipt paid, linked to their detail", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, routes());
    renderPaymentScreen(<ReceiptDetail id="rcp-1" />);
    const line = (await screen.findByText(/Trả trước khi nhận đợt giao 1/)).closest("li")!;
    expect(within(line).getByText("Trước khi giao")).toBeInTheDocument();
    expect(within(line).getByRole("link", { name: "HD-20261108-000013-1" })).toHaveAttribute(
      "href",
      "/admin/payment/installments/inst-2",
    );
    expect(installmentJson().installmentId).toBe("inst-2");
  });
});
