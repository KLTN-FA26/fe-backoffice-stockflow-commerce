/**
 * Tạo task lấy hàng — chọn đích lấy hàng (docs 07 §3, §4.1 bước 2; 17 §4.4 bước 14): khu xuất hàng (DISPATCH, mặc
 * định) hoặc khu chờ xuất (STAGING, kèm khu chờ xuất của kho nếu cần). Khu chờ xuất lấy từ sơ đồ kho.
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
const LAYOUT = `/warehouses/${WAREHOUSE_ID}/layout`;
const area = (locationCode: string, type: string, usable = true) => ({
  locationCode,
  type,
  usable,
});

async function openDialog(options: {
  areas?: ReturnType<typeof area>[] | "forbidden";
  create?: (body: unknown) => unknown;
}) {
  const spies = mockFulfillmentApi(
    IDENTITIES.warehouseManager,
    {
      "/fulfillment/task-candidates": () => bePage([taskCandidate]),
      "/fulfillment/assignees": () => assignees,
      [LAYOUT]: () => {
        if (options.areas === "forbidden") throw new ApiError(403, "FORBIDDEN", "x");
        return { shelves: [], areas: options.areas ?? [] };
      },
    },
    { "/fulfillment/tasks": (_params, body) => (options.create ?? (() => apiTask()))(body) },
  );
  renderFulfillmentScreen(<CreateTaskDialog onClose={vi.fn()} />);
  const user = userEvent.setup();
  const dialog = await screen.findByRole("dialog");
  await pickSelectOption(user, "Đơn hàng", /SO-20261010-000431/);
  await pickSelectOption(user, "Người được gán", /Hoàng Anh Tuấn/);
  return { ...spies, user, dialog };
}

const submit = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: UI_LABELS.fulfillment.action.create });

describe("Tạo task — đích lấy hàng", () => {
  it("mặc định chọn khu xuất hàng; chưa chọn STAGING thì không đọc sơ đồ kho", async () => {
    const { get, dialog } = await openDialog({});
    expect(within(dialog).getByRole("radio", { name: new RegExp(D.DISPATCH) })).toBeChecked();
    expect(get.mock.calls.some(([url]) => url === LAYOUT)).toBe(false);
  });

  it("STAGING, kho có đúng một khu chờ xuất đang dùng → dùng khu đó, gửi destination + stagingLocationCode", async () => {
    const { user, dialog, post } = await openDialog({
      areas: [
        area("HN-STAGE-01", "STAGING"),
        area("HN-STAGE-OLD", "STAGING", false),
        area("HN-QC-01", "QUARANTINE"),
      ],
    });
    await user.click(within(dialog).getByRole("radio", { name: new RegExp(D.STAGING) }));
    expect(await within(dialog).findByText(D.stagingAreaSingle("HN-STAGE-01"))).toBeInTheDocument();
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

  it("STAGING, kho có nhiều khu chờ xuất → bắt chọn khu; chưa chọn thì không gửi", async () => {
    const { user, dialog, post } = await openDialog({
      areas: [area("HN-STAGE-01", "STAGING"), area("HN-STAGE-02", "STAGING")],
    });
    await user.click(within(dialog).getByRole("radio", { name: new RegExp(D.STAGING) }));
    await user.click(submit(dialog));
    expect(await within(dialog).findByText(D.stagingAreaRequired)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();

    await pickSelectOption(user, D.stagingArea, "HN-STAGE-02");
    await user.click(submit(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/fulfillment/tasks",
        expect.objectContaining({ destination: "STAGING", stagingLocationCode: "HN-STAGE-02" }),
      ),
    );
  });

  it("STAGING, kho không có khu chờ xuất nào → báo, khoá nút gửi; quay lại DISPATCH thì gửi được", async () => {
    const { user, dialog, post } = await openDialog({ areas: [area("HN-QC-01", "QUARANTINE")] });
    await user.click(within(dialog).getByRole("radio", { name: new RegExp(D.STAGING) }));
    expect(await within(dialog).findByText(D.stagingAreaNone)).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: new RegExp(D.DISPATCH) }));
    expect(submit(dialog)).toBeEnabled();
    await user.click(submit(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/fulfillment/tasks", {
        orderId: ORDER_ID,
        assignedUserId: assignees[0]?.userId,
        destination: "DISPATCH",
      }),
    );
  });

  it("không đọc được sơ đồ kho (403) → vẫn gửi STAGING không kèm khu, để BE tự chọn / từ chối", async () => {
    const { user, dialog, post } = await openDialog({ areas: "forbidden" });
    await user.click(within(dialog).getByRole("radio", { name: new RegExp(D.STAGING) }));
    expect(await within(dialog).findByText(D.stagingAreasFailed)).toBeInTheDocument();
    await user.click(submit(dialog));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/fulfillment/tasks", {
        orderId: ORDER_ID,
        assignedUserId: assignees[0]?.userId,
        destination: "STAGING",
      }),
    );
  });

  it("BE 422 STAGING_AREA_INVALID → câu tiếng Việt trong dialog, dialog giữ nguyên", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { user, dialog } = await openDialog({
      areas: [area("HN-STAGE-01", "STAGING")],
      create: () => {
        throw new ApiError(422, "STAGING_AREA_INVALID", "English");
      },
    });
    await user.click(within(dialog).getByRole("radio", { name: new RegExp(D.STAGING) }));
    await user.click(submit(dialog));
    expect(
      await within(dialog).findByText(FULFILLMENT_ERROR_MESSAGES.STAGING_AREA_INVALID),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("English")).toBeNull();
  });
});
