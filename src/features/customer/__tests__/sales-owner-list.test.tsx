import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { bePage, renderScreen } from "@/test/api-screen";
import { mockSalesOwnerApi } from "@/test/sales-owner-screen";

import { CustomerList } from "../components/CustomerList";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const row = (id: string, fullName: string, owner: Record<string, unknown>) => ({
  customerId: id,
  fullName,
  email: `${id}@khach.example`,
  status: "ACTIVE",
  version: 0,
  createdAt: "2026-11-20T02:00:00Z",
  ...owner,
});
const ROWS = [
  row("c-1", "Công ty An", {
    salesOwnerId: "s-a",
    salesOwnerName: "Sale An",
    salesOwnerActive: true,
    salesOwnerState: "ASSIGNED",
  }),
  row("c-2", "Công ty Bình", {
    salesOwnerId: "s-old",
    salesOwnerName: "Sale Cũ",
    salesOwnerActive: false,
    salesOwnerState: "NEEDS_ASSIGNMENT",
  }),
  row("c-3", "Công ty Chi", { salesOwnerState: "UNASSIGNED" }),
];
const routes = {
  get: {
    "/customers": () => bePage(ROWS),
    "/orders/sales-contacts": () => [],
    "/orders/credit-positions": () => [],
    "/chat/agents": () => [
      { userId: "s-a", name: "Sale An", online: true },
      { userId: "s-b", name: "Sale Bình", online: false },
    ],
  },
};
const lastParams = (api: ReturnType<typeof mockSalesOwnerApi>) =>
  (
    api.get.mock.calls.filter((c) => c[0] === "/customers").at(-1)?.[1] as {
      params: URLSearchParams;
    }
  ).params;

describe("Danh sách khách — cột và lọc 'Sale phụ trách' (BR-S11)", () => {
  it("cột Sale phụ trách: tên, nhãn 'Cần giao' / 'Chưa có'; cột 'Sale liên hệ gần nhất' vẫn riêng", async () => {
    mockSalesOwnerApi("SALES_STAFF", routes);
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    expect(screen.getByRole("columnheader", { name: /^Sale phụ trách/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Sale liên hệ gần nhất/ })).toBeInTheDocument();
    const [, first, second, third] = screen.getAllByRole("row");
    expect(within(first as HTMLElement).getByText("Sale An")).toBeInTheDocument();
    expect(within(second as HTMLElement).getByText("Cần giao người phụ trách")).toBeInTheDocument();
    expect(within(third as HTMLElement).getByText("Chưa có người phụ trách")).toBeInTheDocument();
  });

  it("'Khách của tôi' → mine=true; 'Cần giao người phụ trách' → salesOwnerState, loại trừ nhau", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", routes);
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    const user = userEvent.setup();
    await user.click(screen.getByRole("switch", { name: "Khách của tôi" }));
    await waitFor(() => expect(lastParams(api).get("mine")).toBe("true"));
    await user.click(screen.getByRole("switch", { name: "Cần giao người phụ trách" }));
    await waitFor(() => expect(lastParams(api).get("salesOwnerState")).toBe("NEEDS_ASSIGNMENT"));
    expect(lastParams(api).get("mine")).toBeNull();
    expect(screen.getByRole("switch", { name: "Khách của tôi" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("lọc cột theo một Sale → salesOwnerId (danh sách Sale từ người trả lời chat khi không có bảng tải)", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", routes);
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Lọc sale phụ trách/ }));
    await user.click(await screen.findByRole("option", { name: /Sale Bình/ }));
    await waitFor(() => expect(lastParams(api).get("salesOwnerId")).toBe("s-b"));
    expect(api.get.mock.calls.some((c) => c[0] === "/sales/workload")).toBe(false);
  });

  it("URL ?owner=needs-assignment (link từ thông báo) → lọc ngay từ lần tải đầu", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: { ...routes.get, "/sales/workload": () => [] },
    });
    renderScreen(<CustomerList />, "SALES_MANAGER", "?owner=needs-assignment");
    await screen.findByText("Công ty An");
    expect(lastParams(api).get("salesOwnerState")).toBe("NEEDS_ASSIGNMENT");
  });

  it("không có customer-sales-owners:READ → không cột, không công tắc, không tham số mới", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", routes, []);
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    expect(screen.queryByRole("columnheader", { name: /^Sale phụ trách/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Khách của tôi" })).toBeNull();
    expect(lastParams(api).get("mine")).toBeNull();
    expect(api.get.mock.calls.some((c) => c[0] === "/chat/agents")).toBe(false);
  });
});
