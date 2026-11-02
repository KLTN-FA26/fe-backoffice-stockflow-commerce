import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES, TOAST_MESSAGES, UI_LABELS } from "@/constants";
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
  WAREHOUSE_ID,
  assignees,
  bePage,
  taskCandidate,
} from "../__fixtures__/task";
import { CreateTaskDialog } from "./assign/CreateTaskDialog";
import { PickingList } from "./TaskList";

import type { TestIdentity } from "../__fixtures__/render";
import type { FulfillmentTaskApiDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const { fulfillment, loadError } = UI_LABELS;
const FILTER = fulfillment.filter;
const HELD_ID = "aaaaaaaa-0000-4000-8000-00000000000a";

const OTHER_WAREHOUSE_ID = "wh-hn-0002";
const WAREHOUSES = [
  { id: WAREHOUSE_ID, prefix: "HCM", name: "Kho Hồ Chí Minh", status: "ACTIVE" },
  { id: OTHER_WAREHOUSE_ID, prefix: "HN", name: "Kho Hà Nội", status: "ACTIVE" },
];

function renderList(
  ui: React.ReactElement,
  identity: TestIdentity,
  tasks: FulfillmentTaskApiDto[] = [apiTask()],
  options: { searchParams?: string; list?: (params: unknown) => unknown } = {},
) {
  const spies = mockFulfillmentApi(
    identity,
    {
      "/fulfillment/tasks": options.list ?? (() => bePage(tasks)),
      "/warehouses": () => bePage(WAREHOUSES),
      "/fulfillment/task-candidates": () => bePage([taskCandidate]),
      "/fulfillment/assignees": () => assignees,
    },
    {},
    {
      [`/fulfillment/tasks/${TASK_ID}/assignment`]: (_params, body) => ({
        ...apiTask(),
        ...(body as object),
      }),
    },
  );
  renderFulfillmentScreen(ui, undefined, options.searchParams);
  return spies;
}

const listCalls = (get: ReturnType<typeof mockFulfillmentApi>["get"]) =>
  get.mock.calls.filter(([url]) => url === "/fulfillment/tasks");
const lastListParams = (get: ReturnType<typeof mockFulfillmentApi>["get"]) =>
  (listCalls(get).at(-1)?.[1] as { params?: Record<string, unknown> } | undefined)?.params;

describe("PickingList — danh sách task theo BE (phân trang + lọc)", () => {
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

  it("cột Đơn hiện orderNumber của task, không gọi /orders kể cả khi có sales-orders:READ", async () => {
    const { get } = renderList(<PickingList />, IDENTITIES.orderCoordinator, [
      apiTask({ orderNumber: "SO-20261010-000431" }),
    ]);
    expect(await screen.findByText("SO-20261010-000431")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/orders")).toBe(false);
  });

  it("không có ô tìm kiếm (BE không có search); có lọc kho + trạng thái", async () => {
    renderList(<PickingList />, IDENTITIES.warehouseManager);
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("combobox", { name: FILTER.warehouse })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: FILTER.status })).toBeInTheDocument();
    expect(screen.getByText(/Phạm vi: mọi task/)).toBeInTheDocument();
  });

  it("ghi chú phạm vi theo mã quyền: oversight → mọi task; design-reverification → kiện giữ; còn lại → của mình", async () => {
    renderList(<PickingList />, IDENTITIES.warehouseStaff);
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(screen.getByText(/Phạm vi: task được gán cho bạn/)).toBeInTheDocument();
    cleanup();

    renderList(<PickingList />, {
      permissions: [...IDENTITIES.qcStaff.permissions, "fulfillment-pick-lists:VIEW_PAGE" as const],
    });
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(screen.getByText(/Phạm vi: kiện đang bị giữ do lệch thiết kế/)).toBeInTheDocument();
  });

  it("quản lý kho: hiện số đơn, tên người được gán (assignedUserName), gán lại lấy danh sách theo kho rồi gửi PUT", async () => {
    const user = userEvent.setup();
    const { get, put } = renderList(<PickingList />, IDENTITIES.warehouseManager, [
      apiTask({
        orderNumber: "SO-20261010-000431",
        assignedUserId: OTHER_PICKER_ID,
        assignedUserName: "Nguyễn Văn Đạt",
      }),
    ]);

    expect(await screen.findByText("SO-20261010-000431")).toBeInTheDocument();
    expect(await screen.findByText("Nguyễn Văn Đạt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fulfillment.action.create })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Gán lại task 3F4A5B6C/ }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
    // Danh sách người nhận lấy theo kho của task, không qua /identity/users
    const assigneeCall = get.mock.calls.find(([url]) => url === "/fulfillment/assignees");
    expect(assigneeCall?.[1]).toMatchObject({ params: { warehouseId: WAREHOUSE_ID } });
    expect(get.mock.calls.some(([url]) => url === "/identity/users")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: fulfillment.action.assign }));

    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(put.mock.calls[0]).toEqual([
      `/fulfillment/tasks/${TASK_ID}/assignment`,
      { assignedUserId: assignees[0]?.userId },
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("chọn lại đúng người đang được gán → khoá nút gửi và nói rõ lý do", async () => {
    const user = userEvent.setup();
    const { put } = renderList(<PickingList />, IDENTITIES.warehouseManager, [
      apiTask({ assignedUserId: OTHER_PICKER_ID }),
    ]);

    await user.click(await screen.findByRole("button", { name: /Gán lại task/ }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, "Người được gán", /Nguyễn Văn Đạt/);
    expect(within(dialog).getByRole("alert")).toHaveTextContent(fulfillment.alreadyAssigned);
    expect(within(dialog).getByRole("button", { name: fulfillment.action.assign })).toBeDisabled();
    expect(put).not.toHaveBeenCalled();
  });

  it("quản lý kho theo seed BE (không có identity-users:READ): vẫn chọn được người nhận từ /fulfillment/assignees và gán lại được", async () => {
    const user = userEvent.setup();
    const { get, put } = renderList(<PickingList />, IDENTITIES.warehouseManager, [
      apiTask({ assignedUserId: OTHER_PICKER_ID }),
    ]);

    await user.click(await screen.findByRole("button", { name: /Gán lại task/ }));
    const dialog = await screen.findByRole("dialog");
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
    expect(within(dialog).queryByText(fulfillment.noAssignTitle)).toBeNull();
    expect(get.mock.calls.some(([url]) => url === "/identity/users")).toBe(false);
    await user.click(within(dialog).getByRole("button", { name: fulfillment.action.assign }));
    await waitFor(() => expect(put).toHaveBeenCalled());
  });

  it("có quyền tạo task nhưng thiếu fulfillment-task-assignment:UPDATE: dialog báo thiếu quyền chọn người nhận, khoá nút gửi", async () => {
    const user = userEvent.setup();
    const { get } = renderList(
      <PickingList />,
      {
        permissions: IDENTITIES.warehouseManager.permissions.filter(
          (code) => code !== "fulfillment-task-assignment:UPDATE",
        ),
      },
      [],
    );

    await user.click(await screen.findByRole("button", { name: fulfillment.action.create }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(fulfillment.noAssignTitle)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: fulfillment.action.create })).toBeDisabled();
    expect(get.mock.calls.some(([url]) => url === "/fulfillment/assignees")).toBe(false);
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
      // Quản lý kho theo seed BE: không có sales-orders:READ — vẫn chọn được đơn qua task-candidates
      IDENTITIES.warehouseManager,
      {
        "/fulfillment/tasks": () => bePage([]),
        "/fulfillment/task-candidates": () => bePage([taskCandidate]),
        "/fulfillment/assignees": () => assignees,
      },
      { "/fulfillment/tasks": () => created },
    );
    renderFulfillmentScreen(<PickingList />);

    await user.click(await screen.findByRole("button", { name: fulfillment.action.create }));
    const dialog = await screen.findByRole("dialog");
    // Chưa chọn đơn → chưa biết kho → chưa gọi danh sách người nhận
    expect(spies.get.mock.calls.some(([url]) => url === "/fulfillment/assignees")).toBe(false);
    // Mỗi lựa chọn: số đơn, tên khách, số dòng / số lượng, ngày đặt, dấu "có dòng in"
    await user.click(await screen.findByRole("combobox", { name: "Đơn hàng" }));
    const option = await screen.findByRole("option", { name: /SO-20261010-000431/ });
    expect(option).toHaveTextContent("Nguyễn Hoài Nam");
    expect(option).toHaveTextContent("2 dòng · 5 sản phẩm");
    expect(option).toHaveTextContent("Đặt 9 thg 10, 2026");
    expect(option).toHaveTextContent(fulfillment.candidate.printed);
    await user.click(option);
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
    await user.click(within(dialog).getByRole("button", { name: fulfillment.action.create }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    return { ...spies, success, warning };
  }

  it("gửi đúng `CreateTaskRequest` và báo đã tạo", async () => {
    const { post, success, warning } = await createTask(apiTask());
    expect(post).toHaveBeenCalledWith("/fulfillment/tasks", {
      orderId: ORDER_ID,
      assignedUserId: assignees[0]?.userId,
    });
    expect(success).toHaveBeenCalledWith(TOAST_MESSAGES.fulfillment.created);
    expect(warning).not.toHaveBeenCalled();
  });

  it("danh sách đơn đọc từ task-candidates, không gọi GET /orders ở dialog", async () => {
    const { get } = await createTask(apiTask());
    const urls = get.mock.calls.map(([url]) => url);
    expect(urls).toContain("/fulfillment/task-candidates");
    // /orders chỉ còn dùng cho cột số đơn của danh sách (khi có sales-orders:READ) — quản lý kho thì không
    expect(urls).not.toContain("/orders");
    expect(get).toHaveBeenCalledWith(
      "/fulfillment/task-candidates",
      expect.objectContaining({ params: expect.objectContaining({ page: 0, size: 200 }) }),
    );
  });

  it("đơn đã có task (BE trả task cũ gán cho người khác, vẫn 201) → cảnh báo, không báo đã tạo", async () => {
    const { success, warning } = await createTask(apiTask({ assignedUserId: OTHER_PICKER_ID }));
    expect(warning).toHaveBeenCalledWith(TOAST_MESSAGES.fulfillment.alreadyExists);
    expect(success).not.toHaveBeenCalled();
  });
});

describe("Tạo task lấy hàng — danh sách đơn chờ xuất kho", () => {
  async function openDialog(
    candidates: () => unknown,
    identity: TestIdentity = IDENTITIES.warehouseManager,
  ) {
    const user = userEvent.setup();
    mockFulfillmentApi(identity, {
      "/fulfillment/tasks": () => bePage([]),
      "/fulfillment/assignees": () => assignees,
      "/fulfillment/task-candidates": candidates,
    });
    renderFulfillmentScreen(<PickingList />);
    await user.click(await screen.findByRole("button", { name: fulfillment.action.create }));
    return { user, dialog: await screen.findByRole("dialog") };
  }

  it("báo lỗi kèm nút Thử lại ngay trong dialog; thử lại thành công thì chọn được đơn", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let failing = true;
    const { user, dialog } = await openDialog(() => {
      if (failing) throw new ApiError(500, "INTERNAL_ERROR", "boom");
      return bePage([taskCandidate]);
    });
    expect(
      await within(dialog).findByText(/Không tải được danh sách đơn hàng chờ xuất kho/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: fulfillment.action.create })).toBeDisabled();

    failing = false;
    await user.click(within(dialog).getByRole("button", { name: UI_LABELS.common.retry }));
    expect(await within(dialog).findByRole("combobox", { name: "Đơn hàng" })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Không tải được danh sách đơn hàng/)).toBeNull();
  });

  it("403 OUT_OF_DATA_SCOPE → thông báo kho ngoài phạm vi, không có nút Thử lại", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { dialog } = await openDialog(() => {
      throw new ApiError(403, "OUT_OF_DATA_SCOPE", "outside");
    });
    expect(
      await within(dialog).findByText(FULFILLMENT_ERROR_MESSAGES.OUT_OF_DATA_SCOPE),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: UI_LABELS.common.retry })).toBeNull();
    expect(within(dialog).getByRole("button", { name: fulfillment.action.create })).toBeDisabled();
  });

  it("403 FORBIDDEN → thông báo thiếu quyền tạo task", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { dialog } = await openDialog(() => {
      throw new ApiError(403, "FORBIDDEN", "denied");
    });
    expect(
      await within(dialog).findByText(FULFILLMENT_ERROR_MESSAGES.candidatesForbidden),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: UI_LABELS.common.retry })).toBeNull();
  });

  it("không có đơn nào chờ → EmptyState, khoá nút gửi", async () => {
    const { dialog } = await openDialog(() => bePage([]));
    expect(await within(dialog).findByText(fulfillment.candidate.emptyTitle)).toBeInTheDocument();
    expect(within(dialog).queryByRole("combobox", { name: "Đơn hàng" })).toBeNull();
    expect(within(dialog).getByRole("button", { name: fulfillment.action.create })).toBeDisabled();
  });

  it("đơn dài hơn một trang → nhắc chỉ hiện đơn cũ nhất", async () => {
    const { dialog } = await openDialog(() => ({
      ...bePage([taskCandidate], 0, 200),
      totalElements: 320,
      totalPages: 2,
      hasNext: true,
    }));
    expect(
      await within(dialog).findByText(fulfillment.candidate.truncated(1, 320)),
    ).toBeInTheDocument();
  });

  it("thiếu fulfillment-task-assignment:CREATE → dialog báo thiếu quyền, không gọi task-candidates", async () => {
    const get = mockFulfillmentApi(
      {
        permissions: IDENTITIES.warehouseManager.permissions.filter(
          (code) => code !== "fulfillment-task-assignment:CREATE",
        ),
      },
      { "/fulfillment/task-candidates": () => bePage([taskCandidate]) },
    ).get;
    renderFulfillmentScreen(<CreateTaskDialog onClose={vi.fn()} />);
    expect(await screen.findByText(fulfillment.noCreateTitle)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: fulfillment.action.create })).toBeDisabled();
    expect(get.mock.calls.some(([url]) => url === "/fulfillment/task-candidates")).toBe(false);
  });
});

