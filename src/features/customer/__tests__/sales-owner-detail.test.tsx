import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage, renderScreen } from "@/test/api-screen";
import { mockSalesOwnerApi, workloadRow } from "@/test/sales-owner-screen";
import { pickOption } from "@/test/ui-actions";

import { CustomerDetail } from "../components/CustomerDetail";

import type { RouteTable } from "@/test/api-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => vi.restoreAllMocks());

const customer = {
  customerId: "c-1",
  fullName: "Công ty Bao Bì Xanh",
  email: "mua@xanh.example.com",
  status: "ACTIVE",
  version: 0,
  createdAt: "2026-10-14T02:00:00Z",
};
const owner = (extra: Record<string, unknown> = {}) => ({
  customerId: "c-1",
  salesOwnerId: "s-a",
  salesOwnerName: "Sale An",
  active: true,
  state: "ASSIGNED",
  since: "2026-11-01T02:00:00Z",
  version: 3,
  ...extra,
});
const WORKLOAD = [
  workloadRow("s-a", "Sale An"),
  workloadRow("s-b", "Sale Bình", { paused: true }),
  workloadRow("s-c", "Sale Chi", { onLeave: true, coverName: "Sale Bình" }),
];

function get(extra: RouteTable = {}, ownerDto: unknown = owner()): RouteTable {
  return {
    "/customers/c-1": () => customer,
    "/customers/c-1/status-history": () => [],
    "/customers/c-1/sales-owner": () => ownerDto,
    "/customers/c-1/sales-owner-history": () => bePage([]),
    "/sales/workload": () => WORKLOAD,
    ...extra,
  };
}

const card = () => screen.findByRole("region", { name: "Sale phụ trách" });

describe("Trang khách — thẻ Sale phụ trách (sales-owner, hợp đồng 'FE screens')", () => {
  it("SALES_STAFF (READ): tên, từ ngày, người đang lo thay; KHÔNG có nút đổi (BR-S01)", async () => {
    mockSalesOwnerApi("SALES_STAFF", {
      get: get({}, owner({ cover: { userId: "s-b", name: "Sale Bình", until: "2026-12-05" } })),
    });
    renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF");
    const region = await card();
    expect(await within(region).findByText("Sale An")).toBeInTheDocument();
    expect(within(region).getByText("01/11/2026")).toBeInTheDocument();
    expect(
      within(region).getByText(/Đang có Sale Bình lo thay tới 05\/12\/2026/),
    ).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: /người phụ trách/ })).toBeNull();
  });

  it("NEEDS_ASSIGNMENT: nhãn 'Cần giao người phụ trách' + người cũ (BR-S08); UNASSIGNED: 'Chưa có người phụ trách'", async () => {
    mockSalesOwnerApi("SALES_STAFF", {
      get: get({}, owner({ state: "NEEDS_ASSIGNMENT", active: false })),
    });
    const view = renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF");
    const region = await card();
    expect(await within(region).findByText("Cần giao người phụ trách")).toBeInTheDocument();
    expect(within(region).getByText("Người cũ")).toBeInTheDocument();
    view.unmount();
    vi.restoreAllMocks();
    mockSalesOwnerApi("SALES_STAFF", {
      get: get(
        {},
        owner({ state: "UNASSIGNED", salesOwnerId: undefined, salesOwnerName: undefined }),
      ),
    });
    renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF");
    expect(await within(await card()).findByText("Chưa có người phụ trách")).toBeInTheDocument();
  });

  it("không có customer-sales-owners:READ → không thẻ, không tab, không gọi API mới", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", { get: get() }, []);
    renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF");
    await screen.findByRole("heading", { name: "Công ty Bao Bì Xanh" });
    expect(screen.queryByRole("region", { name: "Sale phụ trách" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Lịch sử phụ trách" })).toBeNull();
    expect(api.get.mock.calls.some((c) => c[0] === "/customers/c-1/sales-owner")).toBe(false);
  });

  it("BE chưa có endpoint (404) → ẩn thẻ và tab, trang vẫn hiện", async () => {
    mockSalesOwnerApi("SALES_MANAGER", {
      get: get({
        "/customers/c-1/sales-owner": () => {
          throw apiError(404, "NOT_FOUND");
        },
      }),
    });
    renderScreen(<CustomerDetail id="c-1" />, "SALES_MANAGER");
    await screen.findByRole("heading", { name: "Công ty Bao Bì Xanh" });
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Sale phụ trách" })).toBeNull(),
    );
    expect(screen.queryByRole("tab", { name: "Lịch sử phụ trách" })).toBeNull();
  });

  it("tab 'Lịch sử phụ trách': bảng từ → sang, lý do, người đổi; phân trang server", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", {
      get: get({
        "/customers/c-1/sales-owner-history": () =>
          bePage([
            {
              id: "h-1",
              fromName: "Sale Cũ",
              toName: "Sale An",
              reason: "STAFF_LEFT",
              note: "Bàn giao",
              changedByName: "Quản lý Hà",
              changedAt: "2026-11-01T02:00:00Z",
            },
          ]),
      }),
    });
    renderScreen(<CustomerDetail id="c-1" />, "SALES_STAFF");
    await userEvent.click(await screen.findByRole("tab", { name: "Lịch sử phụ trách" }));
    expect(await screen.findByText("Sale nghỉ việc")).toBeInTheDocument();
    expect(screen.getByText("Quản lý Hà")).toBeInTheDocument();
    const call = api.get.mock.calls.find((c) => c[0] === "/customers/c-1/sales-owner-history");
    expect((call?.[1] as { params: Record<string, number> }).params).toEqual({ page: 0, size: 10 });
  });
});

