import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_ROUTES,
  FULFILLMENT_PACKAGE_PERMISSIONS,
  TRANSFER_PACK_ERROR_MESSAGES,
  UI_LABELS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

import { IDENTITIES } from "../__fixtures__/render";
import {
  OTHER_PACKER_ID,
  PACKS_PATH,
  PACK_ID,
  PACK_PATH,
  TRANSFER_ORDER_ID,
  FROM_WH,
  tLine,
  tSession,
} from "../__fixtures__/transfer-pack";
import { PLANNER_IDENTITY, renderTransferPackStation } from "../__fixtures__/transfer-pack-render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const L = UI_LABELS.transferPack;

describe("trạm đóng gói chuyển kho — vào trạm và mở phiên", () => {
  it("chưa có ?pack: hiện cổng mở phiên, bấm thì POST {transferOrderId} rồi tải phiên", async () => {
    const user = userEvent.setup();
    const { post } = renderTransferPackStation({
      withoutPack: true,
      post: (state) => ({ [PACKS_PATH]: () => state.session }),
    });
    await user.click(await screen.findByRole("button", { name: L.start.action }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(PACKS_PATH, { transferOrderId: TRANSFER_ORDER_ID }),
    );
    // Câu trả lời của POST được ghi vào cache phiên và ?pack đổi sang packId → trạm hiện ngay phiên vừa mở
    expect(await screen.findByText(`${L.stationTitle} — TO-20261012-0001`)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.start.action })).not.toBeInTheDocument();
  });

  it("không tự gọi POST khi vào trang (mở phiên chuyển lệnh Đã duyệt → Đang lấy hàng)", async () => {
    const { post } = renderTransferPackStation({ withoutPack: true });
    await screen.findByRole("button", { name: L.start.action });
    expect(post).not.toHaveBeenCalled();
  });

  it("thiếu quyền đóng gói (chỉ packages:READ): không có nút mở phiên, báo thiếu quyền", async () => {
    renderTransferPackStation({
      withoutPack: true,
      identity: {
        permissions: [
          FULFILLMENT_PACKAGE_PERMISSIONS.viewPage,
          FULFILLMENT_PACKAGE_PERMISSIONS.read,
        ],
      },
    });
    expect(await screen.findByText(L.start.noneYetReadOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.start.action })).not.toBeInTheDocument();
  });

  it("mở phiên lệnh giao lẻ: BE 409 TRANSFER_NOT_FULL_TRUCKLOAD → câu tiếng Việt, không điều hướng", async () => {
    const user = userEvent.setup();
    renderTransferPackStation({
      withoutPack: true,
      post: () => ({
        [PACKS_PATH]: () => {
          throw new ApiError(409, "TRANSFER_NOT_FULL_TRUCKLOAD", "no");
        },
      }),
    });
    await user.click(await screen.findByRole("button", { name: L.start.action }));
    expect(
      await screen.findByText(TRANSFER_PACK_ERROR_MESSAGES.TRANSFER_NOT_FULL_TRUCKLOAD),
    ).toBeInTheDocument();
    expect(screen.queryByText(L.status.pack)).not.toBeInTheDocument();
  });
});

