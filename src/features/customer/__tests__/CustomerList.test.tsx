import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage, mockApi, renderScreen } from "@/test/api-screen";
import { openRowMenu } from "@/test/ui-actions";

import { CustomerList } from "../components/CustomerList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const row = (
  id: string,
  fullName: string,
  status: string,
  createdAt: string,
  taxCode?: string,
) => ({
  customerId: id,
  userId: `u-${id}`,
  fullName,
  email: `${id}@khach.example`,
  phone: "0912000000",
  ...(taxCode ? { taxCode } : {}),
  status,
  version: 0,
  createdAt,
});
const ROWS = [
  row("c-1", "Công ty Trà Sữa An", "ACTIVE", "2026-11-20T02:00:00Z", "0312345678"),
  row("c-2", "Công ty Trà Chanh Bình", "PENDING_ACTIVATION", "2026-10-01T02:00:00Z"),
];

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const customerCalls = (api: ReturnType<typeof mockApi>) =>
  api.get.mock.calls
    .filter((c) => c[0] === "/customers")
    .map((c) => (c[1] as { params: URLSearchParams }).params);

describe("Danh sách khách hàng — trang danh sách ERP (backoffice-erp-ui A)", () => {
  it("SALES_STAFF: nút 'Tạo mới' trên thanh breadcrumb, menu ⋯ có tạo báo giá cho khách đang hoạt động", async () => {
    mockApi("SALES_STAFF", { get: { "/customers": () => bePage(ROWS) } });
    renderScreen(<CustomerList />, "SALES_STAFF");
    expect(await screen.findByText("Công ty Trà Sữa An")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo mới khách hàng" })).toBeEnabled();
    const menu = await openRowMenu(userEvent.setup(), screen.getAllByRole("row")[1]);
    expect(within(menu).getByRole("link", { name: /Tạo báo giá/ })).toHaveAttribute(
      "href",
      "/admin/quotes/create?customerId=c-1",
    );
  });

  it("SALES_STAFF: khách chưa kích hoạt — 'Tạo báo giá' bị khoá kèm lý do", async () => {
    mockApi("SALES_STAFF", { get: { "/customers": () => bePage(ROWS) } });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty Trà Chanh Bình");
    const menu = await openRowMenu(userEvent.setup(), screen.getAllByRole("row")[2]);
    expect(within(menu).getByRole("button", { name: /Tạo báo giá/ })).toBeDisabled();
    expect(within(menu).getByText(/Chỉ khách đang hoạt động/)).toBeInTheDocument();
  });

  it("SALES_MANAGER (chỉ đọc): 'Tạo mới' bị khoá, menu không mở được tạo báo giá", async () => {
    mockApi("SALES_MANAGER", { get: { "/customers": () => bePage(ROWS) } });
    renderScreen(<CustomerList />, "SALES_MANAGER");
    await screen.findByText("Công ty Trà Sữa An");
    expect(screen.getByRole("button", { name: "Tạo mới khách hàng" })).toBeDisabled();
    const menu = await openRowMenu(userEvent.setup(), screen.getAllByRole("row")[1]);
    expect(within(menu).getByRole("button", { name: /Tạo báo giá/ })).toBeDisabled();
  });

  it("ECOMMERCE_ADMIN (không đọc báo giá): menu không có 'Báo giá của khách'", async () => {
    mockApi("ECOMMERCE_ADMIN", { get: { "/customers": () => bePage(ROWS) } });
    renderScreen(<CustomerList />, "ECOMMERCE_ADMIN");
    await screen.findByText("Công ty Trà Sữa An");
    expect(screen.getByRole("button", { name: "Tạo mới khách hàng" })).toBeEnabled();
    const menu = await openRowMenu(userEvent.setup(), screen.getAllByRole("row")[1]);
    expect(within(menu).queryByRole("link", { name: /Báo giá của khách/ })).toBeNull();
  });

  it("lọc cột Khách hàng: BE thu hẹp bằng q, FE giữ đúng dòng khớp tên, có chip 'Tìm trong cột'", async () => {
    const api = mockApi("SALES_STAFF", { get: { "/customers": () => bePage(ROWS) } });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty Trà Sữa An");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Lọc khách hàng/ }));
    await user.type(screen.getByPlaceholderText("Tìm theo tên khách hàng…"), "sua");
    await waitFor(() => expect(customerCalls(api).at(-1)?.get("q")).toBe("sua"));
    await waitFor(() => expect(screen.queryByText("Công ty Trà Chanh Bình")).toBeNull());
    expect(screen.getByText("Công ty Trà Sữa An")).toBeInTheDocument();
    expect(screen.getByText(/Khách hàng “sua”/)).toBeInTheDocument();
    expect(screen.getByText("Tìm trong cột")).toBeInTheDocument();
    expect(screen.queryByText("Search trong cột")).toBeNull();
  });

  it("bo-29: cột Mã số thuế (khách chưa có MST → —); lọc cột MST thu hẹp bằng q", async () => {
    const api = mockApi("SALES_STAFF", { get: { "/customers": () => bePage(ROWS) } });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty Trà Sữa An");
    expect(screen.getByRole("columnheader", { name: /Mã số thuế/ })).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1] as HTMLElement).getByText("0312345678")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Lọc mã số thuế/ }));
    await user.type(screen.getByPlaceholderText("Tìm theo mã số thuế…"), "0312");
    await waitFor(() => expect(customerCalls(api).at(-1)?.get("q")).toBe("0312"));
    await waitFor(() => expect(screen.queryByText("Công ty Trà Chanh Bình")).toBeNull());
  });

  it("lọc ngày tạo từ link không khớp: header vẫn hiện, 'Bỏ bộ lọc' trả lại dòng", async () => {
    mockApi("SALES_STAFF", { get: { "/customers": () => bePage(ROWS) } });
    renderScreen(<CustomerList />, "SALES_STAFF", "?custCreatedFrom=2027-01-01");
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Ngày tạo/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Bỏ bộ lọc" }));
    expect(await screen.findByText("Công ty Trà Sữa An")).toBeInTheDocument();
  });
});