describe("Hộp 'Đổi người phụ trách' (BR-S01, BR-S03, BR-S04, D3, ca #15)", () => {
  async function openDialog(put: RouteTable = {}) {
    const api = mockSalesOwnerApi("SALES_MANAGER", { get: get(), put });
    renderScreen(<CustomerDetail id="c-1" />, "SALES_MANAGER");
    const region = await card();
    await userEvent.click(
      await within(region).findByRole("button", { name: /Đổi người phụ trách/ }),
    );
    const dialog = await screen.findByRole("dialog");
    return { api, dialog };
  }

  it("danh sách Sale hiện tạm dừng / đang nghỉ (ai lo thay)", async () => {
    const { dialog } = await openDialog();
    await userEvent.click(within(dialog).getByRole("combobox", { name: /Sale phụ trách mới/ }));
    expect(
      await screen.findByRole("option", { name: "Sale Bình · tạm dừng nhận khách" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Sale Chi · đang nghỉ (Sale Bình lo thay)" }),
    ).toBeInTheDocument();
  });

  it("BR-S03: bắt buộc chọn Sale và lý do; 'Khác' phải ghi chú; chọn lại chính người đang phụ trách bị chặn", async () => {
    const { api, dialog } = await openDialog();
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText("Chọn Sale phụ trách mới")).toBeInTheDocument();
    expect(within(dialog).getByText("Chọn lý do")).toBeInTheDocument();
    await pickOption(user, /Sale phụ trách mới/, "Sale An");
    await pickOption(user, /Lý do/, "Khác");
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText("Ghi rõ lý do khi chọn “Khác”")).toBeInTheDocument();
    expect(within(dialog).getByText("Khách đang do Sale này phụ trách.")).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it("gửi {salesOwnerId, reason, note, notifyCustomer, version}; bỏ chọn báo khách → false", async () => {
    const { api, dialog } = await openDialog({ "/customers/c-1/sales-owner": () => owner() });
    const user = userEvent.setup();
    await pickOption(user, /Sale phụ trách mới/, /^Sale Bình/);
    await pickOption(user, /Lý do/, "Chia lại tải");
    await user.type(within(dialog).getByLabelText("Ghi chú"), "Cân tải tháng 12");
    await user.click(within(dialog).getByRole("checkbox", { name: /Báo cho khách/ }));
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/customers/c-1/sales-owner", {
        salesOwnerId: "s-b",
        reason: "WORKLOAD",
        note: "Cân tải tháng 12",
        notifyCustomer: false,
        version: 3,
      }),
    );
  });

  it("ca #15: SALES_OWNER_VERSION_CONFLICT → câu tiếng Việt trong hộp, tải lại người phụ trách", async () => {
    const { api, dialog } = await openDialog({
      "/customers/c-1/sales-owner": () => {
        throw apiError(409, "SALES_OWNER_VERSION_CONFLICT");
      },
    });
    const user = userEvent.setup();
    const reads = () =>
      api.get.mock.calls.filter((c) => c[0] === "/customers/c-1/sales-owner").length;
    await pickOption(user, /Sale phụ trách mới/, /^Sale Bình/);
    await pickOption(user, /Lý do/, "Chia lại tải");
    const before = reads();
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(
      await within(dialog).findByText(/Người khác vừa đổi người phụ trách/),
    ).toBeInTheDocument();
    await waitFor(() => expect(reads()).toBeGreaterThan(before));
  });

  it("SALES_OWNER_NOT_ASSIGNABLE (BR-S04) → câu tiếng Việt", async () => {
    const { dialog } = await openDialog({
      "/customers/c-1/sales-owner": () => {
        throw apiError(422, "SALES_OWNER_NOT_ASSIGNABLE");
      },
    });
    const user = userEvent.setup();
    await pickOption(user, /Sale phụ trách mới/, /^Sale Bình/);
    await pickOption(user, /Lý do/, "Đổi khu vực");
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText(/không phải Sale đang làm/)).toBeInTheDocument();
  });
});
