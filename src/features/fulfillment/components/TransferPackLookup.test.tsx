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
import { toast } from "@/components/shared/Toast";

import { shortId } from "../selectors";
import { IDENTITIES } from "../__fixtures__/render";
import {
  FROM_WH,
  OTHER_PACKER_ID,
  PACKS_PATH,
  PACK_PATH,
  TRANSFER_ORDER_ID,
  tSession,
} from "../__fixtures__/transfer-pack";
import { PLANNER_IDENTITY, renderTransferPackStation } from "../__fixtures__/transfer-pack-render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const L = UI_LABELS.transferPack;
const READ_ONLY = {
  permissions: [FULFILLMENT_PACKAGE_PERMISSIONS.viewPage, FULFILLMENT_PACKAGE_PERMISSIONS.read],
};

describe("trạm đóng gói chuyển kho — tra phiên hiện hành khi chưa có ?pack (BE GET ?transferOrderId=)", () => {
  it("người chỉ có packages:READ vào thẳng phiên của lệnh: không POST, không nút mở phiên, hiện tên người đóng", async () => {
    const { get, post } = renderTransferPackStation({
      withoutPack: true,
      existingPack: true,
      identity: READ_ONLY,
      userId: "reader",
      session: tSession({ packerId: OTHER_PACKER_ID, packerName: "Nguyễn Lan" }),
    });
    expect(await screen.findByText(`${L.stationTitle} — TO-20261012-0001`)).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      PACKS_PATH,
      expect.objectContaining({ params: { transferOrderId: TRANSFER_ORDER_ID } }),
    );
    expect(post).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: L.start.action })).not.toBeInTheDocument();
    expect(screen.getByText("Nguyễn Lan")).toBeInTheDocument();
    expect(screen.getByText(L.notice.viewOnly)).toBeInTheDocument();
  });

  it("đã đóng gói xong: quay lại trạm không cần ?pack — thấy phiên PACKED và lối 'Lập kế hoạch xe'", async () => {
    renderTransferPackStation({
      withoutPack: true,
      existingPack: true,
      identity: PLANNER_IDENTITY,
      session: tSession({ packStatus: "PACKED", packedAt: "2026-10-22T04:00:00Z" }),
    });
    expect(await screen.findByText(L.notice.packedTitle)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: L.action.planVehicle })).toHaveAttribute(
      "href",
      ADMIN_ROUTES.loadPlans.createFromTransfer(TRANSFER_ORDER_ID, FROM_WH),
    );
  });

  it("chưa từng đóng gói (404): chỉ người có packing:UPDATE thấy 'Mở phiên đóng gói'; người chỉ-đọc được báo rõ", async () => {
    renderTransferPackStation({ withoutPack: true });
    expect(await screen.findByText(L.start.noneYet)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: L.start.action })).toBeInTheDocument();
    document.body.innerHTML = "";
    renderTransferPackStation({ withoutPack: true, identity: READ_ONLY });
    expect(await screen.findByText(L.start.noneYetReadOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.start.action })).not.toBeInTheDocument();
  });

  it("tra phiên lỗi khác 404 (5xx): màn lỗi có 'Thử lại', không rơi vào cổng mở phiên", async () => {
    renderTransferPackStation({
      withoutPack: true,
      get: () => ({
        [PACKS_PATH]: () => {
          throw new ApiError(500, "INTERNAL_ERROR", "boom");
        },
      }),
    });
    expect(await screen.findByRole("button", { name: UI_LABELS.common.retry })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: L.start.action })).not.toBeInTheDocument();
  });

  it("có ?pack thì đọc đúng phiên đó, không tra theo lệnh", async () => {
    const { get } = renderTransferPackStation({ session: tSession() });
    await screen.findByText(`${L.stationTitle} — TO-20261012-0001`);
    expect(get).toHaveBeenCalledWith(PACK_PATH, expect.anything());
    expect(get).not.toHaveBeenCalledWith(PACKS_PATH, expect.anything());
  });
});

describe("trạm đóng gói chuyển kho — tên người đóng (BE PR #164 final: packerName)", () => {
  it("người khác đang đóng: cột trạng thái và thông báo nêu tên, không rút gọn id", async () => {
    renderTransferPackStation({
      session: tSession({ packerId: OTHER_PACKER_ID, packerName: "Nguyễn Lan" }),
    });
    expect(await screen.findByText(L.notice.takenByOther("Nguyễn Lan"))).toBeInTheDocument();
    expect(screen.getAllByText("Nguyễn Lan").length).toBeGreaterThan(0);
  });

  it("chính mình là người đóng → 'Bạn'; chưa có tên (dữ liệu cũ) → id rút gọn", async () => {
    renderTransferPackStation({ session: tSession({ packerName: "Tôi" }) });
    expect(await screen.findByText(L.status.you)).toBeInTheDocument();
    document.body.innerHTML = "";
    renderTransferPackStation({ session: tSession({ packerId: OTHER_PACKER_ID }) });
    expect(await screen.findByText(shortId(OTHER_PACKER_ID))).toBeInTheDocument();
  });

  it("BE PACKING_TAKEN khi mở kiện: toast nêu tên người đang đóng (lấy từ phiên đã tải)", async () => {
    const user = userEvent.setup();
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => "id");
    renderTransferPackStation({
      identity: IDENTITIES.warehouseManager,
      session: tSession({ packerId: OTHER_PACKER_ID, packerName: "Nguyễn Lan" }),
      post: () => ({
        [`${PACK_PATH}/packages`]: () => {
          throw new ApiError(409, "PACKING_TAKEN", "taken");
        },
      }),
    });
    await user.click(
      await screen.findByRole("button", { name: UI_LABELS.packing.action.openPackage }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError).toHaveBeenCalledWith(L.notice.takenByOther("Nguyễn Lan"));
    expect(toastError).not.toHaveBeenCalledWith(TRANSFER_PACK_ERROR_MESSAGES.PACKING_TAKEN);
  });
});
