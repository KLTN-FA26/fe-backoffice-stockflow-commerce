import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ORDER_PERMISSIONS } from "@/constants";
import { apiError, bePage } from "@/test/api-screen";
import "@/test/jsdom-popover";

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
  // Overdue is a flag the BE works out from the due day, not a status (WF-05 fix plan §8).
  status: "DUE",
  overdue: true,
});

const listRoutes = (items: unknown[] = [due, paid, overdue]) => ({
  "/installments": () => bePage(items),
});

describe("InstallmentList — the customer is named, not an id (QA A5, BE-15)", () => {
  it("shows the customer name the BE sends and never asks the customer directory the accountant cannot read", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: listRoutes([
        installmentJson({ customerName: "Công ty Bao Bì An Phát", customerCode: "0312345678" }),
      ]),
    });
    renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByText("Công ty Bao Bì An Phát")).toBeInTheDocument();
    expect(screen.queryByText(/^KH /)).not.toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => String(url).startsWith("/customers"))).toBe(false);
  });

  it("falls back to the short code the BE sends, then to a neutral label (never a UUID piece) when there is no name", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: listRoutes([
        installmentJson({ customerCode: "KH0A1B2C3D" }),
        installmentJson({ installmentId: "inst-9", seq: 9 }),
      ]),
    });
    renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByText("KH0A1B2C3D")).toBeInTheDocument();
    expect(screen.queryByText("KH cust-9")).not.toBeInTheDocument();
    expect(screen.getAllByText("Khách hàng", { selector: "span" }).length).toBeGreaterThan(0);
  });
});

