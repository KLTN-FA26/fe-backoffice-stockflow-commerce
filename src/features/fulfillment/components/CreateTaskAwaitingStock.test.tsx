/**
 * Tạo task cho đơn đang chờ hàng (docs 07 §4.1 bước 1–2, 17 §4.4 bước 15): đơn Awaiting Stock đã giữ được một phần
 * thùng nằm trong danh sách chờ (nhãn "Chờ hàng"); chỉ lấy trước về khu chờ xuất, hoặc sang khu xuất hàng khi Sale đã
 * cho phép giao một phần.
 */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FULFILLMENT_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import {
  IDENTITIES,
  mockFulfillmentApi,
  pickSelectOption,
  renderFulfillmentScreen,
} from "../__fixtures__/render";
import {
  ORDER_ID,
  WAREHOUSE_ID,
  apiTask,
  assignees,
  bePage,
  taskCandidate,
} from "../__fixtures__/task";
import { CreateTaskDialog } from "./assign/CreateTaskDialog";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const D = UI_LABELS.fulfillment.destination;
const awaiting = (partialShipmentAllowed: boolean) => ({
  ...taskCandidate,
  releasedAt: null,
  orderStatus: "AWAITING_STOCK",
  partialShipmentAllowed,
});

async function openDialog(candidate: object, create?: () => unknown) {
  const spies = mockFulfillmentApi(
    IDENTITIES.warehouseManager,
    {
      "/fulfillment/task-candidates": () => bePage([candidate]),
      "/fulfillment/assignees": () => assignees,
      [`/warehouses/${WAREHOUSE_ID}/layout`]: () => ({
        shelves: [],
        areas: [{ locationCode: "HN-STAGE-01", type: "STAGING", usable: true }],
      }),
    },
    { "/fulfillment/tasks": () => (create ?? (() => apiTask()))() },
  );
  renderFulfillmentScreen(<CreateTaskDialog warehouseId={WAREHOUSE_ID} onClose={vi.fn()} />);
  const user = userEvent.setup();
  const dialog = await screen.findByRole("dialog");
  return { ...spies, user, dialog };
}

const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: UI_LABELS.fulfillment.action.create });

describe("Tạo task — đơn đang chờ hàng", () => {
  it("Sale chưa cho giao một phần → nhãn Chờ hàng; khoá khu xuất hàng, chọn khu chờ xuất và gửi STAGING", async () => {
    const { user, dialog, post } = await openDialog(awaiting(false));
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    Element.prototype.scrollIntoView ??= () => {};
    await user.click(await within(dialog).findByRole("combobox", { name: "Đơn hàng" }));
    expect(
      await screen.findByRole("option", {
        name: new RegExp(UI_LABELS.fulfillment.candidate.awaitingStock),
      }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: /SO-20261010-000431/ }));
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);

    expect(within(dialog).getByRole("radio", { name: new RegExp(D.DISPATCH) })).toBeDisabled();
    expect(within(dialog).getByRole("radio", { name: new RegExp(D.STAGING) })).toBeChecked();
    expect(within(dialog).getByText(D.awaitingStockStagingOnly)).toBeInTheDocument();
    await user.click(submit(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/fulfillment/tasks", {
        orderId: ORDER_ID,
        assignedUserId: assignees[0]?.userId,
        destination: "STAGING",
        stagingLocationCode: "HN-STAGE-01",
      }),
    );
  });

  it("Sale đã cho giao một phần → chọn được khu xuất hàng (mặc định)", async () => {
    const { user, dialog, post } = await openDialog(awaiting(true));
    await pickSelectOption(user, "Đơn hàng", /SO-20261010-000431/);
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
    expect(within(dialog).getByRole("radio", { name: new RegExp(D.DISPATCH) })).toBeEnabled();
    expect(within(dialog).queryByText(D.awaitingStockStagingOnly)).toBeNull();
    await user.click(submit(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/fulfillment/tasks",
        expect.objectContaining({ destination: "DISPATCH" }),
      ),
    );
  });

  it("BE 409 PICK_AWAITING_STOCK_DESTINATION → câu tiếng Việt trong dialog", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { user, dialog } = await openDialog(awaiting(true), () => {
      throw new ApiError(409, "PICK_AWAITING_STOCK_DESTINATION", "English");
    });
    await pickSelectOption(user, "Đơn hàng", /SO-20261010-000431/);
    await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByText(FULFILLMENT_ERROR_MESSAGES.PICK_AWAITING_STOCK_DESTINATION),
    ).toBeInTheDocument();
    expect(screen.queryByText("English")).toBeNull();
  });
});
