import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { PO_ID, SOFA_PO_LINE_ID, apiLine, apiReceipt, receivablePo } from "../__fixtures__/receipt";
import {
  RECEIPT_ROLE_PERMISSIONS as ROLES,
  bePage,
  mockReceiptApi,
  renderReceiptScreen,
} from "../__fixtures__/render";
import { ReceiptCreate } from "./ReceiptCreate";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

function renderCreate(
  permissions: Parameters<typeof mockReceiptApi>[0],
  po = receivablePo,
  existing: ReturnType<typeof apiReceipt>[] = [],
) {
  const spies = mockReceiptApi(
    permissions,
    {
      "/purchase-orders": () => bePage([po]),
      [`/purchase-orders/${PO_ID}`]: () => po,
      "/goods-receipts": () => bePage(existing.map(({ lines: _l, ...row }) => row)),
    },
    { "/goods-receipts": () => apiReceipt() },
  );
  renderReceiptScreen(<ReceiptCreate />, `?poId=${PO_ID}`);
  return spies;
}

describe("ReceiptCreate — tạo phiếu nhận từ PO (BR-01)", () => {
  it("PO từ link được chọn sẵn, hiện dòng còn mở; tạo phiếu → POST rồi sang chi tiết", async () => {
    const user = userEvent.setup();
    const { post, get } = renderCreate(ROLES.warehouseManager);
    expect((await screen.findAllByText("SOFA-3S-GREY")).length).toBeGreaterThan(0);
    // Chỉ hỏi PO đã chốt / đang nhận dở
    const list = get.mock.calls.find(([url]) => url === "/purchase-orders");
    expect(list?.[1]?.params).toMatchObject({ status: ["CONFIRMED", "PARTIALLY_RECEIVED"] });
    await user.type(screen.getByLabelText("Số phiếu giao"), "DN-001");
    await user.click(screen.getByRole("button", { name: "Tạo phiếu nhận" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/goods-receipts", {
        purchaseOrderId: PO_ID,
        deliveryNote: "DN-001",
        note: undefined,
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/admin/receipts/${apiReceipt().id}`));
  });

  it("PO từ link không đọc được (404) → báo lỗi và khoá nút tạo", async () => {
    mockReceiptApi(ROLES.warehouseManager, {
      "/purchase-orders": () => bePage([receivablePo]),
      [`/purchase-orders/${PO_ID}`]: () => {
        throw new ApiError(404, "PURCHASE_ORDER_NOT_FOUND", `No purchase order ${PO_ID}`);
      },
      "/goods-receipts": () => bePage([]),
    });
    renderReceiptScreen(<ReceiptCreate />, `?poId=${PO_ID}`);
    expect(await screen.findByText("Không tải được dòng của đơn đặt hàng.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo phiếu nhận" })).toBeDisabled();
  });

  it("PO không còn nhận được (đã đóng) → báo và khoá nút tạo", async () => {
    renderCreate(ROLES.warehouseManager, { ...receivablePo, status: "CLOSED" });
    expect(await screen.findByText(/không tạo phiếu nhận được/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo phiếu nhận" })).toBeDisabled();
  });

  it("NV kho theo seed BE (thiếu purchase-orders:READ) → báo cần quyền, không gọi API PO", async () => {
    const { get } = renderCreate(ROLES.warehouseStaff);
    expect(await screen.findByText("Cần quyền xem đơn đặt hàng")).toBeInTheDocument();
    expect(get.mock.calls.some(([url]) => String(url).startsWith("/purchase-orders"))).toBe(false);
  });

  it("NV QC (không có CREATE) → chặn route", async () => {
    renderCreate(ROLES.qcStaff);
    expect(await screen.findByText("Bạn không có quyền")).toBeInTheDocument();
  });

  it("PO đã có phiếu nháp → cảnh báo kèm link phiếu đó, vẫn cho tạo", async () => {
    const draft = apiReceipt({
      lines: [apiLine({ purchaseOrderLineId: SOFA_PO_LINE_ID, quantity: 4 })],
    });
    renderCreate(ROLES.warehouseManager, receivablePo, [draft]);
    expect(await screen.findByRole("link", { name: draft.number })).toHaveAttribute(
      "href",
      `/admin/receipts/${draft.id}`,
    );
    expect(screen.getByText(/đã có phiếu nhận nháp/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo phiếu nhận" })).toBeEnabled();
  });
});
