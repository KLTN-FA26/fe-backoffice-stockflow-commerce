import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHIPMENT_PERMISSIONS } from "@/constants";
import type { PermissionCode } from "@/lib/auth";
import { toast } from "@/components/shared/Toast";
import { bePage } from "@/test/api-screen";
import "@/test/jsdom-popover";

import { InstallmentList, OrderInstallmentsView } from "..";
import {
  ACCOUNTANT_GRANTS,
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

const due = installmentJson();
// Another payable installment of the same customer, on another order.
const other = installmentJson({
  installmentId: "inst-7",
  seq: 3,
  name: "Thanh toán sau giao",
  milestone: "AFTER_DELIVERY",
  deliveryBatchSeq: undefined,
  contractNumber: "HD-20261109-000014-1",
  orderId: "ord-14",
  orderNumber: "SO-20261109-000014",
  amount: 10_000_000,
  outstanding: 10_000_000,
  dueDate: "2026-12-05",
});

async function openDialog(items: unknown[], post: () => unknown = () => receiptJson()) {
  const api = mockPaymentApi(ACCOUNTANT_GRANTS, {
    get: { "/installments": () => bePage(items) },
    post: { "/payment-receipts": post },
  });
  renderPaymentScreen(<InstallmentList />);
  await userEvent.click(
    (await screen.findAllByRole("button", { name: /^Lập phiếu thu — / }))[0] as HTMLElement,
  );
  return { api, dialog: within(await screen.findByRole("dialog")) };
}

describe("Receipt dialog — the installment it was opened from (S07-3)", () => {
  it("shows that installment as plain text with what it owes, not a box to choose from; no trash on a single line", async () => {
    const { dialog } = await openDialog([due]);
    expect(dialog.getByText("Đợt 2 — Trả trước khi nhận đợt giao 1")).toBeInTheDocument();
    // Order, contract and what is still owed sit under the name (the due day too when there is one).
    expect(
      dialog.getByText(/SO-20261108-000013 · HD-20261108-000013-1 · còn 25\.000\.000/),
    ).toBeInTheDocument();
    expect(dialog.queryByRole("combobox")).toBeNull();
    expect(dialog.queryByRole("button", { name: /^Bỏ dòng/ })).toBeNull();
    expect(dialog.getByLabelText(/Số tiền/)).toHaveValue("25.000.000");
  });

  it("with no other payable installment of the customer, adding another is disabled and says why", async () => {
    const { dialog } = await openDialog([due]);
    const add = dialog.getByRole("button", { name: /Thêm đợt khác/ });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("title", "Khách này không còn đợt nào để ghi thêm.");
  });

  it("an added line is a search box: find by order number, grouped by order; both lines then get a trash button", async () => {
    const { api, dialog } = await openDialog([due, other]);
    const user = userEvent.setup();
    await user.click(dialog.getByRole("button", { name: /Thêm đợt khác/ }));

    const box = await dialog.findByRole("combobox", { name: "Đợt thanh toán" });
    await user.type(box, "000014");
    // The order is the group heading; the row has the installment and its contract / due day / what is owed.
    expect(await screen.findByText("Đơn SO-20261109-000014")).toBeInTheDocument();
    const option = screen.getByRole("option", { name: /Đợt 3 — Thanh toán sau giao/ });
    expect(option).toHaveTextContent("HD-20261109-000014-1");
    expect(option).toHaveTextContent("còn 10.000.000");
    await user.click(option);

    // Picking prefills what it still owes.
    const amounts = dialog.getAllByLabelText(/Số tiền/);
    expect(amounts.map((input) => (input as HTMLInputElement).value)).toEqual([
      "25.000.000",
      "10.000.000",
    ]);
    expect(dialog.getAllByRole("button", { name: /^Bỏ dòng/ })).toHaveLength(2);
    expect(dialog.getByText("Tổng phiếu thu:")).toHaveTextContent("35.000.000");

    await user.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313123456");
    await user.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0]?.[1]).toMatchObject({
      lines: [
        { installmentId: "inst-2", amount: 25_000_000 },
        { installmentId: "inst-7", amount: 10_000_000 },
      ],
    });
  });

  it("the box offers only installments not already on the receipt, and says when nothing matches", async () => {
    const { dialog } = await openDialog([due, other]);
    const user = userEvent.setup();
    await user.click(dialog.getByRole("button", { name: /Thêm đợt khác/ }));
    const box = await dialog.findByRole("combobox", { name: "Đợt thanh toán" });
    await user.type(box, "000013"); // the order of the installment already on the receipt
    expect(await screen.findByText("Không có đợt nào khớp.")).toBeInTheDocument();
  });
});

