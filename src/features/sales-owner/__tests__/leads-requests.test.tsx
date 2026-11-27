import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, bePage, renderScreen } from "@/test/api-screen";
import { agentsOf, mockSalesOwnerApi, workloadRow } from "@/test/sales-owner-screen";
import { clickRowAction, openRowMenu } from "@/test/ui-actions";

import { LeadsPage } from "../components/LeadsPage";
import { RequestsPage } from "../components/RequestsPage";

import type { RouteTable } from "@/test/api-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => vi.restoreAllMocks());

const WORKLOAD = [
  workloadRow("s-a", "Sale An", { customers: 2, paused: true }),
  workloadRow("s-b", "Sale Bình", { customers: 4 }),
  workloadRow("s-c", "Sale Chi", { customers: 9 }),
];
const lead = (
  id: string,
  status: string,
  assignedTo?: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  companyName: `Công ty ${id}`,
  taxCode: "0312345678",
  contactName: "Chị Lan",
  phone: "0909000111",
  email: "lan@x.vn",
  interests: ["CUP"],
  status,
  ...(assignedTo ? { assignedTo, assignedToName: assignedTo } : {}),
  ...extra,
});
const rowOf = (text: string) => screen.getByText(text).closest("tr") as HTMLElement;

describe("Khách tiềm năng (§10.3, §10.4, §10.7)", () => {
  const leads = (rows: unknown[], extra: RouteTable = {}): RouteTable => ({
    "/leads": () => bePage(rows),
    "/sales/workload": () => WORKLOAD,
    "/customers/sales-agents": () => agentsOf(WORKLOAD),
    ...extra,
  });

  it("quản lý giao: điền sẵn Sale còn trống nhất (bỏ người tạm dừng); gửi {salesUserId}", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: leads([lead("L1", "NEW")]),
      put: { "/leads/L1/assignment": () => lead("L1", "ASSIGNED", "s-b") },
    });
    renderScreen(<LeadsPage />, "SALES_MANAGER");
    const user = userEvent.setup();
    await screen.findByText("Công ty L1");
    await clickRowAction(user, "Giao cho Sale…", rowOf("Công ty L1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Gợi ý: Sale Bình/)).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: /Sale nhận/ })).toHaveTextContent(
      "Sale Bình",
    );
    await user.click(within(dialog).getByRole("button", { name: "Giao" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/leads/L1/assignment", { salesUserId: "s-b" }),
    );
  });

  it("loại: lý do bắt buộc; LEAD_ALREADY_HANDLED → câu tiếng Việt", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: leads([lead("L1", "NEW")]),
      post: {
        "/leads/L1/disqualification": () => {
          throw apiError(409, "LEAD_ALREADY_HANDLED");
        },
      },
    });
    renderScreen(<LeadsPage />, "SALES_MANAGER");
    const user = userEvent.setup();
    await screen.findByText("Công ty L1");
    await clickRowAction(user, "Loại…", rowOf("Công ty L1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Loại" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Lý do loại/), "Không phải doanh nghiệp");
    await user.click(within(dialog).getByRole("button", { name: "Loại" }));
    expect(await within(dialog).findByText(/vừa được người khác xử lý/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/leads/L1/disqualification", {
      reason: "Không phải doanh nghiệp",
    });
  });

  it("Sale được giao: đã liên hệ (ghi chú) và 'Chuyển thành khách' mở form tạo khách điền sẵn + leadId", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", {
      get: leads([lead("L1", "ASSIGNED", "u-test"), lead("L2", "CONTACTED", "u-test")]),
      post: { "/leads/L1/contact": () => lead("L1", "CONTACTED", "u-test") },
    });
    renderScreen(<LeadsPage />, "SALES_STAFF");
    const user = userEvent.setup();
    await screen.findByText("Công ty L1");
    expect(api.get.mock.calls.some((c) => c[0] === "/sales/workload")).toBe(false);
    const menu = await openRowMenu(user, rowOf("Công ty L2"));
    const link = within(menu).getByRole("link", { name: /Chuyển thành khách/ });
    const query = new URL(link.getAttribute("href") ?? "", "http://x").searchParams;
    expect(Object.fromEntries(query)).toEqual({
      leadId: "L2",
      companyName: "Công ty L2",
      taxCode: "0312345678",
      contactName: "Chị Lan",
      email: "lan@x.vn",
      phone: "0909000111",
    });
    expect(within(menu).queryByRole("button", { name: /Giao cho Sale/ })).toBeNull();
    await user.keyboard("{Escape}");
    await clickRowAction(user, "Đã liên hệ…", rowOf("Công ty L1"));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Ghi chú"), "Đã gọi, hẹn gửi mẫu");
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/leads/L1/contact", { note: "Đã gọi, hẹn gửi mẫu" }),
    );
  });

  it("lead của Sale khác / đã xong → không có thao tác", async () => {
    mockSalesOwnerApi("SALES_STAFF", {
      get: leads([lead("L3", "ASSIGNED", "s-other"), lead("L4", "CONVERTED", "u-test")]),
    });
    renderScreen(<LeadsPage />, "SALES_STAFF");
    const user = userEvent.setup();
    await screen.findByText("Công ty L3");
    for (const name of ["Công ty L3", "Công ty L4"]) {
      const menu = await openRowMenu(user, rowOf(name));
      expect(within(menu).getByRole("button", { name: /Không có thao tác/ })).toBeDisabled();
      await user.keyboard("{Escape}");
    }
  });

  it("§10.7: bấm dòng mở chi tiết + lịch sử; RESUBMITTED hiện 'Khách gửi lại form' kèm liên hệ lần đó", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: leads([lead("L1", "ASSIGNED", "s-b")], {
        "/leads/L1/history": () => [
          { toStatus: "NEW", changedAt: "2026-11-27T01:00:00Z", kind: "CHANGE" },
          {
            fromStatus: "NEW",
            toStatus: "ASSIGNED",
            toUserId: "s-b",
            toName: "Sale Bình",
            changedById: "m-1",
            changedByName: "Quản Lý",
            changedAt: "2026-11-27T02:00:00Z",
            kind: "CHANGE",
          },
          {
            fromStatus: "ASSIGNED",
            toStatus: "ASSIGNED",
            fromUserId: "s-b",
            toUserId: "s-b",
            note: "The form was sent again: company Công ty L1; tax code 0312345678; contact Anh Minh (Giám đốc); e-mail minh@x.vn; province Hà Nội; interests CUP",
            changedAt: "2026-11-27T03:00:00Z",
            kind: "RESUBMITTED",
          },
          {
            fromStatus: "ASSIGNED",
            toStatus: "NEW",
            fromUserId: "s-b",
            note: "The salesperson's account was locked or disabled: back to the managers' queue",
            changedAt: "2026-11-27T04:00:00Z",
            kind: "CHANGE",
          },
          {
            fromStatus: "NEW",
            toStatus: "ASSIGNED",
            toUserId: "s-c",
            toName: "Sale Chi",
            note: "Some future English system note",
            changedAt: "2026-11-27T05:00:00Z",
            kind: "CHANGE",
          },
          {
            fromStatus: "ASSIGNED",
            toStatus: "SNOOZED",
            changedAt: "2026-11-27T06:00:00Z",
            kind: "CHANGE",
          },
        ],
      }),
    });
    renderScreen(<LeadsPage />, "SALES_MANAGER");
    const user = userEvent.setup();
    await user.click(await screen.findByText("Công ty L1"));
    const history = await screen.findByRole("list", { name: "Lịch sử khách tiềm năng" });
    const items = within(history).getAllByRole("listitem");
    expect(items.map((li) => within(li).getAllByText(/./)[0]?.textContent)).toEqual([
      "Khách gửi form",
      "Giao cho Sale Bình",
      "Khách gửi lại form",
      "Trả về hàng chờ",
      "Giao cho Sale Chi",
      "Đã giao → Trạng thái khác",
    ]);
    expect(within(items[1] as HTMLElement).getByText("Quản Lý")).toBeInTheDocument();
    const resubmitted = within(items[2] as HTMLElement);
    expect(resubmitted.getByText("Hệ thống")).toBeInTheDocument();
    // Ghi chú tiếng Anh của BE đọc thành các ô tiếng Việt; ô trống (SĐT) bỏ qua
    const facts = resubmitted
      .getAllByRole("term")
      .map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(facts).toEqual([
      ["Công ty", "Công ty L1"],
      ["Người liên hệ", "Anh Minh (Giám đốc)"],
      ["Email", "minh@x.vn"],
    ]);
    expect(
      within(items[3] as HTMLElement).getByText(
        "Tài khoản của Sale được giao đã bị khoá hoặc vô hiệu hoá — khách tiềm năng về lại hàng chờ của quản lý.",
      ),
    ).toBeInTheDocument();
    // Không câu tiếng Anh nào của BE lọt ra màn hình
    expect(history).not.toHaveTextContent(
      /sent again|tax code|locked or disabled|future English|SNOOZED/,
    );
    expect(api.get).toHaveBeenCalledWith("/leads/L1/history", expect.anything());
  });

  it("menu luôn có 'Xem chi tiết và lịch sử'; lịch sử chưa xem được (404) → báo, không vỡ", async () => {
    mockSalesOwnerApi("SALES_STAFF", {
      get: leads([lead("L4", "CONVERTED", "u-test")], {
        "/leads/L4/history": () => {
          throw apiError(404, "NOT_FOUND");
        },
      }),
    });
    renderScreen(<LeadsPage />, "SALES_STAFF");
    const user = userEvent.setup();
    await screen.findByText("Công ty L4");
    await clickRowAction(user, "Xem chi tiết và lịch sử", rowOf("Công ty L4"));
    expect(
      await screen.findByText("Chưa xem được lịch sử của khách tiềm năng này."),
    ).toBeInTheDocument();
  });

  it("lọc trạng thái trên URL → tham số status; BE chưa có (404) → 'Chưa dùng được', không vỡ trang", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", { get: leads([lead("L1", "NEW")]) });
    const view = renderScreen(<LeadsPage />, "SALES_MANAGER", "?status=NEW");
    await screen.findByText("Công ty L1");
    const call = api.get.mock.calls.find((c) => c[0] === "/leads");
    expect((call?.[1] as { params: URLSearchParams }).params.get("status")).toBe("NEW");
    view.unmount();
    vi.restoreAllMocks();
    mockSalesOwnerApi("SALES_MANAGER", {
      get: leads([], {
        "/leads": () => {
          throw apiError(404, "NOT_FOUND");
        },
      }),
    });
    renderScreen(<LeadsPage />, "SALES_MANAGER");
    expect(await screen.findByText("Chưa dùng được khách tiềm năng")).toBeInTheDocument();
  });
});

