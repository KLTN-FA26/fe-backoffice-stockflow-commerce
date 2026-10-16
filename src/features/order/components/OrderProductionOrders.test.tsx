import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const PRODUCTION_PATH = `${DETAIL_PATH}/production-orders`;
const LINE_ID = "5e5e5e5e-0000-4000-8000-000000000002";

const customOrder = {
  ...apiOrder,
  status: "IN_PRODUCTION" as const,
  lines: [
    {
      lineId: LINE_ID,
      sku: "CUP-PRINT-12OZ",
      quantity: 500,
      unitPrice: 4000,
      lineTotal: 2_000_000,
      reservationIds: [],
      designSnapshotId: "c0ffee00-0000-4000-8000-000000000001",
    },
  ],
};

const parent = {
  productionOrderId: "PRD-1",
  productionOrderNumber: "LSX-0001",
  salesOrderLineId: LINE_ID,
  mode: "IN_HOUSE",
  status: "PRINTING",
  plannedQuantity: 300,
  goodQuantity: 0,
};
const child = {
  productionOrderId: "PRD-1-S1",
  productionOrderNumber: "LSX-0001-S1",
  salesOrderLineId: LINE_ID,
  parentId: "PRD-1",
  mode: "SUBCONTRACTED",
  status: "ON_HOLD",
  statusBeforeHold: "SUBCONTRACTED",
  holdReason: "SUBCONTRACTOR_LATE",
  plannedQuantity: 200,
  goodQuantity: 0,
  subcontractorName: "In Bao Bì Sài Gòn",
};

async function renderDetail(order: unknown, production: RouteHandler) {
  mockOrderApiGet(ORDER_PERMISSION_SETS.salesStaff, {
    [DETAIL_PATH]: () => order,
    [PRODUCTION_PATH]: production,
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — lệnh sản xuất theo dòng in (docs 19)", () => {
  it("LSX gốc + LSX con gia công (BR-12) với trạng thái, lý do treo, nhà gia công", async () => {
    await renderDetail(customOrder, () => [parent, child]);

    const parentRow = await screen.findByRole("listitem", { name: "Lệnh sản xuất LSX-0001" });
    expect(within(parentRow).getByText(/LSX gốc · In nội bộ/)).toBeInTheDocument();
    expect(within(parentRow).getByText("Đang in")).toBeInTheDocument();

    const childRow = screen.getByRole("listitem", { name: "Lệnh sản xuất LSX-0001-S1" });
    expect(
      within(childRow).getByText(/LSX con · Gia công ngoài · In Bao Bì Sài Gòn/),
    ).toBeInTheDocument();
    expect(within(childRow).getByText("Treo: Nhà gia công trễ")).toBeInTheDocument();
    // BR-06: đơn rời In Production khi mọi LSX (gốc + con) hoàn tất
    expect(screen.getByText("Lệnh sản xuất · hoàn tất 0/2")).toBeInTheDocument();
  });

  it("CONTRACT PENDING: BE chưa có endpoint (404) → thông báo trung thực, không dữ liệu giả", async () => {
    await renderDetail(customOrder, () => {
      throw new ApiError(404, "NOT_FOUND", "No static resource");
    });

    expect(await screen.findByText("Chưa có dữ liệu lệnh sản xuất")).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /Lệnh sản xuất LSX/ })).not.toBeInTheDocument();
  });

  it("lỗi 5xx → báo lỗi + Thử lại (không che thành 'chưa có API')", async () => {
    await renderDetail(customOrder, () => {
      throw new ApiError(500, "INTERNAL_ERROR", "boom");
    });

    expect(await screen.findByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByText("Chưa có dữ liệu lệnh sản xuất")).not.toBeInTheDocument();
  });

  it("dòng in chưa có LSX (đơn chưa release) → giải thích LSX sinh khi release", async () => {
    await renderDetail({ ...customOrder, status: "CONFIRMED" }, () => []);
    expect(
      await screen.findByText(/Chưa có lệnh sản xuất — sinh khi đơn được release/),
    ).toBeInTheDocument();
  });

  it("đơn chỉ hàng sẵn → không gọi API lệnh sản xuất", async () => {
    await renderDetail(apiOrder, () => []);
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(vi.mocked(api.get).mock.calls.some(([url]) => url === PRODUCTION_PATH)).toBe(false);
  });
});
