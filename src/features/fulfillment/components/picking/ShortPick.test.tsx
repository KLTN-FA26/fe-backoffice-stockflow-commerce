import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PICK_LINE_ERROR_MESSAGES as LE, PICK_LINE_LABELS as L, TOAST_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { toast } from "@/components/shared/Toast";

import { PICK_LINE_1, apiPickLine, apiPickLines } from "../../__fixtures__/pick-lines";
import { REALLOCATED_BIN, linePath, renderPickingDetail } from "../../__fixtures__/picking-detail";
import { IDENTITIES, pickInputComboboxOption } from "../../__fixtures__/render";
import { OTHER_PICKER_ID, apiTask } from "../../__fixtures__/task";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const TOAST = TOAST_MESSAGES.fulfillment;
const picking = (assignedUserId?: string) =>
  apiTask({ pickStatus: "PICKING", ...(assignedUserId ? { assignedUserId } : {}) });
/** Dòng 1 đã báo thiếu 2 (tìm thấy 1/3), hai dòng còn lại mở. */
const withShortLine = () =>
  apiPickLines().map((line) =>
    line.lineId === PICK_LINE_1 ? { ...line, status: "SHORT" as const, shortQty: 2 } : line,
  );
const shortCalls = (post: { mock: { calls: unknown[][] } }) =>
  post.mock.calls.filter(([url]) => url === linePath(PICK_LINE_1, "short"));

async function openShortDialog(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText(L.confirmTitle(1));
  await user.click(screen.getByRole("button", { name: L.shortAction }));
  return screen.findByRole("dialog");
}

async function fillShort(
  user: ReturnType<typeof userEvent.setup>,
  location: string,
  found: string,
) {
  await pickInputComboboxOption(user, L.location, location);
  const qty = screen.getByLabelText(L.foundQuantity);
  await user.clear(qty);
  await user.type(qty, found);
  await user.click(screen.getByRole("button", { name: L.shortAction }));
}

/** Xác nhận dòng đang hiện trên thẻ: vị trí + mã hàng qua combobox, SL rồi Enter. */
async function confirmActive(
  user: ReturnType<typeof userEvent.setup>,
  location: string,
  item: string,
  quantity: string,
) {
  await pickInputComboboxOption(user, L.location, location);
  await pickInputComboboxOption(user, L.item, item);
  const qty = screen.getByLabelText(L.quantity);
  await user.clear(qty);
  await user.type(qty, `${quantity}{Enter}`);
}

describe("Báo thiếu hàng — người được gán (BE POST …/short, X-SHORT)", () => {
  it("người được gán báo thiếu: vị trí + số tìm thấy → POST short {locationCode, foundQuantity}", async () => {
    const user = userEvent.setup();
    const success = vi.spyOn(toast, "success").mockImplementation(() => "");
    const { post } = renderPickingDetail(IDENTITIES.warehouseStaff, picking());
    await openShortDialog(user);
    await fillShort(user, "HN-A01-01-01-A", "1");
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        linePath(PICK_LINE_1, "short"),
        { locationCode: "HN-A01-01-01-A", foundQuantity: 1 },
        { headers: { "Idempotency-Key": expect.any(String) } },
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(success).toHaveBeenCalledWith(TOAST.shortReported("TEE-BLK-M", 2));
  });

  it("chọn vị trí trong dialog báo thiếu → con trỏ sang ô Số tìm thấy (không cần chuột)", async () => {
    const user = userEvent.setup();
    renderPickingDetail(IDENTITIES.warehouseStaff, picking());
    await openShortDialog(user);
    await pickInputComboboxOption(user, L.location, "HN-A01-01-01-A");
    expect(screen.getByLabelText(L.foundQuantity)).toHaveFocus();
  });

  it("số tìm thấy = SL phân bổ → lỗi form, không gửi", async () => {
    const user = userEvent.setup();
    const { post } = renderPickingDetail(IDENTITIES.warehouseStaff, picking());
    await openShortDialog(user);
    await fillShort(user, "HN-A01-01-01-A", "3");
    expect(await screen.findByText(LE.shortFoundRange(2))).toBeInTheDocument();
    expect(shortCalls(post)).toHaveLength(0);
  });

  it("BE PICK_LOCATION_MISMATCH → lỗi dưới ô Vị trí, dialog vẫn mở", async () => {
    const user = userEvent.setup();
    renderPickingDetail(IDENTITIES.warehouseStaff, picking(), {
      short: () => {
        throw new ApiError(409, "PICK_LOCATION_MISMATCH", "x");
      },
    });
    const dialog = await openShortDialog(user);
    await fillShort(user, "HN-STAGE-01", "0");
    expect(
      await within(dialog).findByText(LE.locationMismatch("HN-A01-01-01-A")),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sau báo thiếu: dòng hiện Thiếu + SL thiếu, thẻ chuyển dòng mở kế tiếp, có ghi chú tạm giữ", async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, "success").mockImplementation(() => "");
    renderPickingDetail(IDENTITIES.warehouseStaff, picking());
    await openShortDialog(user);
    await fillShort(user, "HN-A01-01-01-A", "1");
    expect(await screen.findByText(L.onHoldForShort(1))).toBeInTheDocument();
    expect(await screen.findByText(L.confirmTitle(2))).toBeInTheDocument();
    const table = screen.getByRole("table", { name: L.sectionTitle });
    expect(within(table).getByRole("columnheader", { name: L.shortColumn })).toBeInTheDocument();
    const row = within(table).getAllByRole("row")[1] as HTMLElement;
    expect(within(row).getByText("Thiếu")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });

  it("vừa xác nhận dòng 1 rồi báo thiếu dòng 2 → bỏ câu 'Đã lấy dòng 1/3' (chỉ nói thao tác vừa làm)", async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, "success").mockImplementation(() => "");
    renderPickingDetail(IDENTITIES.warehouseStaff, picking());
    await screen.findByText(L.confirmTitle(1));
    await confirmActive(user, "HN-A01-01-01-A", "TEE-BLK-M", "3");
    expect(await screen.findByText(L.done(1))).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: L.shortAction }));
    await screen.findByRole("dialog");
    await fillShort(user, "HN-A01-01-02-A", "0");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(L.confirmTitle(3))).toBeInTheDocument();
    expect(screen.queryByText(L.done(1))).toBeNull();
  });

  it("đơn đã huỷ còn dòng Thiếu (BE chỉ huỷ dòng Open) → không báo 'đơn đang tạm giữ chờ phân bổ lại'", async () => {
    renderPickingDetail(IDENTITIES.warehouseManager, apiTask({ pickStatus: "CANCELLED" }), {
      lines: withShortLine(),
    });
    expect(await screen.findByRole("table", { name: L.sectionTitle })).toBeInTheDocument();
    expect(screen.queryByText(L.onHoldForShort(1))).toBeNull();
  });

  it("NV kho không được gán không thấy nút Báo thiếu hàng", async () => {
    renderPickingDetail(IDENTITIES.warehouseStaff, picking(OTHER_PICKER_ID));
    expect(await screen.findByText(L.progress(0, 3))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.shortAction })).toBeNull();
  });
});

