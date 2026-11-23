import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";
import { apiError, bePage } from "@/test/api-screen";

import { ReceivablesList } from "..";
import {
  ACCOUNTANT_GRANTS,
  PAGE_ONLY_GRANTS,
  mockPaymentApi,
  renderPaymentScreen,
} from "../__fixtures__/screen";

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

  it("đợt thu khi ký quá hạn (signingOverdue) có cột riêng và tự nó cũng đánh dấu dòng", async () => {
    // Không còn gì "quá hạn" theo nghĩa phải thu, chỉ còn đợt ký trễ: BE vẫn xếp khách này lên đầu.
    const binhMinh = {
      customerId: "cust-7",
      customerName: "Công ty Bình Minh",
      customerCode: "KH-007",
      receivable: 0,
      overdue: 0,
      signingOverdue: 12_000_000,
      openItems: 0,
    };
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: { "/reports/receivables": () => report([binhMinh, anPhat]) },
    });
    renderPaymentScreen(<ReceivablesList />);
    expect(await screen.findByRole("columnheader", { name: /Quá hạn đợt ký/ })).toBeInTheDocument();
    const row = (await screen.findByRole("link", { name: /Công ty Bình Minh/ })).closest(
      "tr",
    ) as HTMLElement;
    expect(within(row).getByText(/12\.000\.000/)).toBeInTheDocument();
    expect(row).toHaveAttribute("data-flagged", "true");
    // Thiếu trường (BE cũ) → 0, không phải lỗi.
    const anPhatRow = screen.getByRole("link", { name: /An Phát/ }).closest("tr") as HTMLElement;
    expect(anPhatRow).toHaveAttribute("data-flagged", "true");
  });

  it("không quá hạn, không đợt ký quá hạn → dòng không bị đánh dấu", async () => {
    mockPaymentApi(ACCOUNTANT_GRANTS, {
      get: {
        "/reports/receivables": () =>
          report([{ ...anPhat, overdue: 0, overdue1To30: 0, signingOverdue: 0 }]),
      },
    });
    renderPaymentScreen(<ReceivablesList />);
    const row = (await screen.findByRole("link", { name: /An Phát/ })).closest("tr") as HTMLElement;
    expect(row).not.toHaveAttribute("data-flagged", "true");
  });

  it("quyền là reporting-receivables, không phải payment-installments", async () => {
    // Xem được đợt thanh toán nhưng không có quyền báo cáo công nợ → trang bị chặn, không gọi API.
    const api = mockPaymentApi(Object.values(PAYMENT_INSTALLMENT_PERMISSIONS), {
      get: { "/reports/receivables": () => report([anPhat]) },
    });
    renderPaymentScreen(<ReceivablesList />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /An Phát/ })).not.toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/reports/receivables")).toBe(false);
  });

  it("mở được trang (VIEW_PAGE) mà thiếu READ → báo thiếu quyền, không gọi /reports/receivables", async () => {
    const api = mockPaymentApi(PAGE_ONLY_GRANTS, {
      get: { "/reports/receivables": () => report([anPhat]) },
    });
    renderPaymentScreen(<ReceivablesList />);
    expect(await screen.findByText(/chưa có quyền xem công nợ/)).toBeInTheDocument();
    expect(api.get.mock.calls.some(([url]) => url === "/reports/receivables")).toBe(false);
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
