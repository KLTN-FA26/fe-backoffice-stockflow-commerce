import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FULFILLMENT_FIELD_MESSAGES as MSG_FIELD,
  PICK_LINE_ERROR_MESSAGES as LE,
  PICK_LINE_LABELS as L,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { LPN_1, LPN_2, PICK_LINE_1, apiPickLines } from "../__fixtures__/pick-lines";
import { linePath, renderPickingDetail as renderDetail } from "../__fixtures__/picking-detail";
import {
  IDENTITIES,
  mockFulfillmentApi,
  pickInputComboboxOption,
  renderFulfillmentScreen,
} from "../__fixtures__/render";
import { OTHER_PICKER_ID, TASK_ID, apiTask, apiTaskLines, pickedTask } from "../__fixtures__/task";
import { PickingDetail } from "./PickingDetail";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const { fulfillment } = UI_LABELS;
const { action, noActions } = fulfillment;
const PATH = `/fulfillment/tasks/${TASK_ID}`;

const confirmPath = (lineId: string) => linePath(lineId, "confirmation");
/** Dòng lấy hàng theo trạng thái (cùng thứ tự fixture) — PICKED thì đủ SL. */
const linesWith = (statuses: ("OPEN" | "STAGED" | "PICKED" | "SHORT" | "CANCELLED")[]) =>
  apiPickLines().map((line, index) => {
    const status = statuses[index] ?? line.status;
    return {
      ...line,
      status,
      pickedQty: status === "PICKED" || status === "STAGED" ? line.allocatedQty : 0,
      shortQty: status === "SHORT" || status === "CANCELLED" ? line.allocatedQty : 0,
    };
  });