describe("Danh sách khách hàng — hạn mức / dư nợ và sale liên hệ gần nhất (audit bo-29, BE PR #497)", () => {
  const position = (customerId: string, extra: Record<string, unknown> = {}) => ({
    customerId,
    creditLimit: 500000000,
    creditTermDays: 30,
    exposure: 120000000,
    availableCredit: 380000000,
    currency: "VND",
    hasOverdue: false,
    overdueAmount: 0,
    ...extra,
  });
  const contact = (customerId: string, extra: Record<string, unknown> = {}) => ({
    customerId,
    salesUserId: "u-sale",
    salesName: "Nguyễn Văn Sale",
    salesActive: true,
    source: "QUOTE",
    documentNumber: "QT-2026-0007",
    at: "2026-11-20T02:00:00Z",
    ...extra,
  });
  const text = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ");

  it("một lần gọi mỗi endpoint với id của trang; hạn mức + dư nợ, quá hạn đỏ; tên sale kèm (đã nghỉ)", async () => {
    const api = mockApi("SALES_STAFF", {
      get: {
        "/customers": () => bePage(ROWS),
        "/orders/credit-positions": () => [
          position("c-1", { hasOverdue: true, overdueAmount: 15000000 }),
          position("c-2", { creditLimit: null, availableCredit: null, exposure: 0 }),
        ],
        "/orders/sales-contacts": () => [contact("c-1", { salesActive: false })],
      },
    });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Nguyễn Văn Sale");

    expect(screen.getByRole("columnheader", { name: /Hạn mức \/ dư nợ/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Sale liên hệ gần nhất/ })).toBeInTheDocument();
    expect(screen.queryByText(/Sale phụ trách/)).toBeNull();
    const [, first, second] = screen.getAllByRole("row");
    expect(text(first)).toMatch(/Dư nợ 120\.000\.000/);
    expect(within(first as HTMLElement).getByText(/Quá hạn/)).toHaveClass("text-danger");
    expect(within(second as HTMLElement).getByText("Không bán trả sau")).toBeInTheDocument();
    // Sale đã nghỉ; rê chuột xem chứng từ + ngày
    const sale = within(first as HTMLElement).getByText("Nguyễn Văn Sale");
    expect(text(sale)).toContain("(đã nghỉ)");
    expect(sale).toHaveAttribute("title", expect.stringContaining("Báo giá QT-2026-0007"));
    expect(within(second as HTMLElement).getByText("Chưa gửi chứng từ")).toBeInTheDocument();

    for (const path of ["/orders/credit-positions", "/orders/sales-contacts"]) {
      const calls = api.get.mock.calls.filter((c) => c[0] === path);
      expect(calls).toHaveLength(1);
      const params = (calls[0]?.[1] as { params: URLSearchParams }).params;
      expect(params.get("customerIds")).toBe("c-1,c-2");
    }
  });

  it("không có quyền đọc hạn mức → không gọi, không có cột; vẫn có cột sale", async () => {
    const api = mockApi("SALES_MANAGER", {
      get: {
        "/customers": () => bePage(ROWS),
        "/orders/sales-contacts": () => [contact("c-1")],
      },
    });
    renderScreen(<CustomerList />, "SALES_MANAGER");
    await screen.findByText("Nguyễn Văn Sale");
    expect(screen.queryByRole("columnheader", { name: /Hạn mức/ })).toBeNull();
    expect(api.get.mock.calls.some((c) => c[0] === "/orders/credit-positions")).toBe(false);
  });

  it("403 / 404 (BE chưa có endpoint) → ẩn cột, trang vẫn chạy", async () => {
    mockApi("SALES_STAFF", {
      get: {
        "/customers": () => bePage(ROWS),
        "/orders/credit-positions": () => {
          throw apiError(403, "ACCESS_DENIED");
        },
        "/orders/sales-contacts": () => {
          throw apiError(404, "NOT_FOUND");
        },
      },
    });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty Trà Sữa An");
    await waitFor(() => expect(screen.queryByRole("columnheader", { name: /Hạn mức/ })).toBeNull());
    await waitFor(() =>
      expect(screen.queryByRole("columnheader", { name: /Sale liên hệ gần nhất/ })).toBeNull(),
    );
  });
});
