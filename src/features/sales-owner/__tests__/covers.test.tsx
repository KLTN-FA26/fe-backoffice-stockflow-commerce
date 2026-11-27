import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiError, renderScreen } from "@/test/api-screen";
import { pickDate } from "@/test/date-picker";
import { mockSalesOwnerApi, salesAgent, workloadRow } from "@/test/sales-owner-screen";
import { clickRowAction, openRowMenu, pickOption } from "@/test/ui-actions";

import { CoversPage } from "../components/CoversPage";
import { todayInVietnam } from "../selectors";

import type { RouteTable } from "@/test/api-screen";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => vi.restoreAllMocks());

const day = (offset: number) => {
  const date = new Date(`${todayInVietnam()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const COVERS = [
  {
    id: "v-1",
    userId: "u-test",
    userName: "Test",
    coverUserId: "s-b",
    coverUserName: "Sale Bình",
    from: day(-1),
    to: day(3),
    reason: "Nghỉ phép",
  },
  {
    id: "v-2",
    userId: "s-c",
    userName: "Sale Chi",
    coverUserId: "s-b",
    coverUserName: "Sale Bình",
    from: day(5),
    to: day(9),
  },
];
const get = (extra: RouteTable = {}): RouteTable => ({
  "/staff-covers": () => COVERS,
  // D42: người vắng / người thay lấy từ Sale giao được
  "/customers/sales-agents": () => [
    salesAgent("u-test", "Test"),
    salesAgent("s-b", "Sale Bình"),
    salesAgent("s-c", "Sale Chi"),
  ],
  "/sales/workload": () => [workloadRow("s-b", "Sale Bình"), workloadRow("s-c", "Sale Chi")],
  ...extra,
});

describe("Lịch người thay (BR-S07, D7)", () => {
  it("danh sách: trạng thái theo ngày; mặc định chỉ lịch còn hiệu lực (active=true)", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", { get: get() });
    renderScreen(<CoversPage />, "SALES_STAFF");
    expect(await screen.findByText("Đang lo thay")).toBeInTheDocument();
    expect(screen.getByText("Sắp tới")).toBeInTheDocument();
    const call = api.get.mock.calls.find((c) => c[0] === "/staff-covers");
    expect((call?.[1] as { params: URLSearchParams }).params.get("active")).toBe("true");
  });

  it("Sale: chỉ huỷ được lịch của mình — lịch người khác bị khoá kèm lý do", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", {
      get: get(),
      post: { "/staff-covers/v-1/cancellation": () => ({}) },
    });
    renderScreen(<CoversPage />, "SALES_STAFF");
    const user = userEvent.setup();
    const others = (await screen.findByText("Sale Chi")).closest("tr") as HTMLElement;
    const menu = await openRowMenu(user, others);
    expect(within(menu).getByRole("button", { name: /Huỷ lịch/ })).toBeDisabled();
    await user.keyboard("{Escape}");
    await clickRowAction(
      user,
      /Huỷ lịch/,
      screen.getByText("Nghỉ phép").closest("tr") as HTMLElement,
    );
    await user.click(await screen.findByRole("button", { name: "Huỷ lịch" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/staff-covers/v-1/cancellation"));
  });

  it("Sale lập cho chính mình: kiểm tra bắt buộc, tối đa 60 ngày; lỗi chồng lịch BE hiện tiếng Việt", async () => {
    const api = mockSalesOwnerApi("SALES_STAFF", {
      get: get(),
      post: {
        "/staff-covers": () => {
          throw apiError(409, "STAFF_COVER_OVERLAP");
        },
      },
    });
    renderScreen(<CoversPage />, "SALES_STAFF");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Lập lịch thay/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("combobox", { name: /Sale vắng mặt/ })).toBeNull();
    expect(within(dialog).getByText("Test")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Lập lịch" }));
    expect(await within(dialog).findByText("Chọn người thay")).toBeInTheDocument();
    expect(within(dialog).getByText("Chọn ngày bắt đầu")).toBeInTheDocument();
    // Người vắng không có trong danh sách người thay (không tự thay mình)
    await user.click(within(dialog).getByRole("combobox", { name: /Người thay/ }));
    expect(screen.queryByRole("option", { name: "Test" })).toBeNull();
    await user.click(screen.getByRole("option", { name: "Sale Bình" }));
    await pickDate(user, within(dialog).getByRole("textbox", { name: /^Từ ngày/ }), "2027-03-01");
    await pickDate(user, within(dialog).getByRole("textbox", { name: /^Đến ngày/ }), "2027-05-01");
    await user.click(within(dialog).getByRole("button", { name: "Lập lịch" }));
    expect(await within(dialog).findByText("Lịch thay tối đa 60 ngày")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    await pickDate(user, within(dialog).getByRole("textbox", { name: /^Đến ngày/ }), "2027-03-10");
    await user.click(within(dialog).getByRole("button", { name: "Lập lịch" }));
    expect(
      await within(dialog).findByText(/đã có lịch thay trùng khoảng ngày/),
    ).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/staff-covers", {
      userId: "u-test",
      coverUserId: "s-b",
      from: "2027-03-01",
      to: "2027-03-10",
      reason: "",
    });
  });

  it("quản lý lập cho bất kỳ ai: chọn Sale vắng mặt từ bảng tải", async () => {
    const api = mockSalesOwnerApi("SALES_MANAGER", {
      get: get(),
      post: { "/staff-covers": () => ({}) },
    });
    renderScreen(<CoversPage />, "SALES_MANAGER");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /Lập lịch thay/ }));
    const dialog = await screen.findByRole("dialog");
    await pickOption(user, /Sale vắng mặt/, "Sale Chi");
    await pickOption(user, /Người thay/, "Sale Bình");
    await pickDate(user, within(dialog).getByRole("textbox", { name: /^Từ ngày/ }), "2027-03-01");
    await pickDate(user, within(dialog).getByRole("textbox", { name: /^Đến ngày/ }), "2027-03-02");
    await user.click(within(dialog).getByRole("button", { name: "Lập lịch" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        "/staff-covers",
        expect.objectContaining({ userId: "s-c", coverUserId: "s-b" }),
      ),
    );
  });

  it("review S3: Sale chỉ thấy lịch của mình (mô tả nói rõ); lịch không có lý do hiện '—'", async () => {
    mockSalesOwnerApi("SALES_STAFF", { get: get() });
    renderScreen(<CoversPage />, "SALES_STAFF");
    const panel = await screen.findByRole("region", { name: "Lịch người thay" });
    expect(
      within(panel).getByText(/^Lịch bạn vắng hoặc bạn lo thay cho người khác\./),
    ).toBeInTheDocument();
    const noReason = within(panel).getByText("Sale Chi").closest("tr") as HTMLElement;
    expect(within(noReason).getAllByRole("cell")[4]).toHaveTextContent("—");
  });

  it("Sale chưa có lịch nào → câu trống nói về lịch của chính họ; quản lý → câu chung", async () => {
    mockSalesOwnerApi("SALES_STAFF", { get: get({ "/staff-covers": () => [] }) });
    const view = renderScreen(<CoversPage />, "SALES_STAFF");
    expect(
      await screen.findByText("Bạn chưa có lịch vắng hay lịch lo thay cho ai."),
    ).toBeInTheDocument();
    view.unmount();
    vi.restoreAllMocks();
    mockSalesOwnerApi("SALES_MANAGER", { get: get({ "/staff-covers": () => [] }) });
    renderScreen(<CoversPage />, "SALES_MANAGER");
    expect(await screen.findByText("Chưa có lịch người thay nào.")).toBeInTheDocument();
  });

  it("không có staff-covers:READ (Kế toán) → không vào được; không CREATE → không có nút lập", async () => {
    mockSalesOwnerApi("ACCOUNTANT", { get: get() });
    const view = renderScreen(<CoversPage />, "ACCOUNTANT");
    expect(await screen.findByText("Không có quyền truy cập")).toBeInTheDocument();
    view.unmount();
    vi.restoreAllMocks();
    mockSalesOwnerApi("SALES_STAFF", { get: get() }, ["staff-covers:READ"]);
    renderScreen(<CoversPage />, "SALES_STAFF");
    await screen.findByText("Đang lo thay");
    expect(screen.queryByRole("button", { name: /Lập lịch thay/ })).toBeNull();
  });
});
