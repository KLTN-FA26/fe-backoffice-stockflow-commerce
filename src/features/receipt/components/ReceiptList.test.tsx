import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PO_ID,
  apiBlindReceipt,
  apiReceipt,
  apiReceiptPage,
  receivablePo,
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
  const spies = mockReceiptApi(permissions, {
    "/goods-receipts": () => page,
    "/purchase-orders": () => bePage([receivablePo]),
  });
  renderReceiptScreen(<ReceiptList />, searchParams);
  return spies;
}

describe("ReceiptList — danh sách phiếu nhận (BE GET /goods-receipts)", () => {
  it("hiện phiếu với số PO tra từ /purchase-orders khi có quyền đọc PO", async () => {
    renderList(ROLES.warehouseManager);
    expect(await screen.findByRole("link", { name: "GR-20261009-0001" })).toBeInTheDocument();
    expect(await screen.findByText("PO-HCM-DEMO-0002")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Tạo phiếu nhận/ })).toBeInTheDocument();
  });

  it("NV kho (seed BE thiếu purchase-orders:READ): không gọi API PO, không có nút tạo phiếu", async () => {
    const { get } = renderList(ROLES.warehouseStaff);
    expect(await screen.findByRole("link", { name: "GR-20261009-0001" })).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => url === "/purchase-orders")).toBe(false);
    expect(screen.queryByRole("link", { name: /Tạo phiếu nhận/ })).not.toBeInTheDocument();
  });

  it("filter trên URL → gửi đúng tham số BE (status mã BE, ngày theo giờ VN, PO)", async () => {
    const { get } = renderList(
      ROLES.warehouseManager,
      apiReceiptPage(),
      `?status=In+QC&from=2026-10-01&to=2026-10-09&po=${PO_ID}&sort=receivedAt,asc`,
    );
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    const call = get.mock.calls.find(([url]) => url === "/goods-receipts");
    expect(call?.[1]?.params).toMatchObject({
      page: 0,
      status: ["IN_QC"],
      purchaseOrderId: PO_ID,
      receivedFrom: "2026-09-30T17:00:00.000Z",
      receivedTo: "2026-10-09T17:00:00.000Z",
      sort: "receivedAt,asc",
    });
  });

  it("hai EmptyState khác nhau: chưa có phiếu vs lọc không ra", async () => {
    renderList(ROLES.warehouseManager, bePage([]));
    expect(await screen.findByText("Chưa có phiếu nhận")).toBeInTheDocument();
    vi.restoreAllMocks();
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

  it("phiếu In QC hiện badge trạng thái tiếng Việt", async () => {
    renderList(ROLES.qcStaff, apiReceiptPage([apiReceipt({ status: "IN_QC" })]));
    expect(await screen.findByText("Đang kiểm QC")).toBeInTheDocument();
  });

  it("bộ lọc trạng thái không có 'Confirmed' — BE không lưu phiếu ở trạng thái này", () => {
    expect(STATUS_OPTIONS.map((o) => o.value)).toEqual([
      "Draft",
      "Pending Approval",
      "In QC",
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

describe("ReceiptList — hàng về không có PO (BR-RCP-002)", () => {
  it("phiếu không có PO hiện huy hiệu 'Không có PO' + NCC thay cho số PO", async () => {
    renderList(ROLES.warehouseManager, apiReceiptPage([apiBlindReceipt()]));
    expect(await screen.findByText("Không có PO")).toBeInTheDocument();
    expect(screen.getByText("Xưởng gỗ Việt")).toBeInTheDocument();
  });

  it("có nút 'Nhận hàng không có PO' khi có quyền xem NCC + kho; NV kho (thiếu) không thấy", async () => {
    renderList(ROLES.warehouseManager);
    expect(await screen.findByRole("link", { name: /Nhận hàng không có PO/ })).toHaveAttribute(
      "href",
      "/admin/receipts/create?mode=without-po",
    );
    cleanup();
    renderList(ROLES.warehouseStaff);
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    expect(screen.queryByRole("link", { name: /Nhận hàng không có PO/ })).not.toBeInTheDocument();
  });

  it("bộ lọc 'Chỉ phiếu không có PO' gửi withoutPo=true; URL ?noPo=true cũng vậy", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ROLES.warehouseManager);
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    await user.click(screen.getByRole("checkbox", { name: "Chỉ phiếu không có PO" }));
    await waitFor(() => {
      const calls = get.mock.calls.filter(([url]) => url === "/goods-receipts");
      expect(calls.at(-1)?.[1]?.params).toMatchObject({ withoutPo: true });
    });
    cleanup();
    const second = renderList(ROLES.warehouseManager, apiReceiptPage(), "?noPo=true");
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    // Cùng spy `api.get` với lần render trước: lấy lần gọi cuối
    expect(
      second.get.mock.calls.filter(([url]) => url === "/goods-receipts").at(-1)?.[1]?.params,
    ).toMatchObject({ withoutPo: true });
  });
});
