/**
 * Task đích STAGING (docs 07 §4.2 bước 5–6, §4.3 bước 8, BR-11): quét xác nhận đưa thùng về khu chờ xuất (dòng Staged,
 * chưa trừ tồn), hoàn tất lấy hàng → task Staged, rồi quản lý kho chuyển CẢ task sang khu xuất hàng
 * (`POST …/dispatch-transfer`, quyền `fulfillment-task-assignment:UPDATE`) — đơn đang treo thì BE từ chối.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES, PICK_LINE_LABELS as L, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { LPN_1, PICK_LINE_1, apiPickLines } from "../__fixtures__/pick-lines";
import { linePath, renderPickingDetail } from "../__fixtures__/picking-detail";
import { IDENTITIES, pickInputComboboxOption } from "../__fixtures__/render";
import { OTHER_PICKER_ID, TASK_ID, apiTask, stagedTask } from "../__fixtures__/task";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const { action, noActions, destination: D } = UI_LABELS.fulfillment;
const PATH = `/fulfillment/tasks/${TASK_ID}`;
const stagingPicking = () =>
  apiTask({ pickStatus: "PICKING", destination: "STAGING", stagingLocationCode: "HN-STAGE-01" });
/** Mọi dòng đã về khu chờ xuất. */
const stagedLines = () =>
  apiPickLines().map((line) => ({
    ...line,
    status: "STAGED" as const,
    pickedQty: line.allocatedQty,
    stagedLocationCode: "HN-STAGE-01",
  }));