describe("PickingDetail — action-gating theo trạng thái + quyền + vai trò + người được gán", () => {
  it("NV kho được gán, Pending: Bắt đầu lấy hàng → xác nhận → POST picking-start không body", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, apiTask());

    await user.click(await screen.findByRole("button", { name: action.startPicking }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: action.startPicking }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/picking-start`, undefined));
    // Sau khi tải lại: sang bước xác nhận dòng; chưa đủ dòng nên chưa có Hoàn tất
    expect(await screen.findByText(L.confirmTitle(1))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.startPicking })).toBeNull();
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
    // NV kho không được gán lại
    expect(screen.queryByRole("button", { name: action.assign })).toBeNull();
  });

  it("đủ dòng PICKED/CANCELLED → Hoàn tất, ConfirmDialog → POST picking-completion", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, apiTask({ pickStatus: "PICKING" }), {
      lines: linesWith(["PICKED", "CANCELLED", "PICKED"]),
    });

    await user.click(await screen.findByRole("button", { name: action.completePicking }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: action.completePicking,
      }),
    );
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/picking-completion`, undefined));
    expect(await screen.findByText(/không còn thao tác lấy hàng/)).toBeInTheDocument();
  });

  it("còn dòng chưa lấy → không có nút Hoàn tất, câu 'Còn n dòng chưa lấy'", async () => {
    renderDetail(IDENTITIES.warehouseStaff, apiTask({ pickStatus: "PICKING" }), {
      lines: linesWith(["PICKED", "OPEN", "OPEN"]),
    });
    expect(await screen.findByText(L.openLeft(2))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
    expect(screen.queryByText(L.allPicked)).toBeNull();
  });

  it("không tải được dòng lấy hàng → không có Hoàn tất, thẻ thao tác nói lý do (không phải 'chỉ xem')", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderDetail(IDENTITIES.warehouseStaff, apiTask({ pickStatus: "PICKING" }), {
      pickLines: () => {
        throw new ApiError(503, "SERVICE_UNAVAILABLE", "down");
      },
    });
    expect(await screen.findByText(L.linesUnavailable)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
    expect(screen.queryByText(noActions.viewOnly)).toBeNull();
  });

  it("task đang lấy mà chưa có dòng (mở trước khi có lấy hàng theo dòng) → báo chưa lập dòng, không có Hoàn tất; người được gán bấm Tạo danh sách dòng → POST picking-start", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(
      IDENTITIES.warehouseStaff,
      apiTask({ pickStatus: "PICKING", lines: apiTaskLines }),
      { lines: [] },
    );
    expect(await screen.findByText(L.linesNotPlanned)).toBeInTheDocument();
    expect(screen.queryByText(L.noLines)).toBeNull();
    expect(screen.getByText(L.planLinesFirst)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
    await user.click(screen.getByRole("button", { name: L.planLines }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/picking-start`, undefined));
  });

  it("task đang lấy chưa có dòng, người xem không được gán → chỉ báo, không có nút tạo danh sách", async () => {
    renderDetail(
      IDENTITIES.warehouseManager,
      apiTask({ pickStatus: "PICKING", lines: apiTaskLines, assignedUserId: OTHER_PICKER_ID }),
      { lines: [] },
    );
    expect(await screen.findByText(L.linesNotPlanned)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.planLines })).toBeNull();
  });

  it("task đang lấy, đơn không còn dòng hàng sẵn để lấy → câu 'chưa có dòng lấy hàng nào' và vẫn hoàn tất được", async () => {
    renderDetail(
      IDENTITIES.warehouseStaff,
      apiTask({
        pickStatus: "PICKING",
        lines: apiTaskLines.filter((line) => line.printLine),
      }),
      { lines: [] },
    );
    expect(await screen.findByText(L.noLines)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: action.completePicking })).toBeInTheDocument();
  });

  it("còn dòng thiếu → câu 'Còn n dòng thiếu hàng chờ phân bổ lại'", async () => {
    renderDetail(IDENTITIES.warehouseStaff, apiTask({ pickStatus: "PICKING" }), {
      lines: linesWith(["PICKED", "SHORT", "PICKED"]),
    });
    expect(await screen.findByText(L.shortLeft(1))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.completePicking })).toBeNull();
    expect(screen.queryByText(L.allPicked)).toBeNull();
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
    renderDetail(
      IDENTITIES.orderCoordinator,
      { ...apiTask(), lines: apiTaskLines },
      "coordinator-id",
    );
    expect(await screen.findByRole("button", { name: action.assign })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: action.startPicking })).toBeNull();
    // Dòng hàng đi kèm task (SCRUM-466) — không phụ thuộc quyền đọc đơn
    const orderLines = await screen.findByRole("table", { name: /Dòng hàng của task/ });
    expect(within(orderLines).getByText("TEE-BLK-M")).toBeInTheDocument();
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
  it("dòng hàng lấy từ task, không gọi /orders", async () => {
    const { get } = renderDetail(IDENTITIES.warehouseStaff, {
      ...apiTask(),
      lines: apiTaskLines,
    });
    const table = await screen.findByRole("table", { name: /Dòng hàng của task/ });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(within(rows[1] as HTMLElement).getByText("TEE-BLK-M")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("3")).toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText("MUG-WHT-11")).toBeInTheDocument();
    expect(
      within(rows[3] as HTMLElement).getByText(/Tuỳ chỉnh · có thiết kế đã khoá/),
    ).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/orders"))).toBe(false);
  });

  it("task chưa kèm dòng → câu 'Task chưa có dòng hàng.'", async () => {
    renderDetail(IDENTITIES.warehouseStaff, apiTask());
    expect(await screen.findByText(fulfillment.noTaskLines)).toBeInTheDocument();
  });

  it("số đơn ở ô Đơn hàng của Thông tin task lấy từ task", async () => {
    renderDetail(IDENTITIES.warehouseStaff, apiTask({ orderNumber: "SO-20261010-000431" }));
    expect(await screen.findByText("SO-20261010-000431")).toBeInTheDocument();
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

describe("PickingDetail — xác nhận dòng lấy hàng: quét vị trí + LPN của thùng (docs 07 §4.2, BR-04, BR-10)", () => {
  const picking = () => apiTask({ pickStatus: "PICKING" });
  const keyOf = (call: unknown[]) =>
    (call[2] as { headers?: Record<string, string> } | undefined)?.headers?.["Idempotency-Key"];
  const apiError = (code: string, status = 409) => new ApiError(status, code, "x");
  const confirmCalls = (post: ReturnType<typeof mockFulfillmentApi>["post"]) =>
    post.mock.calls.filter(([url]) => url === confirmPath(PICK_LINE_1));

  async function fillAndSubmit(
    user: ReturnType<typeof userEvent.setup>,
    location: string,
    lpn: string,
  ) {
    await pickInputComboboxOption(user, L.location, location);
    const input = screen.getByLabelText(L.lpn);
    await user.clear(input);
    await user.type(input, `${lpn}{Enter}`);
  }

  it("thẻ xác nhận nói rõ bin cần đến và LPN cần lấy; KHÔNG có ô số lượng / mã hàng", async () => {
    renderDetail(IDENTITIES.warehouseStaff, picking());
    const card = (await screen.findByText(L.confirmTitle(1))).closest("section") as HTMLElement;
    expect(within(card).getByText(L.targetLocation)).toBeInTheDocument();
    expect(within(card).getByText("HN-A01-01-01-A")).toBeInTheDocument();
    expect(within(card).getByText(L.targetLpn)).toBeInTheDocument();
    expect(within(card).getByText(LPN_1)).toBeInTheDocument();
    expect(within(card).queryByLabelText("Số lượng")).toBeNull();
    expect(within(card).queryByLabelText("Mã hàng")).toBeNull();
  });

  it("bảng dòng có cột LPN, sắp theo mã vị trí rồi SKU", async () => {
    renderDetail(IDENTITIES.warehouseStaff, picking());
    const table = await screen.findByRole("table", { name: L.sectionTitle });
    expect(within(table).getByRole("columnheader", { name: L.column.lpn })).toBeInTheDocument();
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[1]?.textContent)).toEqual([
      "HN-A01-01-01-A",
      "HN-A01-01-02-A",
      "HN-A02-02-01-B",
    ]);
    expect(within(rows[0] as HTMLElement).getByText(LPN_1)).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText(LPN_2)).toBeInTheDocument();
  });

  it("người được gán: chọn vị trí qua combobox, quét LPN → POST confirmation {locationCode, lpn} + Idempotency-Key", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, picking());
    expect(await screen.findByText(L.confirmTitle(1))).toBeInTheDocument();
    await fillAndSubmit(user, "HN-A01-01-01-A", LPN_1);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        confirmPath(PICK_LINE_1),
        { locationCode: "HN-A01-01-01-A", lpn: LPN_1 },
        { headers: { "Idempotency-Key": expect.any(String) } },
      ),
    );
    expect(await screen.findByText(L.done(1))).toBeInTheDocument();
    expect(await screen.findByText(L.confirmTitle(2))).toBeInTheDocument();
  });

  it("409 PICK_LOCATION_MISMATCH → lỗi dưới ô Vị trí nêu bin ĐÚNG của dòng, giữ ô LPN", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, picking(), {
      confirm: () => {
        throw apiError("PICK_LOCATION_MISMATCH");
      },
    });
    await screen.findByText(L.confirmTitle(1));
    await fillAndSubmit(user, "HN-STAGE-01", LPN_1);
    expect(await screen.findByText(LE.locationMismatch("HN-A01-01-01-A"))).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: L.location })).toHaveValue("");
    expect(screen.getByLabelText(L.lpn)).toHaveValue(LPN_1);
    // Quét lại vị trí phải rơi vào ô Vị trí, không phải ô LPN vừa Enter
    expect(screen.getByRole("combobox", { name: L.location })).toHaveFocus();
    expect(confirmCalls(post)).toHaveLength(1);
  });

  it("409 PICK_ITEM_MISMATCH (quét SKU / LPN của đơn khác) → lỗi dưới ô LPN nêu LPN ĐÚNG của dòng, xoá ô để quét lại", async () => {
    const user = userEvent.setup();
    renderDetail(IDENTITIES.warehouseStaff, picking(), {
      confirm: () => {
        throw apiError("PICK_ITEM_MISMATCH");
      },
    });
    await screen.findByText(L.confirmTitle(1));
    await fillAndSubmit(user, "HN-A01-01-01-A", "LPN-OF-ANOTHER-ORDER");
    expect(await screen.findByText(LE.itemMismatch(LPN_1))).toBeInTheDocument();
    expect(screen.getByLabelText(L.lpn)).toHaveFocus();
    expect(screen.getByLabelText(L.lpn)).toHaveValue("");
  });

  it("LPN trống → FE bắt nhập, không gọi BE", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, picking());
    await screen.findByText(L.confirmTitle(1));
    await pickInputComboboxOption(user, L.location, "HN-A01-01-01-A");
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(await screen.findByText(MSG_FIELD.lpnRequired)).toBeInTheDocument();
    expect(confirmCalls(post)).toHaveLength(0);
  });

  it("bấm gửi hai lần khi đang chờ → chỉ một POST", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, picking(), {
      confirm: () => new Promise(() => {}),
    });
    await screen.findByText(L.confirmTitle(1));
    await fillAndSubmit(user, "HN-A01-01-01-A", LPN_1);
    await user.click(screen.getByRole("button", { name: L.submit }));
    await user.type(screen.getByLabelText(L.lpn), "{Enter}");
    expect(confirmCalls(post)).toHaveLength(1);
  });

  it("lỗi mạng rồi gửi lại cùng nội dung → cùng Idempotency-Key; sửa LPN → key mới", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, picking(), {
      confirm: () => {
        throw new ApiError(0, "NETWORK_ERROR", "offline");
      },
    });
    await screen.findByText(L.confirmTitle(1));
    await fillAndSubmit(user, "HN-A01-01-01-A", LPN_1);
    expect(await screen.findByText(LE.network)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: L.submit }));
    const input = screen.getByLabelText(L.lpn);
    await user.clear(input);
    await user.type(input, `${LPN_2}{Enter}`);
    await waitFor(() => expect(confirmCalls(post)).toHaveLength(3));
    const calls = confirmCalls(post);
    expect(keyOf(calls[1] as unknown[])).toBe(keyOf(calls[0] as unknown[]));
    expect(keyOf(calls[2] as unknown[])).not.toBe(keyOf(calls[0] as unknown[]));
  });

  it("PICK_TASK_STATE_CONFLICT → báo + tải lại task và dòng", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(toast, "error").mockImplementation(() => "");
    const { get } = renderDetail(IDENTITIES.warehouseStaff, picking(), {
      confirm: () => {
        throw apiError("PICK_TASK_STATE_CONFLICT");
      },
    });
    await screen.findByText(L.confirmTitle(1));
    const reads = (url: string) => get.mock.calls.filter(([called]) => called === url).length;
    const before = { task: reads(PATH), lines: reads(`${PATH}/pick-lines`) };
    await fillAndSubmit(user, "HN-A01-01-01-A", LPN_1);
    await waitFor(() => expect(error).toHaveBeenCalledWith(LE.taskState));
    await waitFor(() => expect(reads(PATH)).toBeGreaterThan(before.task));
    await waitFor(() => expect(reads(`${PATH}/pick-lines`)).toBeGreaterThan(before.lines));
  });

  it("không tải được sơ đồ kho (403) → vẫn chọn được vị trí của các dòng, có ghi chú", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(IDENTITIES.warehouseStaff, picking(), {
      layout: () => {
        throw new ApiError(403, "FORBIDDEN", "Access denied");
      },
    });
    expect(await screen.findByText(L.locationsUnavailable)).toBeInTheDocument();
    await fillAndSubmit(user, "HN-A01-01-01-A", LPN_1);
    await waitFor(() => expect(confirmCalls(post)).toHaveLength(1));
  });

  it("Chọn dòng khác trong bảng → thẻ xác nhận đổi sang dòng đó", async () => {
    const user = userEvent.setup();
    renderDetail(IDENTITIES.warehouseStaff, picking());
    await screen.findByText(L.confirmTitle(1));
    await user.click(screen.getByRole("button", { name: L.selectLine(2) }));
    expect(await screen.findByText(L.confirmTitle(2))).toBeInTheDocument();
  });

  it("task chưa có dòng (đơn chỉ dòng in) → câu giải thích, không có thẻ xác nhận", async () => {
    renderDetail(IDENTITIES.warehouseStaff, picking(), { lines: [] });
    expect(await screen.findByText(L.noLines)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.submit })).toBeNull();
  });

  it("NV kho không được gán → chỉ thấy bảng dòng, không có thẻ xác nhận", async () => {
    renderDetail(
      IDENTITIES.warehouseStaff,
      apiTask({ pickStatus: "PICKING", assignedUserId: OTHER_PICKER_ID }),
    );
    expect(await screen.findByText(L.progress(0, 3))).toBeInTheDocument();
    expect(screen.queryByText(L.confirmTitle(1))).toBeNull();
    expect(screen.queryByRole("button", { name: /Chọn dòng/ })).toBeNull();
    expect(screen.getByText(L.onlyAssignee)).toBeInTheDocument();
  });
});
