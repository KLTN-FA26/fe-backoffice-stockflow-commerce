import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, UI_LABELS } from "@/constants";

import {
  TRANSFER_ROLE_PERMISSIONS as ROLES,
  mockTransferApi,
  renderTransferScreen,
  HEAVY_TEST,
} from "../__fixtures__/render";
import { FROM_WH, TRANSFER_ID, apiTransfer, warehouses } from "../__fixtures__/transfer";
import { TransferDetail } from "./TransferDetail";

import type { PermissionCode } from "@/lib/auth";
import type { TransferOrder } from "../types";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
});

const PATH = `/inventory/transfer-orders/${TRANSFER_ID}`;
const A = UI_LABELS.transfer.action;
const D = UI_LABELS.transfer.deliveryMode;

function renderDetail(permissions: readonly PermissionCode[], transfer: TransferOrder) {
  mockTransferApi(permissions, { [PATH]: () => transfer, "/warehouses": () => warehouses });
  renderTransferScreen(<TransferDetail id={TRANSFER_ID} />);
}

describe("TransferDetail — lệnh nguyên chuyến (FTL, LP2-8)", HEAVY_TEST, () => {
  it("thông tin lệnh: hình thức giao 'Nguyên xe (FTL)', chưa đóng gói, chưa rời kho", async () => {
    renderDetail(ROLES.viewOnly, apiTransfer({ status: "PICKING" }));
    expect(await screen.findByText("Nguyên xe (FTL)")).toBeInTheDocument();
    expect(screen.getByText(D.notPacked)).toBeInTheDocument();
    expect(screen.getByText(D.notLeft)).toBeInTheDocument();
    expect(screen.getByText(D.label)).toBeInTheDocument();
  });

  it("giao lẻ hiện 'Giao lẻ'; đã đóng gói / đã rời kho hiện thời điểm thay cho 'Chưa …'", async () => {
    renderDetail(
      ROLES.viewOnly,
      apiTransfer({
        status: "PICKING",
        deliveryMode: "PARCEL",
        packedAt: "2026-10-22T04:00:00Z",
        goodsLeftAt: "2026-10-22T06:00:00Z",
      }),
    );
    expect(await screen.findByText("Giao lẻ")).toBeInTheDocument();
    expect(screen.queryByText(D.notPacked)).not.toBeInTheDocument();
    expect(screen.queryByText(D.notLeft)).not.toBeInTheDocument();
  });

  it("PICKING + FTL chưa đóng gói: ẩn Xuất kho và giải thích vì sao; 'Đóng gói chuyển kho' mở trạm của lệnh", async () => {
    const user = userEvent.setup();
    renderDetail(ROLES.floorStaff, apiTransfer({ status: "PICKING" }));
    await user.click(await screen.findByRole("button", { name: A.packTransfer }));
    expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.packing.transfer(TRANSFER_ID));
    expect(screen.queryByRole("button", { name: A.dispatch })).not.toBeInTheDocument();
    expect(screen.getByText(D.dispatchByLoadPlan)).toBeInTheDocument();
    expect(screen.getByText(D.packFirst)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.planVehicle })).not.toBeInTheDocument();
  });

  it("APPROVED + FTL: có 'Đóng gói chuyển kho' (mở phiên sẽ bắt đầu lấy hàng)", async () => {
    renderDetail(ROLES.floorStaff, apiTransfer({ status: "APPROVED" }));
    expect(await screen.findByRole("button", { name: A.packTransfer })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: A.startPicking })).toBeInTheDocument();
  });

  it("đã đóng gói: 'Lập kế hoạch xe' mở màn lập kế hoạch với nguồn TRANSFER, lệnh và kho nguồn chọn sẵn", async () => {
    const user = userEvent.setup();
    renderDetail(
      ROLES.floorStaff,
      apiTransfer({ status: "PICKING", packedAt: "2026-10-22T04:00:00Z" }),
    );
    await user.click(await screen.findByRole("button", { name: A.planVehicle }));
    expect(push).toHaveBeenCalledWith(
      ADMIN_ROUTES.loadPlans.createFromTransfer(TRANSFER_ID, FROM_WH),
    );
    expect(push.mock.calls[0]?.[0]).toContain("sourceType=TRANSFER");
    expect(screen.queryByRole("button", { name: A.packTransfer })).not.toBeInTheDocument();
    expect(screen.getByText(D.planVehicleHint)).toBeInTheDocument();
  });

  it("không có quyền lập kế hoạch xe (chỉ đóng gói) → không thấy nút; không có quyền đóng gói (chỉ kế hoạch xe) → không thấy nút đóng gói", async () => {
    renderDetail(
      ROLES.packerOnly,
      apiTransfer({ status: "PICKING", packedAt: "2026-10-22T04:00:00Z" }),
    );
    expect(await screen.findByRole("button", { name: A.cancelPicking })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.planVehicle })).not.toBeInTheDocument();
  });

  it("hàng đã rời kho (xe đầu đã ký nhận): Dừng lấy hàng khoá kèm lý do; không còn Lập kế hoạch xe", async () => {
    renderDetail(
      ROLES.floorStaff,
      apiTransfer({
        status: "PICKING",
        packedAt: "2026-10-22T04:00:00Z",
        goodsLeftAt: "2026-10-22T06:00:00Z",
      }),
    );
    expect(await screen.findByRole("button", { name: A.cancelPicking })).toBeDisabled();
    expect(screen.getByText(D.goodsLeftCannotCancelPicking)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.planVehicle })).not.toBeInTheDocument();
  });

  it("PICKING + giao lẻ: Xuất kho thủ công vẫn còn, không có nút đóng gói / kế hoạch xe và không có câu giải thích", async () => {
    renderDetail(ROLES.floorStaff, apiTransfer({ status: "PICKING", deliveryMode: "PARCEL" }));
    expect(await screen.findByRole("button", { name: A.dispatch })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: A.packTransfer })).not.toBeInTheDocument();
    expect(screen.queryByText(D.dispatchByLoadPlan)).not.toBeInTheDocument();
  });

  it("chỉ xem: không nút nào, kể cả khi lệnh FTL đã đóng gói", async () => {
    renderDetail(
      ROLES.viewOnly,
      apiTransfer({ status: "PICKING", packedAt: "2026-10-22T04:00:00Z" }),
    );
    expect(await screen.findByText(UI_LABELS.transfer.noActions.viewOnly)).toBeInTheDocument();
    for (const label of Object.values(A)) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
  });
});
