import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { RECEIPT_ID, apiLine, apiPurchaseReceipt, apiReceipt } from "../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  mockReceiptApi,
  renderReceiptScreen,
} from "../__fixtures__/render";
import { ReceiptDetail } from "./ReceiptDetail";

import type { PermissionCode } from "@/lib/auth";
import type { GoodsReceiptApiDto } from "../types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const PATH = `/goods-receipts/${RECEIPT_ID}`;
const LABEL = UI_LABELS.receipt;
const ACTION_BUTTONS = /Xác nhận nhập kho|Huỷ phiếu|Duyệt|Từ chối|Chuyển sang khu QC|Kết luận QC/;

function renderDetail(permissions: readonly PermissionCode[], receipt: GoodsReceiptApiDto) {
  const spies = mockReceiptApi(
    permissions,
    { [PATH]: () => receipt },
    {
      [`${PATH}/confirmation`]: () => ({ ...receipt, status: "IN_PUTAWAY" }),
      [`${PATH}/cancellation`]: () => ({ ...receipt, status: "CANCELLED" }),
    },
  );
  renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
  return spies;
}

describe("ReceiptDetail — phiếu theo Đơn sản xuất (docs 03 §4.1)", () => {
  it("hiện Đơn sản xuất, đơn vị sản xuất, người nhận và tiến độ thùng của dòng", async () => {
    renderDetail(ROLES.reader, apiReceipt({ status: "IN_PUTAWAY", lines: [apiLine()] }));
    // Mã Đơn sản xuất vừa ở thông tin phiếu vừa là lô của dòng (lô = mã Đơn sản xuất)
    expect(await screen.findAllByText("PO-HCM-0007")).toHaveLength(2);
    expect(screen.getByText("Xưởng in Ánh Dương")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn Kho")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: /Dòng nhận của phiếu/ });
    expect(
      within(table).getByRole("columnheader", { name: "Thùng theo Đơn SX" }),
    ).toBeInTheDocument();
    expect(within(table).getByText("4/10")).toBeInTheDocument();
    expect(within(table).getByText("phiếu này 2")).toBeInTheDocument();
    expect(within(table).getByText("còn 4")).toBeInTheDocument();
    expect(screen.queryByText(LABEL.legacyPurchase.title)).not.toBeInTheDocument();
  });

  it.each([
    ["NV kho", ROLES.warehouseStaff],
    ["Quản lý kho", ROLES.warehouseManager],
  ] as const)("Draft có dòng + %s → Xác nhận nhập kho và Huỷ phiếu", async (_role, permissions) => {
    renderDetail(permissions, apiReceipt({ lines: [apiLine()] }));
    expect(await screen.findByRole("button", { name: LABEL.action.confirm })).toBeEnabled();
    expect(screen.getByRole("button", { name: LABEL.action.cancel })).toBeEnabled();
  });

  it("Draft + chỉ đọc (thiếu UPDATE) → không nút thao tác, báo chỉ có quyền xem", async () => {
    renderDetail(ROLES.reader, apiReceipt({ lines: [apiLine()] }));
    expect(await screen.findByText(LABEL.noActions.viewOnly)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACTION_BUTTONS })).not.toBeInTheDocument();
  });

  it("Draft chưa có dòng → nút xác nhận khoá kèm lý do", async () => {
    renderDetail(ROLES.warehouseStaff, apiReceipt());
    expect(await screen.findByRole("button", { name: LABEL.action.confirm })).toBeDisabled();
    expect(screen.getByText(LABEL.disabledReason.noLines)).toBeInTheDocument();
  });

  it("xác nhận qua ConfirmDialog → POST /confirmation", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ROLES.warehouseStaff, apiReceipt({ lines: [apiLine()] }));
    await user.click(await screen.findByRole("button", { name: LABEL.action.confirm }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: LABEL.action.confirm }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/confirmation`, undefined));
  });

  it("huỷ phiếu nháp qua ConfirmDialog → POST /cancellation", async () => {
    const user = userEvent.setup();
    const { post } = renderDetail(ROLES.warehouseManager, apiReceipt({ lines: [apiLine()] }));
    await user.click(await screen.findByRole("button", { name: LABEL.action.cancel }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: LABEL.action.cancel }));
    await waitFor(() => expect(post).toHaveBeenCalledWith(`${PATH}/cancellation`, undefined));
  });

  it("In Putaway: không nút mutating, card báo chờ cất hàng, bảng có cột Chờ cất", async () => {
    renderDetail(
      ROLES.warehouseManager,
      apiReceipt({ status: "IN_PUTAWAY", lines: [apiLine({ quantityForPutaway: 100 })] }),
    );
    expect(await screen.findByText(LABEL.noActions.inPutaway)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACTION_BUTTONS })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Chờ cất" })).toBeInTheDocument();
  });

  it("Closed: không còn nút thao tác nào", async () => {
    renderDetail(ROLES.warehouseManager, apiReceipt({ status: "CLOSED", lines: [apiLine()] }));
    expect(await screen.findByText(/không còn thao tác/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACTION_BUTTONS })).not.toBeInTheDocument();
  });

  it("Cancelled có dòng: hiện như kết quả kiểm đếm, không có cột chờ cất", async () => {
    renderDetail(ROLES.warehouseManager, apiReceipt({ status: "CANCELLED", lines: [apiLine()] }));
    expect(await screen.findByText(LABEL.linesCancelledDescription)).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Chờ cất" })).not.toBeInTheDocument();
  });

  it("phiếu không có dòng → báo chưa có dòng, không để bảng trống", async () => {
    renderDetail(ROLES.warehouseManager, apiReceipt({ status: "CANCELLED", lines: [] }));
    expect(await screen.findByText(LABEL.noCountLines)).toBeInTheDocument();
  });

  it("phiếu không tồn tại → màn không tìm thấy", async () => {
    mockReceiptApi(ROLES.warehouseManager, {
      [PATH]: () => {
        throw new ApiError(404, "GOODS_RECEIPT_NOT_FOUND", `No goods receipt ${RECEIPT_ID}`);
      },
    });
    renderReceiptScreen(<ReceiptDetail id={RECEIPT_ID} />);
    expect(await screen.findByText(LABEL.notFoundTitle)).toBeInTheDocument();
  });

  it("có VIEW_PAGE nhưng thiếu READ → không gọi API phiếu", async () => {
    const { get } = renderDetail(ROLES.viewOnly, apiReceipt());
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === PATH)).toBe(false);
  });
});

describe("ReceiptDetail — phiếu mua hàng cũ (BE 4A-8)", () => {
  it("Draft: báo phiếu mua hàng cũ, chỉ còn nút huỷ — không xác nhận được", async () => {
    renderDetail(ROLES.warehouseManager, apiPurchaseReceipt());
    expect(await screen.findByText(LABEL.legacyPurchase.title)).toBeInTheDocument();
    expect(screen.getByText(LABEL.receiptType.PURCHASE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: LABEL.action.cancel })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: LABEL.action.confirm })).not.toBeInTheDocument();
  });

  it("đã cất xong: chỉ xem, dòng không có tiến độ Đơn sản xuất", async () => {
    renderDetail(ROLES.warehouseManager, apiPurchaseReceipt({ status: "CLOSED" }));
    expect(await screen.findByText(LABEL.legacyPurchase.title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ACTION_BUTTONS })).not.toBeInTheDocument();
    expect(screen.queryByText(/còn \d+/)).not.toBeInTheDocument();
  });
});
