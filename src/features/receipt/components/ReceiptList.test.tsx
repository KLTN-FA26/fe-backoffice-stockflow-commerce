import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_LABELS } from "@/constants";

import {
  PRODUCTION_ORDER_ID,
  apiPurchaseReceipt,
  apiReceipt,
  apiReceiptPage,
} from "../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  bePage,
  mockReceiptApi,
  renderReceiptScreen,
} from "../__fixtures__/render";
import { STATUS_OPTIONS } from "./list/constants";
import { ReceiptList } from "./ReceiptList";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

function renderList(
  permissions: readonly PermissionCode[],
  page: unknown = apiReceiptPage(),
  searchParams = "",
) {
  const spies = mockReceiptApi(permissions, { "/goods-receipts": () => page });
  renderReceiptScreen(<ReceiptList />, searchParams);
  return spies;
}

describe("ReceiptList — danh sách phiếu nhận (BE GET /goods-receipts)", () => {
  it("hiện phiếu kèm Đơn sản xuất + đơn vị sản xuất; không gọi API mua hàng, không có nút tạo theo PO", async () => {
    const { get } = renderList(ROLES.warehouseManager);
    expect(await screen.findByRole("link", { name: "GR-20261009-0001" })).toBeInTheDocument();
    expect(screen.getByText("PO-HCM-0007")).toBeInTheDocument();
    expect(screen.getByText("Xưởng in Ánh Dương")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/purchase-orders")).toBe(false);
    expect(get.mock.calls.some(([url]) => url === "/suppliers")).toBe(false);
    expect(screen.queryByRole("link", { name: /Tạo phiếu nhận/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /không có PO/ })).not.toBeInTheDocument();
  });

  it("phiếu mua hàng cũ hiện loại 'Mua hàng (cũ)', cột Đơn sản xuất trống", async () => {
    renderList(ROLES.warehouseStaff, apiReceiptPage([apiPurchaseReceipt()]));
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    expect(screen.getByText(UI_LABELS.receipt.receiptType.PURCHASE)).toBeInTheDocument();
    expect(screen.queryByText("PO-HCM-0007")).not.toBeInTheDocument();
  });

  it("filter trên URL → gửi đúng tham số BE (status mã BE, ngày theo giờ VN, Đơn sản xuất)", async () => {
    const { get } = renderList(
      ROLES.reader,
      apiReceiptPage(),
      `?status=In+Putaway&from=2026-10-01&to=2026-10-09&productionOrder=${PRODUCTION_ORDER_ID}&sort=receivedAt,asc`,
    );
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    const call = get.mock.calls.find(([url]) => url === "/goods-receipts");
    const params = call?.[1]?.params as Record<string, unknown>;
    expect(params).toMatchObject({
      page: 0,
      status: ["IN_PUTAWAY"],
      productionOrderId: PRODUCTION_ORDER_ID,
      receivedFrom: "2026-09-30T17:00:00.000Z",
      receivedTo: "2026-10-09T17:00:00.000Z",
      sort: "receivedAt,asc",
    });
    expect(params).not.toHaveProperty("purchaseOrderId");
    expect(params).not.toHaveProperty("withoutPo");
    expect(screen.getByRole("button", { name: "Bỏ lọc Đơn sản xuất" })).toBeInTheDocument();
    // Chip lọc hiện mã Đơn sản xuất (cùng ô của bảng); id trên URL không hiện ở đâu
    expect(screen.getAllByText("PO-HCM-0007")).toHaveLength(2);
    expect(screen.queryByText(PRODUCTION_ORDER_ID)).not.toBeInTheDocument();
  });

  it("lọc theo Đơn sản xuất mà không phiếu nào khớp → chip đành hiện id", async () => {
    renderList(ROLES.reader, bePage([]), `?productionOrder=${PRODUCTION_ORDER_ID}`);
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.getAllByText(PRODUCTION_ORDER_ID).length).toBeGreaterThanOrEqual(1);
  });

  it("chưa có phiếu → EmptyState 'Chưa có phiếu nhận' không có nút tạo", async () => {
    renderList(ROLES.warehouseManager, bePage([]));
    expect(await screen.findByText("Chưa có phiếu nhận")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Tạo phiếu nhận/ })).not.toBeInTheDocument();
  });

  it("lọc không ra kết quả → 'Không tìm thấy kết quả' + nút Bỏ bộ lọc", async () => {
    renderList(ROLES.warehouseManager, bePage([]), "?status=Closed");
    expect(await screen.findByText("Không tìm thấy kết quả")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bỏ bộ lọc" })).toBeInTheDocument();
  });

  it("có VIEW_PAGE nhưng thiếu READ → báo không có quyền xem dữ liệu, không gọi API", async () => {
    const { get } = renderList(ROLES.viewOnly);
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    await waitFor(() =>
      expect(get.mock.calls.some(([url]) => url === "/goods-receipts")).toBe(false),
    );
  });

  it("thiếu VIEW_PAGE → chặn route", async () => {
    renderList([]);
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
  });

  it("phiếu đang cất hiện badge trạng thái tiếng Việt", async () => {
    renderList(ROLES.reader, apiReceiptPage([apiReceipt({ status: "IN_PUTAWAY" })]));
    expect(await screen.findByText("Đang cất")).toBeInTheDocument();
  });

  it("bộ lọc trạng thái chỉ có 4 trạng thái docs 03 §5 (không Confirmed / Pending Approval / In QC)", () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "Draft",
      "In Putaway",
      "Closed",
      "Cancelled",
    ]);
  });

  it("khoảng ngày ngược (từ > đến) → cảnh báo ngay dưới bộ lọc", async () => {
    renderList(ROLES.warehouseManager, apiReceiptPage([]), "?from=2026-10-09&to=2026-10-01");
    expect(await screen.findByText(/Ngày bắt đầu sau ngày kết thúc/)).toBeInTheDocument();
  });
});
