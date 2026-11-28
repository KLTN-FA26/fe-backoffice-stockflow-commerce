import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SALES_WORKLOAD_PERMISSIONS } from "@/constants/sales-owner";
import { apiError, bePage, renderScreen } from "@/test/api-screen";
import { agentsOf, mockSalesOwnerApi, workloadRow } from "@/test/sales-owner-screen";
import { clickRowAction, pickOption } from "@/test/ui-actions";

import { AssignmentPage } from "../components/AssignmentPage";
import { CheckList } from "../components/CheckList";

import type { RouteTable } from "@/test/api-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => vi.restoreAllMocks());

const WORKLOAD = [
  workloadRow("s-a", "Sale An", { customers: 12 }),
  workloadRow("s-b", "Sale Bình", { customers: 3, paused: true }),
  workloadRow("s-c", "Sale Chi", { customers: 7, onLeave: true, coverName: "Sale An" }),
];
const unowned = (state: string) => [
  {
    customerId: "c-9",
    fullName: state === "NEEDS_ASSIGNMENT" ? "Công ty Cần Giao" : "Công ty Mới",
    salesOwnerId: state === "NEEDS_ASSIGNMENT" ? "s-old" : undefined,
    salesOwnerName: state === "NEEDS_ASSIGNMENT" ? "Sale Cũ" : undefined,
    salesOwnerState: state,
  },
];

function get(extra: RouteTable = {}): RouteTable {
  return {
    "/sales/workload": () => WORKLOAD,
    "/customers/sales-agents": () => agentsOf(WORKLOAD),
    "/chat/agents/workload": () => [
      { userId: "s-a", openConversations: 5, overdueConversations: 2 },
    ],
    "/customers/sales-owner-transfers": () => [],
    "/customers": (params) =>
      bePage(unowned((params as URLSearchParams).get("salesOwnerState") ?? "NEEDS_ASSIGNMENT")),
    ...extra,
  };
}

const board = () => screen.findByRole("region", { name: "Bảng tải Sale" });
const names = (region: HTMLElement) =>
  within(region)
    .getAllByRole("row")
    .slice(1)
    .map((r) => within(r).getAllByRole("cell")[0]?.textContent ?? "");

