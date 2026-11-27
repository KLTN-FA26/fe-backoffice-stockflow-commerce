/**
 * Chi tiết đơn — khối "Lô hàng hoàn về" (WF-05 BO-01; BE `DeliveryFailureController` sau #377): không còn "Giao lại";
 * "Huỷ phần chưa giao" chỉ cho đơn cũ đang giữ vì giao thất bại (Q-13); nhãn hồ sơ theo `closure` (F-4); "Đóng phần thất
 * lạc" trên lô hãng báo mất (Q-12, F-5).
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
import { openOrderDetailTabInFile } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.restoreAllMocks());

const FAILURES_PATH = `${DETAIL_PATH}/delivery-failures`;
const SHIPMENT_ID = apiPartialOrder.shipments?.[0]?.shipmentId ?? "";
const baseShipment = apiPartialOrder.shipments?.[0] ?? {
  shipmentId: SHIPMENT_ID,
  status: "RETURNED",
};
/** Đơn cũ (trước #377): lô hoàn về giữ đơn. */
const heldOrder = apiOrderWith({
  ...apiPartialOrder,
  status: "ON_HOLD",
  holdReason: "DELIVERY_FAILED",
  shipments: [{ ...baseShipment, status: "RETURNED" }],
});
/** Đơn luồng mới: lô hoàn về không giữ đơn. */
const newFlowOrder = apiOrderWith({
  ...apiPartialOrder,
  status: "PARTIALLY_FULFILLED",
  shipments: [{ ...baseShipment, status: "RETURNED" }],
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
/** Hồ sơ luồng mới: kho đóng ngay khi nhận hàng hoàn về; BE cũ còn ghi câu hệ thống tiếng Anh. */
const recordedCase = {
  ...openCase,
  status: "CANCELLED",
  closure: "RECORDED_ON_RETURN",
  decisionNote: "Closed when the shipment came back; the goods are a record of the return",
};

async function renderWith(
  permissions: readonly PermissionCode[],
  cases: unknown[],
  order: unknown = heldOrder,
) {
  mockOrderApiGet(permissions, { [DETAIL_PATH]: () => order, [FAILURES_PATH]: () => cases });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  return screen.findByRole("region", { name: "Lô hàng hoàn về" });
}

// Các khối được kiểm nằm ở tab "delivery" của trang chi tiết đơn (`OrderDetailTabs`)
openOrderDetailTabInFile("delivery");

describe("OrderDetail — Lô hàng hoàn về (WF-05 BO-01)", () => {
  it("đơn cũ giữ vì DELIVERY_FAILED → nhãn giữ ghi rõ đơn cũ, không nói 'giao lại', không có Gỡ giữ", async () => {
    await renderWith(ORDER_PERMISSION_SETS.salesStaff, [openCase]);
    expect(screen.getByText(/Giao thất bại \(đơn cũ\)/)).toBeInTheDocument();
    expect(screen.queryByText(/giao lại hoặc huỷ/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gỡ giữ" })).not.toBeInTheDocument();
  });

  it("đơn cũ + hồ sơ OPEN + Sale → chỉ Huỷ phần chưa giao, KHÔNG có Giao lại (BE đã xoá /redelivery)", async () => {
    const section = await renderWith(ORDER_PERMISSION_SETS.salesStaff, [openCase]);
    expect(
      await within(section).findByRole("button", { name: /Huỷ phần chưa giao/ }),
    ).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: /Giao lại/ })).not.toBeInTheDocument();
    expect(within(section).getByText(/không giao lại trên đơn này nữa/)).toBeInTheDocument();
  });

  it("luồng mới: hồ sơ đã ghi nhận khi hàng về → 'Đã ghi nhận hàng hoàn về', không câu hệ thống tiếng Anh, không nút", async () => {
    const section = await renderWith(
      ORDER_PERMISSION_SETS.salesStaff,
      [recordedCase],
      newFlowOrder,
    );
    expect(await within(section).findByText("Đã ghi nhận hàng hoàn về")).toBeInTheDocument();
    expect(within(section).queryByText("Đã huỷ phần chưa giao")).not.toBeInTheDocument();
    expect(within(section).queryByText(/Closed when the shipment/)).not.toBeInTheDocument();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  it("hồ sơ OPEN trên đơn KHÔNG giữ vì giao thất bại → không nút (chỉ đơn cũ mới huỷ được)", async () => {
    const section = await renderWith(ORDER_PERMISSION_SETS.salesStaff, [openCase], newFlowOrder);
    expect(await within(section).findByText("Phiếu RR-20261110-0001")).toBeInTheDocument();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  it("Quản lý kho (chỉ đọc) → thấy hồ sơ, không nút quyết định", async () => {
    const section = await renderWith(ORDER_PERMISSION_SETS.warehouseManager, [openCase]);
    expect(await within(section).findByText("Phiếu RR-20261110-0001")).toBeInTheDocument();
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
  });

  it("đơn cũ, lô đã về nhưng chưa có hồ sơ → Huỷ phần chưa giao không cần hồ sơ", async () => {
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

describe("OrderDetail — Đóng phần thất lạc (Q-12, F-5)", () => {
  const lostOrder = apiOrderWith({
    ...apiPartialOrder,
    status: "PARTIALLY_FULFILLED",
    shipments: [{ ...baseShipment, status: "DELIVERY_FAILED", failureReason: "LOST" }],
  });

  async function renderLost(permissions: readonly PermissionCode[]) {
    mockOrderApiGet(permissions, { [DETAIL_PATH]: () => lostOrder, [FAILURES_PATH]: () => [] });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    return screen.findByRole("region", { name: "Lô giao" });
  }

  it("Sale có APPROVE → nút trên lô thất lạc; chưa đính tệp xác nhận thì không gửi được", async () => {
    const card = await renderLost(ORDER_PERMISSION_SETS.salesStaff);
    await userEvent.click(within(card).getByRole("button", { name: /Đóng phần thất lạc/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/tiền được tính ngay/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Ghi chú/), "GHN xác nhận mất kiện");
    expect(within(dialog).getByRole("button", { name: "Đóng phần thất lạc" })).toBeDisabled();
  });

  it("vai không có sales-lost-shipment-closures:APPROVE → không có nút", async () => {
    const card = await renderLost(ORDER_PERMISSION_SETS.coordinator);
    expect(
      within(card).queryByRole("button", { name: /Đóng phần thất lạc/ }),
    ).not.toBeInTheDocument();
  });
});
