/**
 * Chi tiết đơn — khối "Giao thất bại" (WF-05 GH-1; BE `DeliveryFailureController`): action-gating theo vai, gửi đúng
 * body BE nhận (`note`, `failedTripFee` chỉ khi khách gây ra), huỷ khi lô về chưa có hồ sơ.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { apiOrder, apiOrderWith, apiPartialOrder } from "../__fixtures__/order";
import { DETAIL_PATH } from "../__fixtures__/detail";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

const FAILURES_PATH = `${DETAIL_PATH}/delivery-failures`;
const SHIPMENT_ID = apiPartialOrder.shipments?.[0]?.shipmentId ?? "";
const heldOrder = apiOrderWith({
  ...apiPartialOrder,
  status: "ON_HOLD",
  holdReason: "DELIVERY_FAILED",
  shipments: [{ ...apiPartialOrder.shipments?.[0], status: "RETURNED" }],
});
const openCase = {
  caseId: "c0000000-0000-4000-8000-000000000001",
  orderId: apiOrder.orderId,
  orderNumber: apiOrder.orderNumber,
  shipmentId: SHIPMENT_ID,
  receiptNumber: "RR-20261110-0001",
  failureReason: "REFUSED",
  customerPaysFailedTrip: true,
  status: "OPEN",
  openedAt: "2026-11-10T03:00:00Z",
  lines: [{ orderLineId: "l1", units: 1, heldUnits: 0 }],
  cartons: [],
};

async function renderWith(permissions: readonly PermissionCode[], cases: unknown[]) {
  mockOrderApiGet(permissions, { [DETAIL_PATH]: () => heldOrder, [FAILURES_PATH]: () => cases });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  return screen.findByRole("region", { name: "Giao thất bại" });
}

describe("OrderDetail — Giao thất bại (WF-05 GH-1)", () => {
  it("đơn giữ vì DELIVERY_FAILED → nhãn lý do giữ + hướng dẫn, không có nút Gỡ giữ", async () => {
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, [openCase]);
    expect(screen.getByText(/Giao thất bại — chờ Sale quyết định/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gỡ giữ" })).not.toBeInTheDocument();
  });

  it("Sale: hồ sơ OPEN có Giao lại + Huỷ phần chưa giao; giao lại gửi note + phí chuyến hỏng", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue({ data: { ...openCase, status: "REDELIVERY" } });
    const section = await renderWith(ORDER_PERMISSION_SETS.salesStaff, [openCase]);
    expect(
      await within(section).findByRole("button", { name: /Huỷ phần chưa giao/ }),
    ).toBeInTheDocument();
    await userEvent.click(within(section).getByRole("button", { name: /Giao lại/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Ghi chú quyết định/), "Khách hẹn thứ Sáu");
    await userEvent.type(within(dialog).getByLabelText(/Phí chuyến giao hỏng/), "850000");
    await userEvent.click(within(dialog).getByRole("button", { name: "Giao lại" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `${FAILURES_PATH}/${openCase.caseId}/redelivery`,
        { note: "Khách hẹn thứ Sáu", failedTripFee: 850000 },
        expect.objectContaining({ headers: { "Idempotency-Key": expect.any(String) } }),
      ),
    );
  });

  it("Quản lý kho (chỉ đọc) → thấy hồ sơ, không nút quyết định", async () => {
    const section = await renderWith(ORDER_PERMISSION_SETS.warehouseManager, [openCase]);
    expect(await within(section).findByText("Phiếu RR-20261110-0001")).toBeInTheDocument();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  it("hồ sơ đã huỷ (terminal) → không nút nào kể cả với Sale", async () => {
    const section = await renderWith(ORDER_PERMISSION_SETS.salesStaff, [
      { ...openCase, status: "CANCELLED" },
    ]);
    expect(await within(section).findByText("Đã huỷ phần chưa giao")).toBeInTheDocument();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  it("lô đã về nhưng chưa có hồ sơ → Huỷ phần chưa giao không cần hồ sơ", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: [] });
    const section = await renderWith(ORDER_PERMISSION_SETS.salesStaff, []);
    await userEvent.click(
      await within(section).findByRole("button", { name: /Huỷ phần chưa giao/ }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/Lý do huỷ/), "Hàng thất lạc trên đường về");
    await userEvent.click(within(dialog).getByRole("button", { name: "Huỷ phần chưa giao" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        `${FAILURES_PATH}/cancellation`,
        { note: "Hàng thất lạc trên đường về" },
        expect.anything(),
      ),
    );
  });
});