describe("InstallmentList — what the accountant sees (docs 15 §5.1)", () => {
  it("shows each installment with its milestone, tied delivery batch, status and what blocks the handover", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    const row = (await screen.findAllByText("HD-20261108-000013-1"))[0]!.closest("tr")!;
    expect(within(row).getByText("Trước khi giao")).toBeInTheDocument();
    expect(within(row).getByText("Đến hạn")).toBeInTheDocument();
    expect(screen.getByText("Đã thanh toán")).toBeInTheDocument();
    expect(screen.getByText(/^Quá hạn \d+ ngày$/)).toBeInTheDocument();
    // BO-UX-38: "Đợt giao" ẩn mặc định — bật lại qua Ẩn hiện cột thì thấy đợt giao + chặn bàn giao
    expect(within(row).queryByText("Đợt giao 1")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ẩn hiện cột" }));
    await userEvent.click(await screen.findByRole("option", { name: "Đợt giao" }));
    expect(await within(row).findByText("Đợt giao 1")).toBeInTheDocument();
    expect(within(row).getByText("Đang chặn bàn giao")).toBeInTheDocument();
    localStorage.clear();
  });

  it("BO-UX-38: 'Hạn trả' and 'Còn phải thu' come before the order and milestone; actions pinned right", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    await screen.findAllByText("HD-20261108-000013-1");
    const headers = screen.getAllByRole("columnheader").map((cell) => cell.textContent ?? "");
    const at = (name: string) => headers.findIndex((text) => text.startsWith(name));
    expect(at("Hạn trả")).toBeLessThan(at("Đơn hàng"));
    expect(at("Còn phải thu")).toBeLessThan(at("Mốc"));
    expect(screen.getByRole("columnheader", { name: "Thao tác" }).className).toContain("sticky");
  });

  it("flags an overdue installment from the BE's overdue flag: real status kept, 'Quá hạn N ngày' next to it", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: listRoutes([installmentJson({ ...overdue, status: "PARTIALLY_PAID", daysOverdue: 12 })]),
    });
    renderPaymentScreen(<InstallmentList />);
    const row = (await screen.findByText("Quá hạn 12 ngày")).closest("tr")!;
    expect(within(row).getByText("HD-20261108-000013-1")).toBeInTheDocument();
    // BO-UX-37: "Thanh toán một phần" không bị "Quá hạn" che mất
    expect(within(row).getByText("Thanh toán một phần")).toBeInTheDocument();
    expect(row).toHaveAttribute("data-flagged", "true");
  });

  it("does not offer 'Quá hạn' as a status filter: the BE refuses status=OVERDUE", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    await screen.findAllByText("Đến hạn");
    await userEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    expect(await screen.findByRole("checkbox", { name: "Chỉ đợt quá hạn" })).toBeInTheDocument();
  });

  it("offers 'Lập phiếu thu' only on installments that still take money", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    await screen.findAllByText("Đến hạn");
    // Due + Overdue take money; the Paid one does not — each button names its contract and installment (BO-UX-11)
    expect(screen.getAllByRole("button", { name: /^Lập phiếu thu — / })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Lập phiếu thu — HD-20261108-000013-1 đợt 4" }),
    ).toBeInTheDocument();
  });

  it("sales can read the installments but gets no receipt button", async () => {
    mockPaymentApi(SALES_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    await screen.findAllByText("Đến hạn");
    expect(screen.queryByRole("button", { name: /^Lập phiếu thu/ })).not.toBeInTheDocument();
  });

  it("a user who may open the page but not read data is told so, and no list is requested", async () => {
    const api = mockPaymentApi(PAGE_ONLY_GRANTS, { get: listRoutes() });
    renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByText(/chưa có quyền xem đợt thanh toán/)).toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/installments")).toBe(false);
  });

  it("sends the filters from the URL; 'Công nợ phải thu' is owing=true (BE-5)", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([overdue]) });
    renderPaymentScreen(
      <InstallmentList />,
      "?owing=true&overdue=true&customerId=cust-9&dueBefore=2026-12-01",
    );
    await screen.findByText(/^Quá hạn/);
    const params = api.get.mock.calls.find(([url]) => url === "/installments")?.[1] as {
      params: URLSearchParams;
    };
    expect(params.params.has("status")).toBe(false);
    expect(params.params.has("milestone")).toBe(false);
    expect(params.params.has("reached")).toBe(false);
    expect(Object.fromEntries(params.params)).toMatchObject({
      owing: "true",
      overdue: "true",
      customerId: "cust-9",
      dueBefore: "2026-12-01",
      page: "0",
    });
    expect(screen.getByRole("button", { name: "Công nợ phải thu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("BE-5: clearing the preset removes owing from the request", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([overdue]) });
    renderPaymentScreen(<InstallmentList />, "?owing=true");
    await userEvent.click(await screen.findByRole("button", { name: "Công nợ phải thu" }));
    await waitFor(() => {
      const calls = api.get.mock.calls.filter(([url]) => url === "/installments");
      expect((calls.at(-1)?.[1] as { params: URLSearchParams }).params.has("owing")).toBe(false);
    });
    expect(screen.getByRole("button", { name: "Công nợ phải thu" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("BE-16: the customer search box sends search= (debounced) and resets to page 1; /customers is never asked", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([due]) });
    renderPaymentScreen(<InstallmentList />);
    const calls = () => api.get.mock.calls.filter(([url]) => url === "/installments");
    await userEvent.type(await screen.findByRole("textbox", { name: /Tìm khách/ }), "an phat");
    await waitFor(() =>
      expect((calls().at(-1)?.[1] as { params: URLSearchParams }).params.get("search")).toBe(
        "an phat",
      ),
    );
    // Typed in one go: the debounce sends one request for the final text, not one per key.
    const searches = calls().map(([, config]) =>
      (config as { params: URLSearchParams }).params.get("search"),
    );
    expect(searches.filter((value) => value !== null && value !== "an phat")).toEqual([]);
    expect((calls().at(-1)?.[1] as { params: URLSearchParams }).params.get("page")).toBe("0");
    expect(api.get.mock.calls.some(([url]) => String(url).startsWith("/customers"))).toBe(false);
  });

  it("BE-16: more than 1000 matching customers (400 fieldErrors.search) says to type something more specific", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/installments": () => {
          throw apiError(400, "VALIDATION_FAILED", { search: "Quá nhiều khách khớp" });
        },
      },
    });
    renderPaymentScreen(<InstallmentList />, "?search=a");
    expect(await screen.findByText("Có quá nhiều khách khớp — gõ cụ thể hơn")).toBeInTheDocument();
  });

  it("TU-3: one plain search box only (no second order combobox); the typed text goes to the one existing search=", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([due]) });
    renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByRole("textbox", { name: /Tìm khách/ })).toBeInTheDocument();
    // The old second field "Tìm đơn (số đơn, tên liên hệ, SĐT)" is gone; nothing opens a list or asks /orders.
    expect(screen.queryByRole("combobox", { name: /Tìm đơn/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: /Tìm khách/ }), "tra sua");
    await waitFor(() => {
      const calls = api.get.mock.calls.filter(([url]) => url === "/installments");
      expect((calls.at(-1)?.[1] as { params: URLSearchParams }).params.get("search")).toBe(
        "tra sua",
      );
    });
    expect(api.get.mock.calls.some(([url]) => url === "/orders")).toBe(false);
  });

  it("WF-02 35: an old ?orderId= link still filters by orderId, names the order in the chip, one click narrows to its customer", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([due]) });
    renderPaymentScreen(<InstallmentList />, "?orderId=ord-13");
    await waitFor(() => {
      const calls = api.get.mock.calls.filter(([url]) => url === "/installments");
      expect((calls.at(-1)?.[1] as { params: URLSearchParams }).params.get("orderId")).toBe(
        "ord-13",
      );
    });
    // The chip names the order (from the filtered rows), then one click narrows to the order's customer.
    expect(
      await screen.findByText("SO-20261108-000013", { selector: "span.font-mono" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Lọc theo khách của đơn" }));
    await waitFor(() => {
      const calls = api.get.mock.calls.filter(([url]) => url === "/installments");
      expect((calls.at(-1)?.[1] as { params: URLSearchParams }).params.get("customerId")).toBe(
        "cust-9",
      );
    });
    expect(api.get.mock.calls.some(([url]) => url === "/customers")).toBe(false);
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
    await userEvent.click(await screen.findByRole("button", { name: /^Lập phiếu thu — / }));
    return within(await screen.findByRole("dialog"));
  }

  it("posts the statement reference, date and one line prefilled with what is still owed", async () => {
    const api = mockPaymentApi(
      ACCOUNTANT_GRANTS,
      receiptRoutes(() => receiptJson()),
    );
    const dialog = await openDialog();
    expect(dialog.getByLabelText(/Số tiền/)).toHaveValue("25.000.000");
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

  it("WF-02 audit 9: the reference-in-use message sits on the field and goes once the reference changes", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS,
      receiptRoutes(() => {
        throw apiError(409, "PAYMENT_RECEIPT_REFERENCE_IN_USE");
      }),
    );
    const dialog = await openDialog();
    const reference = dialog.getByLabelText(/Mã tham chiếu sao kê/);
    await userEvent.type(reference, "FT26313123456");
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    const message = "Mã tham chiếu sao kê này đã được ghi trong một phiếu thu còn hiệu lực.";
    expect(await dialog.findByText(message)).toBeInTheDocument();
    expect(reference).toHaveAttribute("aria-invalid", "true");
    await userEvent.type(reference, "9");
    await waitFor(() => expect(dialog.queryByText(message)).not.toBeInTheDocument());
  });

  it("WF-02 audit 9: EXCEEDS_OUTSTANDING says how much the installment still owes (details.outstanding)", async () => {
    mockPaymentApi(
      ACCOUNTANT_GRANTS,
      receiptRoutes(() => {
        throw apiError(409, "PAYMENT_RECEIPT_EXCEEDS_OUTSTANDING", undefined, undefined, {
          installmentId: "inst-2",
          outstanding: 20_000_000,
          currency: "VND",
        });
      }),
    );
    const dialog = await openDialog();
    await userEvent.type(dialog.getByLabelText(/Mã tham chiếu sao kê/), "FT26313123456");
    await userEvent.click(dialog.getByRole("button", { name: "Lập phiếu thu" }));
    expect(await dialog.findByText(/còn phải thu \(còn 20\.000\.000/)).toBeInTheDocument();
    expect(dialog.getByText(/Vượt số còn phải thu \(20\.000\.000/)).toBeInTheDocument();
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

describe("InstallmentList — order number links only with the order page (AUTH-8)", () => {
  it("without sales-orders:VIEW_PAGE the order number is plain text", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: listRoutes([due]) });
    renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByText("SO-20261108-000013")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "SO-20261108-000013" })).not.toBeInTheDocument();
  });

  it("with the order page it links to the order", async () => {
    mockPaymentApi([...ACCOUNTANT_GRANTS, ORDER_PERMISSIONS.viewPage], {
      get: listRoutes([due]),
    });
    renderPaymentScreen(<InstallmentList />);
    expect(await screen.findByRole("link", { name: "SO-20261108-000013" })).toHaveAttribute(
      "href",
      `/admin/orders/${due.orderId}`,
    );
  });
});
