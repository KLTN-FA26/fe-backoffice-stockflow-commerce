import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import {
  TRANSFER_ROLE_PERMISSIONS as ROLES,
  mockTransferApi,
  renderTransferScreen,
} from "../__fixtures__/render";
import { OTHER_USER, TRANSFER_ID, apiTransfer, warehouses } from "../__fixtures__/transfer";
import { TransferDetail } from "./TransferDetail";

import type { PermissionCode } from "@/lib/auth";
import type { TransferOrder } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

// Render cả màn + react-query + userEvent: máy CI / máy đang tải nặng có thể vượt mốc 5s mặc định
const HEAVY = { timeout: 15_000 };

const PATH = `/inventory/transfer-orders/${TRANSFER_ID}`;
const A = UI_LABELS.transfer.action;

function renderDetail(permissions: readonly PermissionCode[], transfer: TransferOrder) {
  const spies = mockTransferApi(
    permissions,
    { [PATH]: () => transfer, "/warehouses": () => warehouses },
    {
      [`${PATH}/dispatch`]: (_p, body) => {
        const shipped = (body as { lines: { lineId: string; shippedQuantity: number }[] }).lines;
        return {
          ...transfer,
          status: "IN_TRANSIT",
          dispatchedAt: "2026-10-12T05:00:00Z",
          lines: transfer.lines.map((l) => ({
            ...l,
            shipped: shipped.find((s) => s.lineId === l.lineId)?.shippedQuantity ?? 0,
          })),
        };
      },
    },
  );
  renderTransferScreen(<TransferDetail id={TRANSFER_ID} />);
  return spies;
}

describe("TransferDetail — action-gating + xuất kho", HEAVY, () => {
  it("PICKING + NV kho → thấy Xuất kho; xuất thiếu gửi đúng SL từng dòng", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ROLES.warehouseStaff, apiTransfer({ status: "PICKING" }));

    await user.click(await screen.findByRole("button", { name: A.dispatch }));
    const dialog = await screen.findByRole("dialog");
    const second = within(dialog).getByLabelText(/TSHIRT-WHT-L/);
    await user.clear(second);
    await user.type(second, "5");
    expect(within(dialog).getByText(UI_LABELS.transfer.partialDispatch)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: A.dispatch }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(`${PATH}/dispatch`, {
        lines: [
          { lineId: "l-1", shippedQuantity: 40 },
          { lineId: "l-2", shippedQuantity: 5 },
        ],
      }),
    );
  });

  it("SL xuất vượt SL yêu cầu → khoá nút xuất, báo lỗi inline", async () => {
    const user = userEvent.setup();
    renderDetail(ROLES.warehouseStaff, apiTransfer({ status: "PICKING" }));
    await user.click(await screen.findByRole("button", { name: A.dispatch }));
    const dialog = await screen.findByRole("dialog");
    const first = within(dialog).getByLabelText(/CUP-PP-500/);
    await user.clear(first);
    await user.type(first, "41");
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: A.dispatch })).toBeDisabled();
  });

  it("PENDING_APPROVAL do chính mình gửi + quản lý kho → nút Duyệt bị khoá kèm lý do", async () => {
    renderDetail(
      ROLES.warehouseManager,
      apiTransfer({ status: "PENDING_APPROVAL", submittedBy: "u-test" }),
    );
    expect(await screen.findByRole("button", { name: A.approve })).toBeDisabled();
    expect(screen.getAllByText(UI_LABELS.transfer.disabledReason.selfApproval)).toHaveLength(2);
  });

  it("PENDING_APPROVAL + Inventory Planner → không thấy nút Duyệt", async () => {
    renderDetail(
      ROLES.inventoryPlanner,
      apiTransfer({ status: "PENDING_APPROVAL", submittedBy: OTHER_USER }),
    );
    expect(
      await screen.findByText(UI_LABELS.transfer.noActions.pendingApproval),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.approve })).not.toBeInTheDocument();
  });

  it("COMPLETED → không render nút mutating nào, hiện SL đã xuất", async () => {
    renderDetail(
      ROLES.warehouseManager,
      apiTransfer({ status: "COMPLETED", dispatchedAt: "2026-10-12T05:00:00Z" }),
    );
    expect(await screen.findByText(UI_LABELS.transfer.noActions.terminal)).toBeInTheDocument();
    for (const label of Object.values(A)) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("columnheader", { name: "SL đã xuất" })).toBeInTheDocument();
  });

  it("tên kho tra từ danh sách kho thay vì UUID", async () => {
    renderDetail(ROLES.viewOnly, apiTransfer());
    expect(await screen.findByText("HCM · Kho Hồ Chí Minh")).toBeInTheDocument();
  });
});