describe("Phân công khách — bảng tải (§10.4)", () => {
  it("ghép bảng tải + số chat theo userId; tạm dừng / đang nghỉ hiện cạnh tên; sắp xếp theo cột", async () => {
    mockSalesOwnerApi("SALES_MANAGER", { get: get() });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    const region = await board();
    const rowOfAn = within(region).getByText("Sale An").closest("tr") as HTMLElement;
    expect(within(rowOfAn).getByText("5")).toBeInTheDocument();
    expect(within(region).getByText("tạm dừng nhận khách")).toBeInTheDocument();
    expect(within(region).getByText(/đang nghỉ · Sale An lo thay/)).toBeInTheDocument();
    await userEvent.click(within(region).getByRole("button", { name: /Khách phụ trách/ }));
    const who = (n: string) => ["Sale An", "Sale Bình", "Sale Chi"].find((x) => n.startsWith(x));
    expect(names(region).map(who)).toEqual(["Sale Bình", "Sale Chi", "Sale An"]);
  });

  it("SALES_STAFF (không có sales-workload:READ) → không vào được trang", async () => {
    mockSalesOwnerApi("SALES_STAFF", { get: get() });
    renderScreen(<AssignmentPage />, "SALES_STAFF");
    expect(await screen.findByText("Không có quyền truy cập")).toBeInTheDocument();
  });

  it("chỉ đọc (không có customer-sales-owners:UPDATE) → không có nút 'Chuyển khách…'", async () => {
    mockSalesOwnerApi("SALES_MANAGER", { get: get() }, [SALES_WORKLOAD_PERMISSIONS.read]);
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    const region = await board();
    expect(within(region).queryByRole("button", { name: /Chuyển khách/ })).toBeNull();
  });

  it("BE chưa có số chat (404) → bảng vẫn hiện, ô chat '—'", async () => {
    mockSalesOwnerApi("SALES_MANAGER", {
      get: get({
        "/chat/agents/workload": () => {
          throw apiError(404, "NOT_FOUND");
        },
      }),
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    expect(
      await within(await board()).findByText("Chưa có số hội thoại từ chat."),
    ).toBeInTheDocument();
  });
});

describe("Chuyển khách… (BR-S09, §10.1, ca #9)", () => {
  async function open(post: RouteTable) {
    const api = mockSalesOwnerApi("SALES_MANAGER", { get: get(), post });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    await userEvent.click(within(await board()).getByRole("button", { name: /Chuyển khách/ }));
    return { api, dialog: await screen.findByRole("dialog") };
  }

  it("kiểm tra form: Sale nguồn, Sale nhận, lý do; lý do 'Tạm thời' tự đánh dấu lô tạm", async () => {
    const { api, dialog } = await open({});
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    expect(await within(dialog).findByText("Chọn Sale đang phụ trách")).toBeInTheDocument();
    expect(within(dialog).getByText("Chọn ít nhất một Sale nhận")).toBeInTheDocument();
    await pickOption(user, /Lý do/, "Tạm thời — chờ Sale quay lại");
    expect(within(dialog).getByRole("checkbox", { name: /Lô tạm/ })).toBeChecked();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("D42: 'Sang Sale' chỉ có Sale giao được (sales-agents); 'Từ Sale' vẫn có người trên bảng tải", async () => {
    mockSalesOwnerApi("SALES_MANAGER", {
      get: get({ "/customers/sales-agents": () => agentsOf(WORKLOAD.slice(0, 2)) }),
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    await userEvent.click(within(await board()).getByRole("button", { name: /Chuyển khách/ }));
    const dialog = await screen.findByRole("dialog");
    const user = userEvent.setup();
    // Sale Chi còn trên bảng tải (chuyển khách ĐI được) nhưng không phải Sale giao được (D42)
    await user.click(within(dialog).getByRole("combobox", { name: /Từ Sale/ }));
    expect(await screen.findByRole("option", { name: /^Sale Chi/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await pickOption(user, /Từ Sale/, /^Sale An/);
    expect(within(dialog).getByRole("checkbox", { name: /Sale Bình/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("checkbox", { name: /Sale Chi/ })).toBeNull();
  });

  it("BR-S09: gửi requestId MỘT lần mỗi lần mở — bấm lại sau lỗi dùng đúng khoá; mở lại là khoá mới", async () => {
    let fail = true;
    const { api, dialog } = await open({
      "/customers/sales-owner-transfers": () => {
        if (fail) {
          fail = false;
          throw apiError(503, "BACKEND_UNAVAILABLE");
        }
        return {
          batchId: "b-1",
          moved: 4,
          skipped: [{ customerId: "c-7", reason: "NOT_OWNED_BY_SOURCE" }],
        };
      },
    });
    const user = userEvent.setup();
    await pickOption(user, /Từ Sale/, /^Sale An/);
    await user.click(within(dialog).getByRole("checkbox", { name: /Sale Bình/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Sale Chi/ }));
    await pickOption(user, /Lý do/, "Sale nghỉ việc");
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    expect(await screen.findByText("Đã chuyển 4 khách. Bỏ qua 1 khách.")).toBeInTheDocument();
    expect(screen.getByText(/Khách không còn thuộc Sale này/)).toBeInTheDocument();
    const bodies = api.post.mock.calls.map((c) => c[1] as Record<string, unknown>);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.requestId).toBe(bodies[1]?.requestId);
    expect(bodies[1]).toMatchObject({
      fromUserId: "s-a",
      toUserIds: ["s-b", "s-c"],
      reason: "STAFF_LEFT",
      temporary: false,
      notifyCustomer: true,
    });
    expect(bodies[1]).not.toHaveProperty("customerIds");
    await user.click(screen.getByRole("button", { name: "Đóng" }));
    await user.click(within(await board()).getByRole("button", { name: /Chuyển khách/ }));
    const again = await screen.findByRole("dialog");
    await pickOption(user, /Từ Sale/, /^Sale An/);
    await user.click(within(again).getByRole("checkbox", { name: /Sale Bình/ }));
    await pickOption(user, /Lý do/, "Sale nghỉ việc");
    await user.click(within(again).getByRole("button", { name: "Chuyển" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(3));
    const third = api.post.mock.calls[2]?.[1] as Record<string, unknown>;
    expect(third.requestId).not.toBe(bodies[0]?.requestId);
  });

  it("chọn một phần khách: phải tick ít nhất một khách; gửi customerIds", async () => {
    const { api, dialog } = await open({
      "/customers/sales-owner-transfers": () => ({ batchId: "b-2", moved: 1, skipped: [] }),
    });
    const user = userEvent.setup();
    await pickOption(user, /Từ Sale/, /^Sale An/);
    await user.click(within(dialog).getByRole("checkbox", { name: /Sale Bình/ }));
    await pickOption(user, /Lý do/, "Chia lại tải");
    await user.click(within(dialog).getByRole("radio", { name: "Chọn một phần khách" }));
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    expect(await within(dialog).findByText("Chọn ít nhất một khách")).toBeInTheDocument();
    await user.click(await within(dialog).findByRole("checkbox", { name: "Công ty Cần Giao" }));
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    await waitFor(() =>
      expect(api.post.mock.calls[0]?.[1]).toMatchObject({
        customerIds: ["c-9"],
        reason: "WORKLOAD",
      }),
    );
  });
});

describe("Chuyển khách — tối đa 500 khách một lô, khoá đã dùng (BR-S09)", () => {
  async function fill(dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>, from: RegExp) {
    await pickOption(user, /Từ Sale/, from);
    await user.click(within(dialog).getByRole("checkbox", { name: /Sale Bình/ }));
    await pickOption(user, /Lý do/, "Sale nghỉ việc");
  }

  it("SALES_OWNER_TRANSFER_REQUEST_REUSED → câu tiếng Việt và lần bấm sau dùng requestId mới", async () => {
    let calls = 0;
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get(),
      post: {
        "/customers/sales-owner-transfers": () => {
          calls += 1;
          if (calls === 1) throw apiError(409, "SALES_OWNER_TRANSFER_REQUEST_REUSED");
          return { batchId: "b-9", moved: 2, skipped: [] };
        },
      },
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    await userEvent.click(within(await board()).getByRole("button", { name: /Chuyển khách/ }));
    const dialog = await screen.findByRole("dialog");
    const user = userEvent.setup();
    await fill(dialog, user, /^Sale An/);
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    expect(
      await within(dialog).findByText(
        "Yêu cầu chuyển này đã được gửi với nội dung khác. Mở lại hộp thoại để tạo yêu cầu mới.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    expect(await screen.findByText(/Đã chuyển 2 khách/)).toBeInTheDocument();
    const ids = api.post.mock.calls.map((c) => (c[1] as { requestId: string }).requestId);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("SALES_OWNER_TRANSFER_TOO_LARGE → câu tiếng Việt", async () => {
    mockSalesOwnerApi("SALES_MANAGER", {
      get: get(),
      post: {
        "/customers/sales-owner-transfers": () => {
          throw apiError(422, "SALES_OWNER_TRANSFER_TOO_LARGE");
        },
      },
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    await userEvent.click(within(await board()).getByRole("button", { name: /Chuyển khách/ }));
    const dialog = await screen.findByRole("dialog");
    const user = userEvent.setup();
    await fill(dialog, user, /^Sale An/);
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    expect(
      await within(dialog).findByText(
        "Mỗi lần chỉ chuyển tối đa 500 khách. Hãy chọn từng nhóm khách để chuyển.",
      ),
    ).toBeInTheDocument();
  });

  it("Sale nguồn hơn 500 khách + 'tất cả' → cảnh báo, không gửi; chọn một phần khách thì gửi được", async () => {
    const big = [workloadRow("s-big", "Sale Lớn", { customers: 620 }), ...WORKLOAD];
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get({
        "/sales/workload": () => big,
        "/customers/sales-agents": () => agentsOf(big),
      }),
      post: {
        "/customers/sales-owner-transfers": () => ({ batchId: "b-3", moved: 1, skipped: [] }),
      },
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    await userEvent.click(within(await board()).getByRole("button", { name: /Chuyển khách/ }));
    const dialog = await screen.findByRole("dialog");
    const user = userEvent.setup();
    await fill(dialog, user, /^Sale Lớn/);
    expect(
      within(dialog).getByText(/Sale này đang phụ trách 620 khách — mỗi lần chỉ chuyển tối đa 500/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Chuyển" })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("radio", { name: "Chọn một phần khách" }));
    expect(within(dialog).queryByText(/đang phụ trách 620 khách/)).toBeNull();
    await user.click(await within(dialog).findByRole("checkbox", { name: "Công ty Cần Giao" }));
    expect(within(dialog).getByText("Đã chọn 1/500")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Chuyển" }));
    await waitFor(() =>
      expect(api.post.mock.calls[0]?.[1]).toMatchObject({
        fromUserId: "s-big",
        customerIds: ["c-9"],
      }),
    );
  });

  it("danh sách chọn có giới hạn: đủ số tối đa thì ô chưa tick bị khoá", async () => {
    const onChange = vi.fn();
    const options = ["a", "b", "c"].map((value) => ({ value, label: `Khách ${value}` }));
    render(
      <CheckList
        id="t"
        label="Khách"
        options={options}
        selected={["a", "b"]}
        onChange={onChange}
        max={2}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Khách c" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Khách a" })).toBeEnabled();
    expect(screen.getByText("Đã chọn 2/2 — đã đủ số tối đa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Khách a" }));
    expect(onChange).toHaveBeenCalledWith(["b"]);
  });
});

describe("Cài đặt phân công, lô tạm, khách cần giao", () => {
  it("D13: sức chứa phải là số nguyên; lưu {paused, capacityPerMonth}", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get(),
      put: {
        "/sales/staff/s-a/assignment-settings": () => ({ paused: true, capacityPerMonth: 5 }),
      },
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    const user = userEvent.setup();
    await clickRowAction(
      user,
      "Cài đặt phân công…",
      (await within(await board()).findByText("Sale An")).closest("tr") as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Sức chứa/), "abc");
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    expect(await within(dialog).findByText("Nhập số nguyên từ 0")).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/Sức chứa/));
    await user.type(within(dialog).getByLabelText(/Sức chứa/), "5");
    await user.click(within(dialog).getByRole("checkbox", { name: /Tạm dừng/ }));
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith("/sales/staff/s-a/assignment-settings", {
        paused: true,
        capacityPerMonth: 5,
      }),
    );
  });

  it("§10.1 lô tạm: 'Trả lại cho …' gọi return và báo khách đã chuyển tiếp bị bỏ qua", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get({
        "/customers/sales-owner-transfers": () => [
          {
            batchId: "b-1",
            fromName: "Sale Chi",
            toNames: ["Sale An"],
            reason: "TEMPORARY_LEAVE",
            temporary: true,
            stillHeld: 3,
          },
        ],
      }),
      post: {
        "/customers/sales-owner-transfers/b-1/return": () => ({
          batchId: "b-1",
          moved: 2,
          skipped: [{ customerId: "c-3", reason: "REASSIGNED_SINCE" }],
        }),
      },
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    const panel = await screen.findByRole("region", { name: "Lô chuyển tạm" });
    await within(panel).findByText("Sale Chi");
    const user = userEvent.setup();
    await clickRowAction(user, "Trả lại cho Sale Chi…", panel);
    await user.click(await screen.findByRole("button", { name: "Trả lại" }));
    expect(await screen.findByText("Đã chuyển 2 khách. Bỏ qua 1 khách.")).toBeInTheDocument();
    expect(screen.getByText(/chuyển tiếp cho người khác/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/customers/sales-owner-transfers/b-1/return");
  });

  it("chưa liệt kê được lô tạm (404) → phần lô tạm ẩn", async () => {
    mockSalesOwnerApi("SALES_MANAGER", {
      get: get({
        "/customers/sales-owner-transfers": () => {
          throw apiError(404, "NOT_FOUND");
        },
      }),
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    await board();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Lô chuyển tạm" })).toBeNull());
  });

  it("BR-S08 'Cần giao người phụ trách': giao nhanh gợi ý Sale còn trống nhất, lý do mặc định 'Sale nghỉ việc'", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get({
        "/customers/c-9/sales-owner": () => ({
          customerId: "c-9",
          salesOwnerId: "s-old",
          salesOwnerName: "Sale Cũ",
          active: false,
          state: "NEEDS_ASSIGNMENT",
          version: 2,
        }),
      }),
      put: { "/customers/c-9/sales-owner": () => ({ customerId: "c-9", version: 3 }) },
    });
    renderScreen(<AssignmentPage />, "SALES_MANAGER");
    const panel = await screen.findByRole("region", { name: "Cần giao người phụ trách" });
    const user = userEvent.setup();
    await clickRowAction(
      user,
      "Giao người phụ trách…",
      (await within(panel).findByText("Công ty Cần Giao")).closest("tr") as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog", { name: "Giao người phụ trách" });
    await user.click(within(dialog).getByRole("combobox", { name: /Sale phụ trách mới/ }));
    // An 12 khách, Bình tạm dừng, Chi đang nghỉ → gợi ý An (người duy nhất còn nhận)
    expect(await screen.findByRole("option", { name: "Sale An · gợi ý" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Sale An · gợi ý" }));
    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith(
        "/customers/c-9/sales-owner",
        expect.objectContaining({ salesOwnerId: "s-a", reason: "STAFF_LEFT", version: 2 }),
      ),
    );
  });
});
