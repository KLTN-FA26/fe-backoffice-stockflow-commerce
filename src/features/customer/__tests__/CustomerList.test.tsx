import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, mockApi, renderScreen } from "@/test/api-screen";
import { openRowMenu } from "@/test/ui-actions";

import { CustomerList } from "../components/CustomerList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const row = (id: string, fullName: string, status: string, createdAt: string) => ({
  customerId: id,
  userId: `u-${id}`,
  fullName,
  email: `${id}@khach.example`,
  phone: "0912000000",
  status,
  version: 0,
  createdAt,
});
const ROWS = [
  row("c-1", "Công ty Trà Sữa An", "ACTIVE", "2026-11-20T02:00:00Z"),
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

  it("lọc cột Khách hàng: BE thu hẹp bằng q, FE giữ đúng dòng khớp tên, có chip 'Search trong cột'", async () => {
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
