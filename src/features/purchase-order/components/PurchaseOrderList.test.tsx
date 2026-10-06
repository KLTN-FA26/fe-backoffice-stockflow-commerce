import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  PO_PERMISSION_SETS,
  SUPPLIER_REF,
  bePage,
  bePo,
  mockApi,
  renderPoScreen,
} from "../__fixtures__/render";
import { PurchaseOrderList } from "./PurchaseOrderList";

import type { PermissionCode } from "@/lib/auth";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

const DASHBOARD = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "CLOSED",
  "CLOSED_SHORT",
  "CANCELLED",
].map((status) => ({ status, count: 0 }));

function renderList(
  permissions: readonly PermissionCode[],
  searchParams = "",
  items: unknown[] = [bePo({ currency: "EUR", totalAmount: 750 })],
) {
  const spies = mockApi(permissions, {
    "/purchase-orders": () => bePage(items),
    "/purchase-orders/reports/status-dashboard": () => DASHBOARD,
    [`/suppliers/${SUPPLIER_REF.supplierId}`]: () => SUPPLIER_REF,
  });
  renderPoScreen(<PurchaseOrderList />, searchParams);
  return spies;
}

/** Params của lần gọi `GET /purchase-orders` gần nhất. */
function lastListParams(get: ReturnType<typeof mockApi>["get"]) {
  const calls = get.mock.calls.filter(([url]) => url === "/purchase-orders");
  return (calls.at(-1)?.[1] as { params?: Record<string, unknown> } | undefined)?.params;
}

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("PurchaseOrderList", () => {
  it("có VIEW_PAGE nhưng thiếu READ → không gọi API danh sách", async () => {
    const { get } = renderList(PO_PERMISSION_SETS.viewOnly);
    expect(await screen.findByText("Bạn không có quyền xem dữ liệu")).toBeInTheDocument();
    expect(lastListParams(get)).toBeUndefined();
  });

  it("search trong cột đọc từ URL (?colPoNumber=) — F5 / gửi link giữ nguyên bộ lọc", async () => {
    renderList(PO_PERMISSION_SETS.readOnly, "?colPoNumber=000002", [
      bePo({ purchaseOrderId: "po-1", poNumber: "PO-20261001-000001" }),
      bePo({ purchaseOrderId: "po-2", poNumber: "PO-20261001-000002" }),
    ]);
    expect(await screen.findByText("PO-20261001-000002")).toBeInTheDocument();
    expect(screen.queryByText("PO-20261001-000001")).not.toBeInTheDocument();
  });

  it("đọc ?supplierId= từ URL, gửi lên BE (trang từ 0) và hiện badge lọc theo NCC", async () => {
    const { get } = renderList(
      PO_PERMISSION_SETS.readOnly,
      `?supplierId=${SUPPLIER_REF.supplierId}`,
    );
    await waitFor(() =>
      expect(lastListParams(get)).toMatchObject({ supplierId: SUPPLIER_REF.supplierId, page: 0 }),
    );
    expect(await screen.findByText(/Đang lọc theo NCC/)).toBeInTheDocument();
    expect(await screen.findAllByText(/GOHOAPHAT — Gỗ Hòa Phát/)).not.toHaveLength(0);
  });

  it("bỏ lọc NCC → gọi lại BE không còn supplierId", async () => {
    const user = userEvent.setup();
    const { get } = renderList(
      PO_PERMISSION_SETS.readOnly,
      `?supplierId=${SUPPLIER_REF.supplierId}`,
    );
    await user.click(await screen.findByRole("button", { name: "Bỏ lọc NCC" }));
    await waitFor(() => expect(lastListParams(get)?.supplierId).toBeUndefined());
  });

  it("?supplierId= sai định dạng (BE 400) → báo bộ lọc NCC sai, không báo 'không tìm thấy đơn'", async () => {
    const user = userEvent.setup();
    const { get } = mockApi(PO_PERMISSION_SETS.readOnly, {
      "/purchase-orders": (params) => {
        if (isRecord(params) && params.supplierId === "abc") {
          throw new ApiError(400, "VALIDATION_FAILED", "Invalid request data");
        }
        return bePage([bePo()]);
      },
      "/purchase-orders/reports/status-dashboard": () => DASHBOARD,
      "/suppliers/abc": () => {
        throw new ApiError(400, "VALIDATION_FAILED", "Invalid request data");
      },
      [`/suppliers/${SUPPLIER_REF.supplierId}`]: () => SUPPLIER_REF,
    });
    renderPoScreen(<PurchaseOrderList />, "?supplierId=abc");
    expect(await screen.findByText("Bộ lọc nhà cung cấp không hợp lệ")).toBeInTheDocument();
    expect(screen.queryByText("Không tìm thấy đơn đặt hàng")).not.toBeInTheDocument();
    // Badge lọc không lộ mã thô khi không tra được NCC
    expect(await screen.findByText("Không tải được tên NCC")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Bỏ lọc NCC" })[0] ?? document.body);
    await waitFor(() => expect(lastListParams(get)?.supplierId).toBeUndefined());
    expect(await screen.findByText(/PO-20261002-000001/)).toBeInTheDocument();
    expect(screen.queryByText(/Đang lọc theo NCC/)).not.toBeInTheDocument();
  });

  it("đơn cần xử lý (gửi NCC thất bại / NCC từ chối) hiện lý do; đơn đã huỷ thì không", async () => {
    renderList(PO_PERMISSION_SETS.readOnly, "", [
      bePo({
        purchaseOrderId: "11111111-1111-4111-8111-111111111111",
        poNumber: "PO-FAILED",
        status: "SENT",
        supplierConfirmationStatus: "PENDING",
        deliveryStatus: "FAILED",
      }),
      bePo({
        purchaseOrderId: "22222222-2222-4222-8222-222222222222",
        poNumber: "PO-REJECTED",
        status: "SENT",
        supplierConfirmationStatus: "REJECTED",
        deliveryStatus: "DELIVERED",
      }),
      bePo({
        purchaseOrderId: "33333333-3333-4333-8333-333333333333",
        poNumber: "PO-CANCELLED",
        status: "CANCELLED",
        deliveryStatus: "FAILED",
      }),
    ]);
    expect(await screen.findByText("Gửi NCC thất bại — cần khôi phục gửi")).toBeInTheDocument();
    expect(screen.getByText("NCC từ chối — huỷ và tạo đơn mới")).toBeInTheDocument();
    expect(screen.getAllByText(/Gửi NCC thất bại|NCC từ chối —/)).toHaveLength(2);
  });

  it("tiền hiện theo tiền tệ của PO (EUR không thành ₫)", async () => {
    renderList(PO_PERMISSION_SETS.readOnly);
    const cell = await screen.findByText(/750/);
    expect(cell.textContent).toContain("€");
  });

  it("không có quyền CREATE → không có nút Tạo đơn đặt hàng", async () => {
    renderList(PO_PERMISSION_SETS.readOnly);
    await screen.findByText(/PO-20261002-000001/);
    expect(screen.queryByRole("button", { name: /Tạo đơn đặt hàng/ })).not.toBeInTheDocument();
  });

  it("lọc không ra kết quả ≠ chưa có PO (hai EmptyState khác nhau)", async () => {
    renderList(PO_PERMISSION_SETS.readOnly, "?status=CANCELLED", []);
    expect(await screen.findByText("Không tìm thấy đơn đặt hàng")).toBeInTheDocument();
  });

  it("chưa có PO nào → EmptyState 'Chưa có đơn đặt hàng'", async () => {
    renderList(PO_PERMISSION_SETS.procurement, "", []);
    expect(await screen.findByText("Chưa có đơn đặt hàng")).toBeInTheDocument();
  });
});