describe("PickingList — lọc trạng thái / kho / người được gán (URL, BE SCRUM-466)", () => {
  it("?status=PICKING&warehouse=… → gửi params; badge Trạng thái + Kho", async () => {
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseManager, [apiTask()], {
      searchParams: `?status=PICKING&warehouse=${WAREHOUSE_ID}`,
    });
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(lastListParams(get)).toMatchObject({ status: "PICKING", warehouseId: WAREHOUSE_ID });
    expect(await screen.findByText(`${FILTER.status}: Đang lấy hàng`)).toBeInTheDocument();
    expect(await screen.findByText(`${FILTER.warehouse}: Kho Hồ Chí Minh`)).toBeInTheDocument();
  });

  it("đổi kho xoá người gán và về trang 1", async () => {
    const user = userEvent.setup();
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseManager, [apiTask()], {
      searchParams: `?warehouse=${WAREHOUSE_ID}&assignee=${OTHER_PICKER_ID}&page=2`,
    });
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ assignedUserId: OTHER_PICKER_ID, page: 1 }),
    );
    await pickSelectOption(user, FILTER.warehouse, /Kho Hà Nội/);
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ warehouseId: OTHER_WAREHOUSE_ID, page: 0 }),
    );
    expect(lastListParams(get)).not.toHaveProperty("assignedUserId");
  });

  it("?assignee= mà chưa chọn kho → ô người được gán vẫn bật, hiện tên lấy từ task đang lọc, chọn Tất cả người bỏ lọc", async () => {
    const user = userEvent.setup();
    const task = apiTask({ assignedUserId: OTHER_PICKER_ID, assignedUserName: "Lê Thị Hoa" });
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseManager, [task], {
      searchParams: `?assignee=${OTHER_PICKER_ID}`,
    });
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ assignedUserId: OTHER_PICKER_ID }),
    );
    const select = screen.getByRole("combobox", { name: FILTER.assignee });
    expect(select).toBeEnabled();
    await waitFor(() => expect(select).toHaveTextContent("Lê Thị Hoa"));
    // Không lộ id người dùng ở ô chọn lẫn badge "Cấu hình"
    expect(screen.queryByText(OTHER_PICKER_ID, { exact: false })).not.toBeInTheDocument();
    await pickSelectOption(user, FILTER.assignee, FILTER.allAssignees);
    await waitFor(() => expect(lastListParams(get)).not.toHaveProperty("assignedUserId"));
  });

  it("?assignee= không kho và không còn task nào → hiện nhãn người đang lọc, không hiện id", async () => {
    renderList(<PickingList />, IDENTITIES.warehouseManager, [], {
      searchParams: `?assignee=${OTHER_PICKER_ID}`,
    });
    const select = await screen.findByRole("combobox", { name: FILTER.assignee });
    await waitFor(() => expect(select).toHaveTextContent(FILTER.filteredAssignee));
    expect(screen.queryByText(OTHER_PICKER_ID, { exact: false })).not.toBeInTheDocument();
  });

  it("NV kho không thấy lọc người được gán", async () => {
    renderList(<PickingList />, IDENTITIES.warehouseStaff);
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(screen.queryByRole("combobox", { name: FILTER.assignee })).toBeNull();
  });

  it("quản lý kho: lọc người được gán khoá tới khi chọn kho, rồi lấy danh sách theo kho", async () => {
    const user = userEvent.setup();
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseManager);
    expect(await screen.findByRole("combobox", { name: FILTER.assignee })).toBeDisabled();
    await pickSelectOption(user, FILTER.warehouse, /Kho Hồ Chí Minh/);
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: FILTER.assignee })).toBeEnabled(),
    );
    await pickSelectOption(user, FILTER.assignee, assignees[0]?.displayName ?? "");
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ assignedUserId: assignees[0]?.userId }),
    );
    expect(get.mock.calls.some(([url]) => url === "/fulfillment/assignees")).toBe(true);
  });

  it("lọc ra 0 dòng → 'Không có task khớp bộ lọc' + Bỏ lọc, khác trạng thái chưa có task", async () => {
    const user = userEvent.setup();
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseManager, [], {
      searchParams: "?status=PICKED",
    });
    expect(await screen.findByText(FILTER.noMatchTitle)).toBeInTheDocument();
    expect(screen.queryByText("Chưa có task xuất kho")).toBeNull();
    await user.click(screen.getByRole("button", { name: FILTER.clear }));
    await waitFor(() => expect(lastListParams(get)).not.toHaveProperty("status"));
  });

  it("?status=FOO → coi như không lọc", async () => {
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseManager, [apiTask()], {
      searchParams: "?status=FOO",
    });
    await screen.findByRole("link", { name: "3F4A5B6C" });
    expect(lastListParams(get)).not.toHaveProperty("status");
    expect(screen.queryByText(new RegExp(`^${FILTER.status}: `))).toBeNull();
  });

  it("lọc kho ngoài phạm vi → 403 OUT_OF_DATA_SCOPE: câu báo + Bỏ lọc kho", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const { get } = renderList(<PickingList />, IDENTITIES.warehouseManager, [], {
      searchParams: `?warehouse=${OTHER_WAREHOUSE_ID}`,
      list: (params) => {
        if ((params as { warehouseId?: string }).warehouseId) {
          throw new ApiError(403, "OUT_OF_DATA_SCOPE", "Not authorised for this data");
        }
        return bePage([apiTask()]);
      },
    });
    expect(await screen.findByText(FILTER.outOfScope)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: FILTER.clearWarehouse }));
    expect(await screen.findByRole("link", { name: "3F4A5B6C" })).toBeInTheDocument();
    expect(lastListParams(get)).not.toHaveProperty("warehouseId");
  });
});
