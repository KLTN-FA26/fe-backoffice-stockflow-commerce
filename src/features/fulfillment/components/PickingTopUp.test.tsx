/**
 * Lấy bổ sung (docs 07 §4.3 bước 7, §6 edge "phần hàng còn thiếu đã nhập kho xuất, đơn đang có task Staged"): thùng
 * còn thiếu đã về kho được quản lý kho thêm vào CÙNG task (`POST …/top-up`, quyền `fulfillment-task-assignment:UPDATE`)
 * — chỉ khi BE báo còn thùng đã giữ chưa có dòng (`topUpAvailable` ở `GET /tasks/{id}`); task `Staged` / `Picked`
 * quay lại `Picking`. Chuyển sang khu xuất hàng khi đơn còn chờ hàng → BE 409 PICK_AWAITING_STOCK_NOT_READY.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { apiPickLines } from "../__fixtures__/pick-lines";
import { TASK_PATH, renderPickingDetail } from "../__fixtures__/picking-detail";
import { IDENTITIES, mockFulfillmentApi, renderFulfillmentScreen } from "../__fixtures__/render";
import {
  OTHER_PICKER_ID,
  PICKER_ID,
  TASK_ID,
  WAREHOUSE_ID,
  bePage,
  pickedTask,
  stagedTask,
} from "../__fixtures__/task";
import { PickingDetail } from "./PickingDetail";

import type { FulfillmentTaskApiDto, PickLineApiDto } from "../types";
import type { RouteHandler, TestIdentity } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const { action } = UI_LABELS.fulfillment;

const stagedLines = () =>
  apiPickLines().map((line) => ({
    ...line,
    status: "STAGED" as const,
    pickedQty: line.allocatedQty,
    stagedLocationCode: "HN-STAGE-01",
  }));

/** Màn chi tiết lấy hàng; `top-up` thêm một dòng mới và đưa task về PICKING như BE (hoặc theo `topUp`). */
function renderTask(identity: TestIdentity, initial: FulfillmentTaskApiDto, topUp?: RouteHandler) {
  let task = initial;
  let lines: PickLineApiDto[] = stagedLines();
  const [first] = apiPickLines();
  const fresh: PickLineApiDto[] = first
    ? [{ ...first, lineId: "line-top-up", sequenceNo: 9, status: "OPEN" }]
    : [];
  const spies = mockFulfillmentApi(
    identity,
    {
      [TASK_PATH]: () => task,
      [`${TASK_PATH}/pick-lines`]: () => bePage(lines, 0, 200),
      [`/warehouses/${WAREHOUSE_ID}/layout`]: () => ({ shelves: [], areas: [] }),
    },
    {
      [`${TASK_PATH}/top-up`]:
        topUp ??
        (() => {
          task = { ...task, pickStatus: "PICKING", topUpAvailable: false };
          lines = [...lines, ...fresh];
          return fresh;
        }),
    },
  );
  renderFulfillmentScreen(<PickingDetail id={TASK_ID} />, PICKER_ID);
  return spies;
}

describe("Lấy bổ sung — action-gating (docs 07 §4.3 bước 7)", () => {
  it("quản lý kho, task Staged còn thùng đã giữ chưa có dòng → nút; xác nhận → POST top-up không body; task quay lại Picking", async () => {
    const user = userEvent.setup();
    const { post } = renderTask(
      IDENTITIES.warehouseManager,
      stagedTask({ assignedUserId: OTHER_PICKER_ID, topUpAvailable: true }),
    );
    await user.click(await screen.findByRole("button", { name: action.topUp }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/cùng task/);
    await user.click(within(dialog).getByRole("button", { name: action.topUp }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${TASK_PATH}/top-up`));
    await waitFor(() => expect(screen.queryByRole("button", { name: action.topUp })).toBeNull());
  });

  it("task Picked (đã giao trước một phần) còn thùng đã giữ → quản lý kho cũng thấy nút", async () => {
    renderTask(
      IDENTITIES.warehouseManager,
      pickedTask({ assignedUserId: OTHER_PICKER_ID, topUpAvailable: true }),
    );
    expect(await screen.findByRole("button", { name: action.topUp })).toBeInTheDocument();
  });

  it("không còn thùng nào chưa có dòng (topUpAvailable false / vắng) → không có nút", async () => {
    renderTask(IDENTITIES.warehouseManager, stagedTask({ assignedUserId: OTHER_PICKER_ID }));
    expect(await screen.findByRole("button", { name: action.moveToDispatch })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.topUp })).toBeNull();
  });

  it("NV kho (không có task-assignment:UPDATE) → không có nút dù còn thùng", async () => {
    renderTask(IDENTITIES.warehouseStaff, stagedTask({ topUpAvailable: true }));
    expect(
      await screen.findByText(UI_LABELS.fulfillment.noActions.waitingDispatch),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.topUp })).toBeNull();
  });

  it("BE 409 (task đã huỷ / đã hoàn tất kiểm thùng) → câu tiếng Việt, không lộ message tiếng Anh", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    renderTask(
      IDENTITIES.warehouseManager,
      stagedTask({ assignedUserId: OTHER_PICKER_ID, topUpAvailable: true }),
      () => {
        throw new ApiError(409, "PICK_TASK_STATE_CONFLICT", "English");
      },
    );
    await user.click(await screen.findByRole("button", { name: action.topUp }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: action.topUp }),
    );
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.topUpConflict),
    );
  });
});

describe("Chuyển sang khu xuất hàng khi đơn còn chờ hàng (docs 07 §4.3 bước 8)", () => {
  it("BE 409 PICK_AWAITING_STOCK_NOT_READY → câu tiếng Việt: thùng ở lại khu chờ xuất", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error");
    renderPickingDetail(
      IDENTITIES.warehouseManager,
      stagedTask({ assignedUserId: OTHER_PICKER_ID }),
      {
        lines: stagedLines(),
        dispatch: () => {
          throw new ApiError(409, "PICK_AWAITING_STOCK_NOT_READY", "English");
        },
      },
    );
    await user.click(await screen.findByRole("button", { name: action.moveToDispatch }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: action.moveToDispatch,
      }),
    );
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.PICK_AWAITING_STOCK_NOT_READY),
    );
  });
});
