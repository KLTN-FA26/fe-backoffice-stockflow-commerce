import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage } from "@/test/api-screen";

import { ReceivablesList } from "..";
import { ACCOUNTANT_GRANTS, mockPaymentApi, renderPaymentScreen } from "../__fixtures__/screen";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => nav,
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  nav.push.mockReset();
  nav.replace.mockReset();
});

/** A row as `GET /reports/receivables` sends it (the code is the tax code; null fields left out). */
const anPhat = {
  customerId: "cust-9",
  customerName: "Công ty Bao Bì An Phát",
  customerCode: "0312345678",
  currency: "VND",
  receivable: 50_000_000,
  notYetDue: 0,
  overdue: 20_000_000,
  overdue1To30: 30_000_000,
  overdue31To60: 15_000_000,
  overdue61To90: 3_000_000,
  overdueOver90: 2_000_000,
  oldestDueDate: "2026-10-01",
  openItems: 3,
};
const report = (rows: unknown[]) => ({ asOf: "2026-11-23", rows: bePage(rows), totals: [] });

describe("Công nợ phải thu theo khách (BO-UX-37, R5-11)", () => {
  it("một dòng mỗi khách: còn nợ, quá hạn, hạn cũ nhất, tuổi nợ; bấm khách → các đợt còn nợ của khách", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, { get: { "/reports/receivables": () => report([anPhat]) } });
    renderPaymentScreen(<ReceivablesList />);
    const link = await screen.findByRole("link", { name: /Công ty Bao Bì An Phát/ });
    expect(link).toHaveAttribute(
      "href",
      "/admin/payment/installments?owing=true&customerId=cust-9",
    );
    const row = link.closest("tr") as HTMLElement;
    expect(within(row).getByText(/50\.000\.000/)).toBeInTheDocument();
    expect(within(row).getByText(/20\.000\.000/)).toBeInTheDocument();
    expect(within(row).getByText(/30\.000\.000/)).toBeInTheDocument();
    expect(within(row).getByText(/15\.000\.000/)).toBeInTheDocument();
    expect(within(row).getByText(/^5\.000\.000/)).toBeInTheDocument();
    expect(within(row).getByText(/1 thg 10, 2026/)).toBeInTheDocument();
    expect(within(row).getByText(/MST 0312345678/)).toBeInTheDocument();
    expect(row).toHaveAttribute("data-flagged", "true");
    await userEvent.click(within(row).getByText(/1 thg 10, 2026/));
    expect(nav.push).toHaveBeenCalledWith(
      "/admin/payment/installments?owing=true&customerId=cust-9",
    );
  });

  it("ô tìm gửi search= tới /reports/receivables", async () => {
    const api = mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: { "/reports/receivables": () => report([anPhat]) },
    });
    renderPaymentScreen(<ReceivablesList />);
    await userEvent.type(await screen.findByRole("textbox", { name: /Tìm khách/ }), "an phat");
    await waitFor(() => {
      const calls = api.get.mock.calls.filter(([url]) => url === "/reports/receivables");
      expect((calls.at(-1)?.[1] as { params: URLSearchParams }).params.get("search")).toBe(
        "an phat",
      );
    });
  });

  it("máy chủ cũ không có /reports/receivables (404) → chuyển sang danh sách đợt 'Công nợ phải thu' (owing=true)", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/reports/receivables": () => {
          throw apiError(404, "NOT_FOUND");
        },
      },
    });
    renderPaymentScreen(<ReceivablesList />);
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/admin/payment/installments?owing=true"),
    );
  });
});