describe("After 'Lập phiếu thu' (S07-5)", () => {
  it("says the amount and the statement reference, and keeps a link to the receipt on the page", async () => {
    const success = vi.spyOn(toast, "success");
    const { dialog } = await openDialog([due]);
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313123456");
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    // formatMoney writes "25.000.000 ₫" with a no-break space.
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(success.mock.calls[0]?.[0]).toBe("Đã lập phiếu thu");
    expect(success.mock.calls[0]?.[1]).toMatch(/^25\.000\.000\s₫ — mã sao kê FT26313123456$/);
    const link = await screen.findByRole("link", { name: "Xem phiếu thu" });
    expect(link).toHaveAttribute("href", "/admin/payment/receipts/rcp-1");
    expect(screen.getByText(/Đã lập phiếu thu 25\.000\.000\s₫/)).toBeInTheDocument();
    // Not from a load's handover block: no way back to a load.
    expect(screen.queryByRole("link", { name: /Quay lại chuyến/ })).toBeNull();
  });
});

describe("After 'Lập phiếu thu' from a load's handover block (S07-5)", () => {
  const orderView = {
    orderId: "ord-13",
    orderNumber: "SO-20261108-000013",
    contractNumber: "HD-20261108-000013-1",
    paymentStatus: "UNPAID",
    total: 25_000_000,
    paid: 0,
    outstanding: 25_000_000,
    onSigningPaid: true,
    beforeDeliveryUnpaid: 25_000_000,
    dueBeforeHandover: 25_000_000,
    currency: "VND",
    installments: [due],
  };
  const LOAD = "4f0c6a52-1c63-4f4c-9d5e-0a8f6c2e7b10";

  async function record(
    search: string,
    grants: PermissionCode[] = [...ACCOUNTANT_GRANTS, SHIPMENT_PERMISSIONS.read],
  ) {
    mockPaymentApi(grants, {
      get: { "/installments/orders/ord-13": () => orderView, "/installments": () => bePage([due]) },
      post: { "/payment-receipts": () => receiptJson() },
    });
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />, search);
    await userEvent.click(await screen.findByRole("button", { name: /^Lập phiếu thu — / }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313123456");
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
  }

  it("keeps a way back to the load the accountant came from", async () => {
    await record(`?loadId=${LOAD}&loadCode=LD-20261126-0001`);
    const back = await screen.findByRole("link", { name: "Quay lại chuyến LD-20261126-0001" });
    expect(back).toHaveAttribute("href", `/admin/loads/${LOAD}`);
    expect(screen.getByRole("link", { name: "Xem phiếu thu" })).toBeInTheDocument();
  });

  it("without permission to read loads there is no link to a page that would refuse them", async () => {
    await record(`?loadId=${LOAD}&loadCode=LD-20261126-0001`, ACCOUNTANT_GRANTS);
    await screen.findByRole("link", { name: "Xem phiếu thu" });
    expect(screen.queryByRole("link", { name: /Quay lại chuyến/ })).toBeNull();
  });

  it("a load code or id that is not shaped like one is ignored, never turned into a link", async () => {
    await record(`?loadId=${LOAD}&loadCode=${encodeURIComponent("<b>x</b> javascript:1")}`);
    await screen.findByRole("link", { name: "Xem phiếu thu" });
    expect(screen.queryByRole("link", { name: /Quay lại chuyến/ })).toBeNull();
  });

  it("the order page keeps only what the accountant needs per row (Còn phải thu), so no column is hidden under the actions", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: { "/installments/orders/ord-13": () => orderView },
    });
    renderPaymentScreen(<OrderInstallmentsView orderId="ord-13" />);
    await screen.findByText("Tình hình thanh toán của đơn");
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(headers).toEqual(["Đợt", "Hạn trả", "Còn phải thu", "Trạng thái", "Thao tác"]);
  });
});