describe("Phân bổ lại dòng thiếu — người phân việc (BE POST …/reallocation)", () => {
  it("điều phối thấy Phân bổ lại ở dòng SHORT, xác nhận → POST reallocation, dòng mới ở cuối bảng", async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, "success").mockImplementation(() => "");
    const { post } = renderPickingDetail(IDENTITIES.orderCoordinator, picking(OTHER_PICKER_ID), {
      lines: withShortLine(),
      userId: "coordinator-id",
    });
    expect(await screen.findByText(L.onHoldForShort(1))).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: new RegExp(L.reallocate) });
    expect(buttons).toHaveLength(1);
    await user.click(buttons[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(L.reallocateConfirm("TEE-BLK-M", 3))).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: L.reallocate }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(linePath(PICK_LINE_1, "reallocation"), undefined, {
        headers: { "Idempotency-Key": expect.any(String) },
      }),
    );
    const table = screen.getByRole("table", { name: L.sectionTitle });
    await waitFor(() => {
      const rows = within(table).getAllByRole("row");
      expect(rows[rows.length - 1]).toHaveTextContent(REALLOCATED_BIN);
    });
    expect(screen.queryByText(L.onHoldForShort(1))).toBeNull();
  });

  it("quản lý kho được gán: xác nhận dòng 2 rồi phân bổ lại dòng 1 → bỏ câu 'Đã lấy dòng 2/3'", async () => {
    const user = userEvent.setup();
    vi.spyOn(toast, "success").mockImplementation(() => "");
    renderPickingDetail(IDENTITIES.warehouseManager, picking(), { lines: withShortLine() });
    await screen.findByText(L.confirmTitle(2));
    await confirmActive(user, "HN-A01-01-02-A", "MUG-WHT", "2");
    expect(await screen.findByText(L.done(2))).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: new RegExp(L.reallocate) }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: L.reallocate }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText(L.confirmTitle(3))).toBeInTheDocument();
    // Tiến độ bỏ dòng huỷ ("Đã lấy 1/3 dòng") — tiêu đề không được ghi một mẫu số khác bên cạnh
    expect(screen.queryByText(/Xác nhận dòng \d+\/\d+/)).toBeNull();
    expect(screen.queryByText(L.done(2))).toBeNull();
  });

  it("INSUFFICIENT_STOCK → câu 'Không đủ hàng ở vị trí khác để phân bổ lại'", async () => {
    const user = userEvent.setup();
    renderPickingDetail(IDENTITIES.orderCoordinator, picking(OTHER_PICKER_ID), {
      lines: withShortLine(),
      userId: "coordinator-id",
      reallocate: () => {
        throw new ApiError(409, "INSUFFICIENT_STOCK", "Not enough available stock");
      },
    });
    await user.click(await screen.findByRole("button", { name: new RegExp(L.reallocate) }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: L.reallocate }));
    expect(await within(dialog).findByText(LE.insufficientStock)).toBeInTheDocument();
  });

  it("NV kho (không có task-assignment:UPDATE) không thấy Phân bổ lại", async () => {
    renderPickingDetail(IDENTITIES.warehouseStaff, picking(), { lines: withShortLine() });
    expect(await screen.findByText(L.onHoldForShort(1))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(L.reallocate) })).toBeNull();
  });

  it("dòng huỷ do đã phân bổ lại vẫn giữ SL thiếu, không có nút", async () => {
    renderPickingDetail(IDENTITIES.orderCoordinator, picking(OTHER_PICKER_ID), {
      lines: [
        apiPickLine({ status: "CANCELLED", shortQty: 3 }),
        apiPickLine({ lineId: "new-line", sequenceNo: 2, locationCode: REALLOCATED_BIN }),
      ],
      userId: "coordinator-id",
    });
    const table = await screen.findByRole("table", { name: L.sectionTitle });
    expect(within(table).getByRole("columnheader", { name: L.shortColumn })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(L.reallocate) })).toBeNull();
  });
});
