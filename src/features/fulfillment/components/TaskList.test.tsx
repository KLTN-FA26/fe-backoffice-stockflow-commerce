import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TOAST_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import {
  IDENTITIES,
  mockFulfillmentApi,
  pickSelectOption,
  renderFulfillmentScreen,
} from "../__fixtures__/render";
import {
  ORDER_ID,
  OTHER_PICKER_ID,
  TASK_ID,
  apiTask,
  assignableUsers,
  bePage,
  fulfillmentOrder,
} from "../__fixtures__/task";
import { PickingList } from "./TaskList";

import type { TestIdentity } from "../__fixtures__/render";
import type { FulfillmentTaskApiDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const { fulfillment, loadError } = UI_LABELS;
const HELD_ID = "aaaaaaaa-0000-4000-8000-00000000000a";

function renderList(
  ui: React.ReactElement,
  identity: TestIdentity,
  tasks: FulfillmentTaskApiDto[] = [apiTask()],
) {
  const spies = mockFulfillmentApi(
    identity,
    {
      "/fulfillment/tasks": () => bePage(tasks),
      "/orders": () => bePage([fulfillmentOrder]),
      "/identity/users": () => bePage(assignableUsers),
    },
    {},
    {
      [`/fulfillment/tasks/${TASK_ID}/assignment`]: (_params, body) => ({
        ...apiTask(),
        ...(body as object),
      }),
    },
  );
  renderFulfillmentScreen(ui);
  return spies;
}

describe("PickingList — danh sách task theo BE (chỉ phân trang)", () => {
  it("NV kho theo seed BE: thấy task của mình, trạng thái theo tên BE, không có nút tạo / gán", async () => {
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseStaff);

    const row = (await screen.findByRole("link", { name: "3F4A5B6C" })).closest("tr");
    expect(row).not.toBeNull();
    const cells = within(row as HTMLElement);
    // BE pick PENDING + pack PENDING → "Pending" (tên enum BE) → nhãn tiếng Việt ở cả 2 cột
    expect(cells.getAllByText("Chờ xử lý")).toHaveLength(2);
    expect(cells.getByText(fulfillment.self)).toBeInTheDocument();
    // Không có sales-orders:READ → hiện id đơn rút gọn, không gọi /orders
    expect(cells.getByText(ORDER_ID.slice(-8).toUpperCase())).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/orders")).toBe(false);
    expect(get.mock.calls.some(([url]) => url === "/identity/users")).toBe(false);

    // BE chỉ nhận page + size
    const listCall = get.mock.calls.find(([url]) => url === "/fulfillment/tasks");
    expect(listCall?.[1]).toMatchObject({ params: { page: 0, size: 15 } });
    expect(screen.queryByRole("button", { name: fulfillment.action.create })).toBeNull();
    expect(screen.queryByRole("button", { name: /Gán lại/ })).toBeNull();
  });

  it("không có ô tìm kiếm / bộ lọc trạng thái — BE chưa hỗ trợ", async () => {
    renderList(<PickingList />, IDENTITIES.warehouseManager);
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lọc trạng thái" })).toBeNull();
    expect(screen.getByText(/Phạm vi: mọi task/)).toBeInTheDocument();
  });

  it("quản lý kho có quyền đọc đơn + nhân viên: hiện số đơn, tên người được gán, gán lại gửi PUT", async () => {
    const user = userEvent.setup();
    const { put } = renderList(<PickingList />, IDENTITIES.managerWithReferences, [
      apiTask({ assignedUserId: OTHER_PICKER_ID }),
    ]);

    expect(await screen.findByText("SO-20261010-000431")).toBeInTheDocument();
    expect(await screen.findByText("Nguyễn Văn Đạt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fulfillment.action.create })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Gán lại task 3F4A5B6C/ }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
    await user.click(within(dialog).getByRole("button", { name: fulfillment.action.assign }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]).toEqual([
      `/fulfillment/tasks/${TASK_ID}/assignment`,
      { assignedUserId: assignableUsers[0]?.userId },
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("chọn lại đúng người đang được gán → khoá nút gửi và nói rõ lý do", async () => {
    const user = userEvent.setup();
    const { put } = renderList(<PickingList />, IDENTITIES.managerWithReferences, [
      apiTask({ assignedUserId: OTHER_PICKER_ID }),
    ]);

    await user.click(await screen.findByRole("button", { name: /Gán lại task/ }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, "Người được gán", /Nguyễn Văn Đạt/);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(fulfillment.alreadyAssigned);
    expect(within(dialog).getByRole("button", { name: fulfillment.action.assign })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("quản lý kho theo seed BE (thiếu identity-users:READ): dialog gán báo thiếu quyền, khoá nút gửi", async () => {
    const user = userEvent.setup();
    const { put } = renderList(<PickingList />, IDENTITIES.warehouseManager, [
      apiTask({ assignedUserId: OTHER_PICKER_ID }),
    ]);

    await user.click(await screen.findByRole("button", { name: /Gán lại task/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(fulfillment.noUserReadTitle)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: fulfillment.action.assign })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("điều phối đơn: gán được task còn Pending, không gán task đang lấy hàng", async () => {
    renderList(<PickingList />, IDENTITIES.orderCoordinator, [
      apiTask(),
      apiTask({ taskId: HELD_ID, pickStatus: "PICKING" }),
    ]);
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(screen.getAllByRole("button", { name: /Gán lại task/ })).toHaveLength(1);
  });

  it("QC theo seed BE không có VIEW_PAGE → bị chặn ở cổng route, không gọi API task", async () => {
    const { get } = renderList(<PickingList />, IDENTITIES.qcStaff);
    expect(await screen.findByText(loadError.forbiddenTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/fulfillment/tasks")).toBe(false);
  });

  it("chưa có task → EmptyState riêng; nút tạo chỉ có một, ở PageHeader", async () => {
    renderList(<PickingList />, IDENTITIES.warehouseManager, []);
    expect(await screen.findByText("Chưa có task xuất kho")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: fulfillment.action.create })).toHaveLength(1);
  });

  it("NV kho chưa có task → EmptyState không có nút tạo", async () => {
    renderList(<PickingList />, IDENTITIES.warehouseStaff, []);
    expect(await screen.findByText("Chưa có task xuất kho")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: fulfillment.action.create })).toBeNull();
  });
});

describe("Tạo task lấy hàng", () => {
  /** Mở dialog, chọn đơn + người được gán (Hoàng Anh Tuấn = PICKER_ID) rồi gửi. */
  async function createTask(created: FulfillmentTaskApiDto) {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success").mockImplementation(() => "");
    const warning = vi.spyOn(toast, "warning").mockImplementation(() => "");
    const spies = mockFulfillmentApi(
      IDENTITIES.managerWithReferences,
      {
        "/fulfillment/tasks": () => bePage([]),
        // Như BE thật: dòng danh sách đơn không kèm dòng hàng
        "/orders": () => bePage([{ ...fulfillmentOrder, status: "CONFIRMED", lines: [] }]),
        "/identity/users": () => bePage(assignableUsers),
      },
      { "/fulfillment/tasks": () => created },
    );
    renderFulfillmentScreen(<PickingList />);

    await user.click(await screen.findByRole("button", { name: fulfillment.action.create }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, "Đơn hàng", "SO-20261010-000431");
    // Không hiện "0 dòng" — danh sách đơn của BE không có dòng hàng để đếm
    expect(within(dialog).queryByText(/dòng/)).toBeNull();
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
    await user.click(within(dialog).getByRole("button", { name: fulfillment.action.create }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    return { ...spies, success, warning };
  }

  it("gửi đúng `CreateTaskRequest` và báo đã tạo", async () => {
    const { post, success, warning } = await createTask(apiTask());
    expect(post).toHaveBeenCalledWith("/fulfillment/tasks", {
      orderId: ORDER_ID,
      assignedUserId: assignableUsers[0]?.userId,
    });
    expect(success).toHaveBeenCalledWith(TOAST_MESSAGES.fulfillment.created);
    expect(warning).not.toHaveBeenCalled();
  });

  it("đơn đã có task (BE trả task cũ gán cho người khác, vẫn 201) → cảnh báo, không báo đã tạo", async () => {
    const { success, warning } = await createTask(apiTask({ assignedUserId: OTHER_PICKER_ID }));
    expect(warning).toHaveBeenCalledWith(TOAST_MESSAGES.fulfillment.alreadyExists);
    expect(success).not.toHaveBeenCalled();
  });
});

describe("Tạo task lấy hàng — lỗi tải danh sách đơn", () => {
  it("báo lỗi kèm nút Thử lại ngay trong dialog; thử lại thành công thì chọn được đơn", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    let failing = true;
    mockFulfillmentApi(IDENTITIES.managerWithReferences, {
      "/fulfillment/tasks": () => bePage([]),
      "/identity/users": () => bePage(assignableUsers),
      "/orders": (params) => {
        // Chỉ làm hỏng lần gọi của dialog (có lọc status), không đụng lần tra số đơn của danh sách
        const isDialogCall = typeof params === "object" && params !== null && "status" in params;
        if (isDialogCall && failing) throw new ApiError(500, "INTERNAL_ERROR", "boom");
        return bePage([{ ...fulfillmentOrder, status: "CONFIRMED", lines: [] }]);
      },
    });
    renderFulfillmentScreen(<PickingList />);

    await user.click(await screen.findByRole("button", { name: fulfillment.action.create }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByText(/Không tải được danh sách đơn hàng chờ xuất kho/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: fulfillment.action.create })).toBeDisabled();

    failing = false;
    await user.click(within(dialog).getByRole("button", { name: UI_LABELS.common.retry }));
    expect(await within(dialog).findByRole("combobox", { name: "Đơn hàng" })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Không tải được danh sách đơn hàng/)).toBeNull();
  });
});
