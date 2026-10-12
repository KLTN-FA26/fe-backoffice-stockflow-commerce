import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "../__fixtures__/render";
import {
  ORDER_ID,
  OTHER_PICKER_ID,
  PICKER_ID,
  TASK_ID,
  apiTask,
  assignableUsers,
  bePage,
  fulfillmentOrder,
  pickedTask,
} from "../__fixtures__/task";
import { PickingDetail } from "./PickingDetail";

import type { TestIdentity } from "../__fixtures__/render";
import type { FulfillmentTaskApiDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const { fulfillment } = UI_LABELS;
const { action, noActions } = fulfillment;
const PATH = `/fulfillment/tasks/${TASK_ID}`;

function renderDetail(
  identity: TestIdentity,
  initial: FulfillmentTaskApiDto,
  userId: string = PICKER_ID,
) {
  // Task "trên server" — POST đổi nó, GET sau invalidate đọc lại
  let task = initial;
  const spies = mockFulfillmentApi(
    identity,
    {
      [PATH]: () => task,
      [`/orders/${ORDER_ID}`]: () => fulfillmentOrder,
      "/orders": () => bePage([fulfillmentOrder]),
      "/identity/users": () => bePage(assignableUsers),
    },
    {
      [`${PATH}/picking-start`]: () => (task = { ...task, pickStatus: "PICKING" }),
      [`${PATH}/picking-completion`]: () => (task = { ...task, pickStatus: "PICKED" }),
    },
  );
  renderFulfillmentScreen(<PickingDetail id={TASK_ID} />, userId);
  return spies;
}

describe("PickingDetail — action-gating theo trạng thái + quyền + vai trò + người được gán", () => {
  it("NV kho được gán, Pending: Bắt đầu lấy hàng → xác nhận → POST picking-start không body", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, apiTask());

    await user.click(await screen.findByRole("button", { name: action.startPicking }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: action.startPicking }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/picking-start`, undefined));
    // Sau khi tải lại: sang bước hoàn tất, không còn nút bắt đầu
    expect(await screen.findByRole("button", { name: action.completePicking })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.startPicking })).toBeNull();
    // NV kho không được gán lại
    expect(screen.queryByRole("button", { name: action.assign })).toBeNull();
  });

  it("Picking: Hoàn tất lấy hàng → POST picking-completion", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, apiTask({ pickStatus: "PICKING" }));

    await user.click(await screen.findByRole("button", { name: action.completePicking }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: action.completePicking,
      }),
    );
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/picking-completion`, undefined));
    expect(await screen.findByText(/không còn thao tác lấy hàng/)).toBeInTheDocument();
  });

  it("quản lý kho không được gán: chỉ Gán lại, không lấy hàng hộ", async () => {
    renderDetail(IDENTITIES.warehouseManager, apiTask({ assignedUserId: OTHER_PICKER_ID }));
    expect(await screen.findByRole("button", { name: action.assign })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.startPicking })).toBeNull();
  });

  it("quản lý kho không được gán, task đang lấy hàng → giải thích chỉ người được gán thao tác", async () => {
    renderDetail(
      IDENTITIES.warehouseManager,
      apiTask({ assignedUserId: OTHER_PICKER_ID, pickStatus: "PICKING" }),
    );
    expect(await screen.findByText(noActions.notAssignee)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
    expect(screen.queryByRole("button", { name: action.assign })).toBeNull();
  });

  it("điều phối đơn: Gán lại khi Pending, không có nút lấy hàng", async () => {
    renderDetail(IDENTITIES.orderCoordinator, apiTask(), "coordinator-id");
    expect(await screen.findByRole("button", { name: action.assign })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.startPicking })).toBeNull();
    // Có sales-orders:READ → thấy dòng đơn
    expect(await screen.findByText("TEE-BLK-M")).toBeInTheDocument();
  });

  it("task đã huỷ → không render nút mutating nào", async () => {
    renderDetail(
      IDENTITIES.warehouseManager,
      apiTask({ pickStatus: "CANCELLED", packStatus: "CANCELLED" }),
    );
    expect(await screen.findByText(/không còn thao tác\./)).toBeInTheDocument();
    for (const label of [action.assign, action.startPicking, action.completePicking]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("đã lấy xong: không còn thao tác lấy hàng, có lối sang trạm đóng gói", async () => {
    renderDetail(IDENTITIES.warehouseStaff, pickedTask());
    expect(
      await screen.findByRole("link", { name: new RegExp(action.openPacking) }),
    ).toHaveAttribute("href", `/admin/packing/${TASK_ID}`);
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
  });
});

describe("PickingDetail — dữ liệu phụ trợ và lỗi", () => {
  it("NV kho theo seed BE (thiếu sales-orders:READ) → báo thiếu quyền thay cho bảng dòng, không gọi /orders", async () => {
    const { get } = renderDetail(IDENTITIES.warehouseStaff, apiTask());
    expect(await screen.findByText(fulfillment.noOrderReadTitle)).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/orders"))).toBe(false);
  });

  it("có quyền đọc đơn → bảng dòng đơn: SKU, SL, đánh dấu dòng tuỳ chỉnh", async () => {
    renderDetail(IDENTITIES.staffWithOrders, apiTask());
    const table = await screen.findByRole("table", { name: /Dòng của đơn SO-20261010-000431/ });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(within(rows[1] as HTMLElement).getByText("TEE-BLK-M")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText(/Tuỳ chỉnh/)).toBeInTheDocument();
  });

  it("BE trả 404 (task không được gán cho người gọi) → màn không tìm thấy, không có nút thử lại", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const spies = mockFulfillmentApi(IDENTITIES.warehouseStaff, {
      [PATH]: () => {
        throw new ApiError(404, "NOT_FOUND", "Resource not found");
      },
    });
    renderFulfillmentScreen(<PickingDetail id={TASK_ID} />);
    expect(await screen.findByText(fulfillment.notFoundTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: UI_LABELS.common.retry })).toBeNull();
    expect(spies.post).not.toHaveBeenCalled();
  });

  it("BE trả 403 khi đọc đơn hàng → báo thiếu quyền xem đơn, không phải lỗi tải chung", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFulfillmentApi(IDENTITIES.staffWithOrders, {
      [PATH]: () => apiTask(),
      "/orders": () => bePage([]),
      [`/orders/${ORDER_ID}`]: () => {
        throw new ApiError(403, "FORBIDDEN", "Access denied");
      },
    });
    renderFulfillmentScreen(<PickingDetail id={TASK_ID} />);
    expect(await screen.findByText(fulfillment.noOrderReadTitle)).toBeInTheDocument();
    expect(screen.queryByText(UI_LABELS.loadError.serverTitle)).toBeNull();
    // Task vẫn dùng được bình thường
    expect(screen.getByRole("button", { name: action.startPicking })).toBeInTheDocument();
  });

  it("BE PICKED hiện đúng tên BE (Picked → Đã lấy), không đổi sang tên docs", async () => {
    renderDetail(IDENTITIES.warehouseStaff, pickedTask());
    expect(await screen.findByText("Đã lấy")).toBeInTheDocument();
    expect(screen.queryByText("Hoàn tất")).toBeNull();
  });

  it("lỗi 409 khi bắt đầu (task đã đổi ở nơi khác) → đóng dialog, tải lại task", async () => {
    const user = userEvent.setup();
    const spies = mockFulfillmentApi(
      IDENTITIES.warehouseStaff,
      { [PATH]: () => apiTask() },
      {
        [`${PATH}/picking-start`]: () => {
          throw new ApiError(409, "CONFLICT", "Conflicting state");
        },
      },
    );
    renderFulfillmentScreen(<PickingDetail id={TASK_ID} />);
    await user.click(await screen.findByRole("button", { name: action.startPicking }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: action.startPicking }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const detailCalls = () => spies.get.mock.calls.filter(([url]) => url === PATH).length;
    await waitFor(() => expect(detailCalls()).toBeGreaterThan(1));
  });
});
