import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage } from "@/test/api-screen";

import { InstallmentList } from "..";
import {
  ACCOUNTANT_GRANTS,
  PAGE_ONLY_GRANTS,
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

const due = installmentJson();
const paid = installmentJson({
  installmentId: "inst-1",
  seq: 1,
  name: "Đặt cọc",
  milestone: "ON_SIGNING",
  deliveryBatchSeq: undefined,
  paidAmount: 20_000_000,
  outstanding: 0,
  status: "PAID",
});
const overdue = installmentJson({
  installmentId: "inst-4",
  seq: 4,
  name: "Còn lại sau giao",
  milestone: "AFTER_DELIVERY",
  deliveryBatchSeq: undefined,
  dueDate: "2026-10-30",
  status: "OVERDUE",
});

const listRoutes = (items: unknown[] = [due, paid, overdue]) => ({
  "/installments": () => bePage(items),
});

describe("InstallmentList — what the accountant sees (docs 15 §5.1)", () => {
  it("shows each installment with its milestone, tied delivery batch, status and what blocks the handover", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    const row = (await screen.findAllByText("HD-20261108-000013-1"))[0]!.closest("tr")!;
    expect(within(row).getByText("Trước khi giao")).toBeInTheDocument();
    expect(within(row).getByText("Đợt giao 1")).toBeInTheDocument();
    expect(within(row).getByText("Đang chặn bàn giao")).toBeInTheDocument();
    expect(within(row).getByText("Đến hạn")).toBeInTheDocument();
    expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();
    expect(screen.getByText("Quá hạn")).toBeInTheDocument();
  });

  it("offers 'Lập phiếu thu' only on installments that still take money", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    await screen.findByText("Đến hạn");
    // Due + Overdue take money; the Paid one does not
    expect(screen.getAllByRole("button", { name: "Lập phiếu thu" })).toHaveLength(2);
  });

  it("sales can read the installments but gets no receipt button", async () => {
    mockPaymentApi(SALES_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    await screen.findByText("Đến hạn");
    expect(screen.queryByRole("button", { name: "Lập phiếu thu" })).not.toBeInTheDocument();
  });

  it("a user who may open the page but not read data is told so, and no list is requested", async () => {
    const api = mockPaymentApi(PAGE_ONLY_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByText(/chưa có quyền xem đợt thanh toán/)).toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/installments")).toBe(false);
  });

  it("sends the filters from the URL; 'Công nợ phải thu' is milestone AFTER_DELIVERY + reached (docs 15 §4.3)", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([overdue]) });
    renderPaymentScreen(
      <InstallmentList />,
      "?milestone=AFTER_DELIVERY&reached=true&status=OVERDUE&customerId=cust-9&dueBefore=2026-12-01",
    );
    await screen.findByText("Quá hạn");
    const params = api.get.mock.calls.find(([url]) => url === "/installments")?.[1] as {
      params: URLSearchParams;
    };
    expect(Object.fromEntries(params.params)).toMatchObject({
      milestone: "AFTER_DELIVERY",
      reached: "true",
      status: "OVERDUE",
      customerId: "cust-9",
      dueBefore: "2026-12-01",
      page: "0",
    });
    expect(screen.getByRole("button", { name: "Công nợ phải thu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("empty list vs filtered-out list are two different messages", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([]) });
    const view = renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByText("Chưa có đợt thanh toán")).toBeInTheDocument();
    view.unmount();
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([]) });
    renderPaymentScreen(<InstallmentList />, "?status=PAID");
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
  });
});

describe("Record a receipt from a due installment (WF4 X03: pay BEFORE_DELIVERY → handover unblocked)", () => {
  const receiptRoutes = (post: () => unknown) => ({
    get: listRoutes([due]),
    post: { "/payment-receipts": post },
  });

  async function openDialog() {
    renderPaymentScreen(<InstallmentList />);
    await userEvent.click(await screen.findByRole("button", { name: "Lập phiếu thu" }));
    return within(await screen.findByRole("dialog"));
  }

  it("posts the statement reference, date and one line prefilled with what is still owed", async () => {
    const api = mockPaymentApi(
      ACCOUNTANT_GRANTS,
      receiptRoutes(() => receiptJson()),
    );
    const dialog = await openDialog();
    expect(dialog.getByLabelText(/Số tiền/)).toHaveValue("25000000");
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313123456");
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body] = api.post.mock.calls[0]!;
    expect(url).toBe("/payment-receipts");
    expect(body).toMatchObject({
      customerId: "cust-9",
      reference: "FT26313123456",
      lines: [{ installmentId: "inst-2", amount: 25_000_000 }],
    });
    expect((body as { receivedOn: string }).receivedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("BR-05: a line above what the installment still owes is refused inline, nothing is sent", async () => {
    const api = mockPaymentApi(
      ACCOUNTANT_GRANTS,
      receiptRoutes(() => receiptJson()),
    );
    const dialog = await openDialog();
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT1");
    const amount = dialog.getByLabelText(/Số tiền/);
    await userEvent.clear(amount);
    await userEvent.type(amount, "25000001");
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    expect(await dialog.findByText("Không vượt số còn phải thu của đợt")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("BR-03: a statement reference already recorded comes back in Vietnamese, never the English BE text", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS,
      receiptRoutes(() => {
        throw apiError(409, "PAYMENT_RECEIPT_REFERENCE_IN_USE");
      }),
    );
    const dialog = await openDialog();
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313123456");
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    expect(
      await dialog.findByText(
        "Mã tham chiếu sao kê này đã được ghi trong một phiếu thu còn hiệu lực.",
      ),
    ).toBeInTheDocument();
  });

  it("an empty reference is flagged before anything is sent", async () => {
    const api = mockPaymentApi(
      ACCOUNTANT_GRANTS,
      receiptRoutes(() => receiptJson()),
    );
    const dialog = await openDialog();
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    expect(await dialog.findByText("Nhập mã tham chiếu sao kê")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
});
