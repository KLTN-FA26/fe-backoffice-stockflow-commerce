import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage, renderScreen } from "@/test/api-screen";
import { mockSalesOwnerApi, salesAgent } from "@/test/sales-owner-screen";

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

  it("D42: lọc theo Sale dùng danh sách Sale giao được (GET /customers/sales-agents)", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", {
      get: {
        ...routes.get,
        "/customers/sales-agents": () => [salesAgent("s-c", "Sale Chi")],
      },
    });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Lọc sale phụ trách/ }));
    await user.click(await screen.findByRole("option", { name: /Sale Chi/ }));
    await waitFor(() => expect(lastParams(api).get("salesOwnerId")).toBe("s-c"));
    expect(screen.queryByRole("option", { name: /Sale Bình/ })).toBeNull();
    expect(api.get.mock.calls.some((c) => c[0] === "/chat/agents")).toBe(false);
  });

  it("D42 dự phòng: sales-agents 404 → người trả lời chat, bỏ người điều phối (theo /chat/staff)", async () => {
    mockSalesOwnerApi("SALES_STAFF", {
      get: {
        ...routes.get,
        "/customers/sales-agents": () => {
          throw apiError(404, "NOT_FOUND");
        },
        "/chat/agents": () => [
          { userId: "s-a", name: "Sale An", online: true },
          { userId: "m-1", name: "Quản lý Minh", online: true },
        ],
        "/chat/staff": () => [
          { id: "s-a", name: "Sale An", roles: [{ code: "SALES_STAFF", name: "Sale" }] },
          { id: "m-1", name: "Quản lý Minh", roles: [{ code: "SALES_MANAGER", name: "QL" }] },
        ],
      },
    });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Lọc sale phụ trách/ }));
    expect(await screen.findByRole("option", { name: /Sale An/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Quản lý Minh/ })).toBeNull();
  });

  it("lọc cột theo một Sale → salesOwnerId (sales-agents 404: danh sách Sale từ người trả lời chat khi không có bảng tải)", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", {
      get: {
        ...routes.get,
        "/customers/sales-agents": () => {
          throw apiError(404, "NOT_FOUND");
        },
      },
    });
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

describe("Danh sách khách — 'Thiếu MST' (D41)", () => {
  const flagged = [
    row("c-1", "Công ty An", { taxCode: "0312345678", taxCodeMissing: false }),
    row("c-2", "Hộ kinh doanh Bình", { taxCodeMissing: true }),
  ];

  it("D41: dòng thiếu MST có nhãn 'Thiếu MST'; công tắc 'Thiếu MST' → taxCodeMissing=true", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", {
      get: { ...routes.get, "/customers": () => bePage(flagged) },
    });
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    const [, first, second] = screen.getAllByRole("row");
    expect(within(first as HTMLElement).queryByText("Thiếu MST")).toBeNull();
    expect(within(second as HTMLElement).getByText("Thiếu MST")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "Thiếu MST" }));
    await waitFor(() => expect(lastParams(api).get("taxCodeMissing")).toBe("true"));
  });

  it("D41: BE cũ không gửi taxCodeMissing → không nhãn, không công tắc, không tham số", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", routes);
    renderScreen(<CustomerList />, "SALES_STAFF");
    await screen.findByText("Công ty An");
    expect(screen.queryByText("Thiếu MST")).toBeNull();
    expect(screen.queryByRole("switch", { name: "Thiếu MST" })).toBeNull();
    expect(lastParams(api).get("taxCodeMissing")).toBeNull();
  });
});
