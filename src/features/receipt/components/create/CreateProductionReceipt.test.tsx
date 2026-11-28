import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ADMIN_ROUTES, RECEIPT_COUNT_LABELS, RECEIPT_ERROR_MESSAGES } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { openComboboxList } from "@/test/combobox";

import { HCM_ID, RECEIPT_ID, apiReceipt, apiReceiptPage } from "../../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  bePage,
  mockReceiptApi,
  renderReceiptScreen,
} from "../../__fixtures__/render";
import { ReceiptList } from "../ReceiptList";

import type { PermissionCode } from "@/lib/auth";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

const L = RECEIPT_COUNT_LABELS.create;

function productionOrder(id: string, code: string, status: string, sampleApprovalRequired = false) {
  return {
    id,
    code,
    status,
    receivingWarehouseId: HCM_ID,
    sampleApprovalRequired,
    needByDate: "2026-11-30",
    lines: [
      {
        id: `${id}-L1`,
        sku: "CUP-PRINT-ACME-12OZ",
        cartons: 10,
        unitsPerCarton: 50,
        receivedCartons: 4,
      },
    ],
  };
}

/** BE lọc một `status` mỗi lần — mock trả đơn theo đúng status được hỏi. */
const ORDERS_BY_STATUS: Record<string, unknown[]> = {
  IN_PRODUCTION: [productionOrder("po-1", "PRD-20261101-0001", "IN_PRODUCTION")],
  PARTIALLY_RECEIVED: [],
  // BR-15: đơn bật cờ duyệt mẫu in còn SENT → không nhận được, không hiện trong ô chọn
  SENT: [productionOrder("po-2", "PRD-20261101-0002", "SENT", true)],
  ACCEPTED: [productionOrder("po-3", "PRD-20261101-0003", "ACCEPTED")],
};

function renderList(
  permissions: readonly PermissionCode[],
  onCreate?: (body: unknown) => unknown,
  inProduction: unknown[] = ORDERS_BY_STATUS.IN_PRODUCTION ?? [],
) {
  const spies = mockReceiptApi(
    permissions,
    {
      "/goods-receipts": () => apiReceiptPage(),
      "/production-orders": (params) => {
        const status = (params as { status: string }).status;
        return bePage(status === "IN_PRODUCTION" ? inProduction : (ORDERS_BY_STATUS[status] ?? []));
      },
    },
    { "/goods-receipts/production": (_p, body) => (onCreate ? onCreate(body) : apiReceipt()) },
  );
  renderReceiptScreen(<ReceiptList />);
  return spies;
}

describe("Lập phiếu nhập theo Đơn sản xuất (docs 03 §4.1 bước 1)", () => {
  it("chọn Đơn sản xuất nhận được hàng → POST đúng body, sang trang chi tiết để kiểm đếm", async () => {
    const user = userEvent.setup();
    const { post, get } = renderList(ROLES.warehouseManager);

    await user.click(await screen.findByRole("button", { name: L.button }));
    await openComboboxList(user, L.productionOrder);
    expect(await screen.findByRole("option", { name: /PRD-20261101-0001/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /PRD-20261101-0003/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /PRD-20261101-0002/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /PRD-20261101-0001/ }));
    await user.type(screen.getByLabelText(L.deliveryNote), "PG-7781");
    await user.click(screen.getByRole("button", { name: L.submit }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(ADMIN_ROUTES.receipts.detail(RECEIPT_ID)),
    );
    expect(post).toHaveBeenCalledWith("/goods-receipts/production", {
      productionOrderId: "po-1",
      deliveryNote: "PG-7781",
      note: undefined,
    });
    const statuses = get.mock.calls
      .filter(([url]) => url === "/production-orders")
      .map(([, config]) => (config as { params: { status: string } }).params.status);
    expect(new Set(statuses)).toEqual(
      new Set(["IN_PRODUCTION", "PARTIALLY_RECEIVED", "SENT", "ACCEPTED"]),
    );
  });

  it("quét / gõ đủ mã Đơn sản xuất + Enter → chọn đúng mã đó, không chọn mã dài hơn chứa nó", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ROLES.warehouseManager, undefined, [
      productionOrder("po-10", "PRD-20261101-00010", "IN_PRODUCTION"),
      productionOrder("po-1", "PRD-20261101-0001", "IN_PRODUCTION"),
    ]);
    await user.click(await screen.findByRole("button", { name: L.button }));
    const box = await screen.findByRole("combobox", { name: L.productionOrder });
    // Danh sách đơn tải xong rồi mới quét (máy quét gõ nhanh; ở đây chờ dữ liệu để không phụ thuộc thời gian)
    await openComboboxList(user, L.productionOrder);
    await screen.findByRole("option", { name: /PRD-20261101-00010/ });
    await user.keyboard("{Escape}");
    await user.type(box, "PRD-20261101-0001{Enter}");
    expect(box).toHaveValue("PRD-20261101-0001");
    await user.click(screen.getByRole("button", { name: L.submit }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/goods-receipts/production", {
        productionOrderId: "po-1",
        deliveryNote: undefined,
        note: undefined,
      }),
    );
  });

  it("chưa chọn Đơn sản xuất → báo lỗi ở ô, không gọi BE", async () => {
    const user = userEvent.setup();
    const { post } = renderList(ROLES.warehouseManager);
    await user.click(await screen.findByRole("button", { name: L.button }));
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(await screen.findByText("Chọn Đơn sản xuất")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("BE từ chối (Đơn sản xuất vừa hết nhận được) → câu tiếng Việt trong dialog, không điều hướng", async () => {
    const user = userEvent.setup();
    const { get } = renderList(ROLES.warehouseManager, () => {
      throw new ApiError(409, "PRODUCTION_ORDER_NOT_RECEIVABLE", "Production order is RECEIVED");
    });
    const listCalls = () => get.mock.calls.filter(([url]) => url === "/production-orders").length;
    await user.click(await screen.findByRole("button", { name: L.button }));
    await openComboboxList(user, L.productionOrder);
    await user.click(await screen.findByRole("option", { name: /PRD-20261101-0001/ }));
    const before = listCalls();
    await user.click(screen.getByRole("button", { name: L.submit }));
    expect(
      await screen.findByText(RECEIPT_ERROR_MESSAGES.PRODUCTION_ORDER_NOT_RECEIVABLE),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    // Câu báo "Dữ liệu đã được tải lại" phải đúng: ô chọn Đơn sản xuất tải lại danh sách
    await waitFor(() => expect(listCalls()).toBeGreaterThan(before));
  });

  it("NV kho thiếu production-orders:READ → nút khoá kèm lý do", async () => {
    renderList(ROLES.warehouseStaff);
    const button = await screen.findByRole("button", { name: L.button });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(RECEIPT_COUNT_LABELS.noProductionRead);
  });

  it("chỉ đọc phiếu (không có goods-receipts:CREATE) → không có nút lập phiếu", async () => {
    renderList(ROLES.reader);
    await screen.findByRole("link", { name: "GR-20261009-0001" });
    expect(screen.queryByRole("button", { name: L.button })).not.toBeInTheDocument();
  });
});