describe("Yêu cầu đổi Sale (BR-S15, §10.5)", () => {
  const request = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    customerId: `c-${id}`,
    customerName: `Khách ${id}`,
    currentOwnerId: "s-a",
    currentOwnerName: "Sale An",
    preferredSalesUserId: "s-c",
    preferredSalesName: "Sale Chi",
    preferredSalesRecentlyContacted: true,
    reason: "SLOW_RESPONSE",
    note: "Hỏi giá hai ngày chưa trả lời",
    status: "PENDING",
    ...extra,
  });
  const get = (rows: unknown[]): RouteTable => ({
    "/sales-owner-change-requests": () => bePage(rows),
    "/customers/sales-agents": () => agentsOf(WORKLOAD),
  });

  it("dòng: Sale hiện tại, Sale khách muốn + cờ đã liên hệ gần đây, lý do, ghi chú", async () => {
    mockSalesOwnerApi("SALES_MANAGER", { get: get([request("R1")]) });
    renderScreen(<RequestsPage />, "SALES_MANAGER");
    const row = (await screen.findByText("Khách R1")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Sale An")).toBeInTheDocument();
    expect(within(row).getByText("Sale Chi")).toBeInTheDocument();
    expect(within(row).getByText("Đã liên hệ khách gần đây")).toBeInTheDocument();
    expect(within(row).getByText("Phản hồi chậm")).toBeInTheDocument();
    expect(within(row).getByText("Hỏi giá hai ngày chưa trả lời")).toBeInTheDocument();
  });

  it("đồng ý: điền sẵn Sale khách xin, cảnh báo vận động; gửi {newSalesOwnerId, note}", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get([request("R1")]),
      post: { "/sales-owner-change-requests/R1/approval": () => ({}) },
    });
    renderScreen(<RequestsPage />, "SALES_MANAGER");
    const user = userEvent.setup();
    await screen.findByText("Khách R1");
    await clickRowAction(user, "Đồng ý…", rowOf("Khách R1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/kiểm tra có vận động khách/)).toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: /Sale phụ trách mới/ })).toHaveTextContent(
      "Sale Chi",
    );
    await user.click(within(dialog).getByRole("button", { name: "Đồng ý và đổi" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/sales-owner-change-requests/R1/approval", {
        newSalesOwnerId: "s-c",
        note: "",
      }),
    );
  });

  it("từ chối: ghi chú bắt buộc; yêu cầu đã quyết → thao tác khoá", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get([request("R1"), request("R2", { status: "APPROVED" })]),
      post: { "/sales-owner-change-requests/R1/rejection": () => ({}) },
    });
    renderScreen(<RequestsPage />, "SALES_MANAGER");
    const user = userEvent.setup();
    await screen.findByText("Khách R2");
    const menu = await openRowMenu(user, rowOf("Khách R2"));
    expect(within(menu).getByRole("button", { name: /Đồng ý/ })).toBeDisabled();
    await user.keyboard("{Escape}");
    await clickRowAction(user, "Từ chối…", rowOf("Khách R1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Từ chối" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Lý do gửi khách/), "Sale An đang theo đơn lớn");
    await user.click(within(dialog).getByRole("button", { name: "Từ chối" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/sales-owner-change-requests/R1/rejection", {
        note: "Sale An đang theo đơn lớn",
      }),
    );
  });

  it("SALES_STAFF (không có quyền đọc yêu cầu) → không vào được", async () => {
    mockSalesOwnerApi("SALES_STAFF", { get: get([]) });
    renderScreen(<RequestsPage />, "SALES_STAFF");
    expect(await screen.findByText("Không có quyền truy cập")).toBeInTheDocument();
  });
});