describe("Task đích STAGING — lấy hàng về khu chờ xuất", () => {
  it("quét vị trí + LPN → POST confirmation như DISPATCH; BE trả dòng STAGED nên bảng hiện thùng ở khu chờ xuất, tiến độ tính là đã lấy", async () => {
    const user = userEvent.setup();
    const { post } = renderPickingDetail(IDENTITIES.warehouseStaff, stagingPicking());
    await screen.findByText(L.confirmTitle(1));
    await pickInputComboboxOption(user, L.location, "HN-A01-01-01-A");
    await user.type(screen.getByLabelText(L.lpn), `${LPN_1}{Enter}`);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        linePath(PICK_LINE_1, "confirmation"),
        { locationCode: "HN-A01-01-01-A", lpn: LPN_1 },
        { headers: { "Idempotency-Key": expect.any(String) } },
      ),
    );
    expect(await screen.findByText(L.stagedAt("HN-STAGE-01"))).toBeInTheDocument();
    expect(screen.getByText(L.progress(1, 3))).toBeInTheDocument();
  });

  it("đủ dòng Staged → Hoàn tất lấy hàng được (không đòi Picked) → POST picking-completion; task thành Staged", async () => {
    const user = userEvent.setup();
    const { post } = renderPickingDetail(IDENTITIES.warehouseStaff, stagingPicking(), {
      lines: stagedLines(),
    });
    await user.click(await screen.findByRole("button", { name: action.completePicking }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: action.completePicking,
      }),
    );
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/picking-completion`, undefined));
    // Sau khi tải lại: task Staged, hết thao tác của người lấy hàng; câu chờ quản lý kho chuyển
    expect(await screen.findByText(noActions.waitingDispatch)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
  });

  it("thông tin task nói đích STAGING, khu chờ xuất và mốc về khu", async () => {
    renderPickingDetail(IDENTITIES.warehouseStaff, stagedTask(), { lines: stagedLines() });
    const info = (await screen.findByText("Thông tin task")).closest("section") as HTMLElement;
    // "Khu chờ xuất" vừa là tên đích vừa là nhãn ô khu chờ xuất của task
    expect(within(info).getByText(UI_LABELS.fulfillment.field.destination)).toBeInTheDocument();
    expect(within(info).getAllByText(D.STAGING)).toHaveLength(2);
    expect(within(info).getByText("HN-STAGE-01")).toBeInTheDocument();
    expect(within(info).getByText(UI_LABELS.fulfillment.field.stagedAt)).toBeInTheDocument();
  });

  it("task DISPATCH: thông tin task nói khu xuất hàng, không có khu chờ xuất", async () => {
    renderPickingDetail(IDENTITIES.warehouseStaff, apiTask());
    const info = (await screen.findByText("Thông tin task")).closest("section") as HTMLElement;
    expect(within(info).getByText(D.DISPATCH)).toBeInTheDocument();
    expect(within(info).queryByText(UI_LABELS.fulfillment.field.stagingLocation)).toBeNull();
  });
});

describe("Chuyển cả task sang khu xuất hàng — action-gating (docs 07 §4.3 bước 8)", () => {
  it("quản lý kho (task-assignment:UPDATE), task Staged → nút; ConfirmDialog nói trừ tồn không hoàn lại → POST dispatch-transfer KHÔNG body", async () => {
    const user = userEvent.setup();
    const { post } = renderPickingDetail(
      IDENTITIES.warehouseManager,
      stagedTask({ assignedUserId: OTHER_PICKER_ID }),
      { lines: stagedLines() },
    );
    await user.click(await screen.findByRole("button", { name: action.moveToDispatch }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/trừ/);
    expect(dialog).toHaveTextContent(/không hoàn lại được/);
    await user.click(within(dialog).getByRole("button", { name: action.moveToDispatch }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/dispatch-transfer`, undefined));
    // Task → Picked: không còn nút chuyển
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: action.moveToDispatch })).toBeNull(),
    );
  });

  it("NV kho (không có task-assignment:UPDATE) kể cả là người được gán → không có nút, có câu chờ quản lý kho", async () => {
    renderPickingDetail(IDENTITIES.warehouseStaff, stagedTask(), { lines: stagedLines() });
    expect(await screen.findByText(noActions.waitingDispatch)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.moveToDispatch })).toBeNull();
  });

  it("task chưa Staged (Pending / Picking / Picked / Cancelled) → quản lý kho không thấy nút chuyển", async () => {
    for (const task of [
      apiTask({ assignedUserId: OTHER_PICKER_ID }),
      apiTask({ pickStatus: "PICKING", assignedUserId: OTHER_PICKER_ID }),
      apiTask({ pickStatus: "PICKED", assignedUserId: OTHER_PICKER_ID }),
      apiTask({ pickStatus: "CANCELLED", packStatus: "CANCELLED" }),
    ]) {
      const view = renderPickingDetail(IDENTITIES.warehouseManager, task);
      await screen.findByText("Thông tin task");
      expect(screen.queryByRole("button", { name: action.moveToDispatch })).toBeNull();
      expect(view.post).not.toHaveBeenCalled();
      document.body.innerHTML = "";
      vi.restoreAllMocks();
    }
  });

  it("đơn đang treo → BE 409 PICK_ORDER_ON_HOLD: toast nêu rõ thùng vẫn ở khu chờ xuất, task vẫn Staged, nút còn", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    renderPickingDetail(
      IDENTITIES.warehouseManager,
      stagedTask({ assignedUserId: OTHER_PICKER_ID }),
      {
        lines: stagedLines(),
        dispatch: () => {
          throw new ApiError(409, "PICK_ORDER_ON_HOLD", "Order SO-1 is on hold; task stays staged");
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
      expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.PICK_ORDER_ON_HOLD),
    );
    expect(FULFILLMENT_ERROR_MESSAGES.PICK_ORDER_ON_HOLD).toMatch(/khu chờ xuất/);
    expect(FULFILLMENT_ERROR_MESSAGES.PICK_ORDER_ON_HOLD).not.toContain("English");
    expect(await screen.findByRole("button", { name: action.moveToDispatch })).toBeInTheDocument();
  });

  it("409 PICK_TASK_STATE_CONFLICT (task đã đổi ở nơi khác) → câu 'không còn ở trạng thái Đã tập kết', tải lại task", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const { get } = renderPickingDetail(
      IDENTITIES.warehouseManager,
      stagedTask({ assignedUserId: OTHER_PICKER_ID }),
      {
        lines: stagedLines(),
        dispatch: () => {
          throw new ApiError(409, "PICK_TASK_STATE_CONFLICT", "x");
        },
      },
    );
    await screen.findByRole("button", { name: action.moveToDispatch });
    const reads = () => get.mock.calls.filter(([url]) => url === PATH).length;
    const before = reads();
    await user.click(screen.getByRole("button", { name: action.moveToDispatch }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: action.moveToDispatch,
      }),
    );
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(FULFILLMENT_ERROR_MESSAGES.dispatchConflict),
    );
    await waitFor(() => expect(reads()).toBeGreaterThan(before));
  });
});