describe("trạm đóng gói chuyển kho — hiển thị và gating", () => {
  it("phiên đang đóng: tiêu đề có số lệnh, dòng của lệnh, hình thức giao, tên hai kho", async () => {
    renderTransferPackStation({
      session: tSession({
        lines: [tLine(), tLine({ transferLineId: "x", lineNo: 2, sku: "CUP-1" })],
      }),
    });
    expect(await screen.findByText(`${L.stationTitle} — TO-20261012-0001`)).toBeInTheDocument();
    expect(screen.getByRole("table", { name: L.lines.title })).toBeInTheDocument();
    expect(screen.getByText("TEE-BLK-M")).toBeInTheDocument();
    expect(screen.getByText("Nguyên xe (FTL)")).toBeInTheDocument();
    expect(await screen.findByText("HN · Kho Hà Nội")).toBeInTheDocument();
    expect(screen.getByText("HCM · Kho HCM")).toBeInTheDocument();
    // Người đóng là chính mình
    expect(screen.getByText(L.status.you)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.action.complete })).toBeInTheDocument();
  });

  it("chỉ có quyền xem (packages:READ): không quét, không mở kiện, không hoàn tất; có thông báo chỉ xem", async () => {
    renderTransferPackStation({
      identity: {
        permissions: [
          FULFILLMENT_PACKAGE_PERMISSIONS.viewPage,
          FULFILLMENT_PACKAGE_PERMISSIONS.read,
        ],
      },
    });
    expect(await screen.findByText(L.notice.viewOnly)).toBeInTheDocument();
    expect(screen.queryByText(L.scan.title)).not.toBeInTheDocument();
    for (const name of [
      UI_LABELS.packing.action.openPackage,
      L.action.openKit,
      L.action.shipCarton,
      L.action.complete,
    ]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("người khác đang đóng + nhân viên thường: chỉ xem; quản lý kho (APPROVE) vẫn thao tác được", async () => {
    const other = tSession({ packerId: OTHER_PACKER_ID });
    renderTransferPackStation({ session: other });
    expect(await screen.findByText(L.notice.takenByOtherNoName)).toBeInTheDocument();
    expect(screen.queryByText(L.scan.title)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.complete })).not.toBeInTheDocument();
  });

  it("quản lý kho vào phiên của người khác: có thông báo làm hộ và đủ nút", async () => {
    renderTransferPackStation({
      session: tSession({ packerId: OTHER_PACKER_ID }),
      identity: IDENTITIES.warehouseManager,
    });
    expect(await screen.findByText(L.notice.managerAssist)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.action.complete })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.action.shipCarton })).toBeInTheDocument();
  });

  it("đã đóng xong (PACKED): báo xong, không còn thao tác; người có quyền kế hoạch xe thấy 'Lập kế hoạch xe' trỏ đúng URL", async () => {
    renderTransferPackStation({
      identity: PLANNER_IDENTITY,
      session: tSession({ packStatus: "PACKED", packedAt: "2026-10-22T04:00:00Z" }),
    });
    expect(await screen.findByText(L.notice.packedTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.complete })).not.toBeInTheDocument();
    expect(screen.queryByText(L.scan.title)).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: L.action.planVehicle });
    expect(link).toHaveAttribute(
      "href",
      ADMIN_ROUTES.loadPlans.createFromTransfer(TRANSFER_ORDER_ID, FROM_WH),
    );
  });

  it("đã đóng xong nhưng không có quyền lập kế hoạch xe: không có nút 'Lập kế hoạch xe'", async () => {
    renderTransferPackStation({
      session: tSession({ packStatus: "PACKED", packedAt: "2026-10-22T04:00:00Z" }),
    });
    await screen.findByText(L.notice.packedTitle);
    expect(screen.queryByRole("link", { name: L.action.planVehicle })).not.toBeInTheDocument();
    // Vẫn có lối về lệnh chuyển kho
    expect(screen.getByRole("link", { name: new RegExp(L.openTransfer) })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.transfers.detail(TRANSFER_ORDER_ID),
    );
  });

  it("phiên đã bị huỷ (lệnh dừng lấy hàng): báo huỷ, không thao tác được", async () => {
    renderTransferPackStation({ session: tSession({ packStatus: "CANCELLED" }) });
    expect(await screen.findByText(L.notice.cancelled)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.action.complete })).not.toBeInTheDocument();
  });

  it("dòng đi nhiều thùng: nhắc đóng bộ và có nút 'Đóng bộ' ở bảng dòng hàng", async () => {
    renderTransferPackStation({
      session: tSession({
        lines: [tLine({ packageCount: 2, kitSuggested: true, sku: "DESK-OAK" })],
      }),
    });
    expect(await screen.findByText(L.notice.kitSuggested)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `${L.lines.openKit} DESK-OAK` })).toBeInTheDocument();
  });

  it("phiên không tìm thấy (404): màn lỗi 'không tìm thấy phiên', có lối về lệnh", async () => {
    renderTransferPackStation({
      get: () => ({
        [PACK_PATH]: () => {
          throw new ApiError(404, "NOT_FOUND", "no pack");
        },
      }),
    });
    expect(await screen.findByText(L.notFoundTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: L.backToTransfer })).toBeInTheDocument();
  });

  it("thiếu packages:READ: màn 'không có quyền xem', không gọi API phiên", async () => {
    const { get } = renderTransferPackStation({
      identity: { permissions: [FULFILLMENT_PACKAGE_PERMISSIONS.viewPage] },
    });
    expect(await screen.findByText(L.noAccessTitle)).toBeInTheDocument();
    expect(get).not.toHaveBeenCalledWith(
      `/fulfillment/transfer-packs/${PACK_ID}`,
      expect.anything(),
    );
  });
});
