import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
/** BE ProductionOrderController#list — lọc theo đơn bằng query `salesOrderId`. */
const PRODUCTION_PATH = "/production/orders";
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

/** Row BE `ProductionOrderRowResponse` — Jackson non_null bỏ field null. */
const parent = {
  id: "0b0b0b0b-0000-4000-8000-000000000001",
  orderNumber: "LSX-20261020-0001",
  type: "ORDER",
  mode: "IN_HOUSE",
  status: "PRINTING",
  warehouseId: "8f8f8f8f-0000-4000-8000-000000000001",
  blankSku: "CUP-12OZ-WHT",
  designSnapshotId: "c0ffee00-0000-4000-8000-000000000001",
  plannedQuantity: 300,
  goodQuantity: 0,
  salesOrderId: apiOrder.orderId,
  salesOrderLineId: LINE_ID,
  createdAt: "2026-10-20T03:00:00Z",
};
const child = {
  ...parent,
  id: "0b0b0b0b-0000-4000-8000-000000000002",
  orderNumber: "LSX-20261020-0002",
  parentId: parent.id,
  mode: "SUBCONTRACTED",
  status: "ON_HOLD",
  holdReason: "SUBCONTRACTOR_LATE",
  plannedQuantity: 200,
};

function page(items: unknown[], at = 0, hasNext = false) {
  return {
    items,
    page: at,
    size: 200,
    totalElements: items.length,
    totalPages: hasNext ? at + 2 : at + 1,
    hasNext,
    hasPrevious: at > 0,
  };
}

async function renderDetail(
  order: unknown,
  production: RouteHandler,
  permissions: readonly PermissionCode[] = ORDER_PERMISSION_SETS.salesStaff,
) {
  const get = mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => order,
    [`${DETAIL_PATH}/history`]: () => [],
    [PRODUCTION_PATH]: production,
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  return get;
}

const productionCalls = (get: Awaited<ReturnType<typeof renderDetail>>) =>
  get.mock.calls.filter(([url]) => url === PRODUCTION_PATH);

afterEach(() => vi.restoreAllMocks());

describe("OrderDetail — lệnh sản xuất theo dòng in (docs 19)", () => {
  it("gửi đúng request BE: salesOrderId = orderId, chỉ LSX ORDER, cỡ trang tối đa 200", async () => {
    const get = await renderDetail(customOrder, () => page([parent]));

    await screen.findByRole("listitem", { name: "Lệnh sản xuất LSX-20261020-0001" });
    const [call] = productionCalls(get);
    const params = (call?.[1] as { params: URLSearchParams }).params;
    expect(params.get("salesOrderId")).toBe(apiOrder.orderId);
    expect(params.get("type")).toBe("ORDER");
    expect(params.get("page")).toBe("0");
    expect(params.get("size")).toBe("200");
  });

  it("LSX gốc + LSX con gia công (BR-12) gom theo dòng, với trạng thái và lý do treo", async () => {
    await renderDetail(customOrder, () => page([parent, child]));

    const parentRow = await screen.findByRole("listitem", {
      name: "Lệnh sản xuất LSX-20261020-0001",
    });
    expect(within(parentRow).getByText(/LSX gốc · In nội bộ/)).toBeInTheDocument();
    expect(within(parentRow).getByText("Đang in")).toBeInTheDocument();

    const childRow = screen.getByRole("listitem", { name: "Lệnh sản xuất LSX-20261020-0002" });
    expect(within(childRow).getByText(/LSX con · Gia công ngoài/)).toBeInTheDocument();
    expect(within(childRow).getByText("Treo: Nhà gia công trễ")).toBeInTheDocument();
    // BR-06: đơn rời In Production khi mọi LSX (gốc + con) hoàn tất
    expect(screen.getByText("Lệnh sản xuất · hoàn tất 0/2")).toBeInTheDocument();
  });

  it("nhiều trang (hasNext) → đọc hết các trang rồi mới gom", async () => {
    const get = await renderDetail(customOrder, (params) =>
      params?.get("page") === "0" ? page([parent], 0, true) : page([child], 1),
    );

    expect(await screen.findByText("Lệnh sản xuất · hoàn tất 0/2")).toBeInTheDocument();
    expect(productionCalls(get)).toHaveLength(2);
  });

  it("trang rỗng → dòng in báo 'chưa có lệnh sản xuất', KHÔNG báo lỗi", async () => {
    await renderDetail({ ...customOrder, status: "CONFIRMED" }, () => page([]));
    expect(
      await screen.findByText(/Chưa có lệnh sản xuất — sinh khi đơn được release/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("lỗi 5xx → báo lỗi + Thử lại ở cấp đơn; phần còn lại của trang đơn vẫn hiển thị", async () => {
    await renderDetail(customOrder, () => {
      throw new ApiError(500, "INTERNAL_ERROR", "boom");
    });

    // 5xx được retry 2 lần (retryTransient) trước khi báo lỗi
    expect(
      await screen.findByRole("button", { name: "Thử lại" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
    expect(screen.queryByText(/Chưa có lệnh sản xuất/)).not.toBeInTheDocument();
  });

  it("hình trả về sai hợp đồng (mảng trần) → báo lỗi tải, không hiện dữ liệu, trang đơn vẫn còn", async () => {
    await renderDetail(customOrder, () => [parent]);

    expect(await screen.findByText("Dữ liệu trả về không đúng định dạng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /Lệnh sản xuất LSX/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
  });

  it("BE 403 (quyền bị thu) → báo không có quyền, không Thử lại", async () => {
    await renderDetail(customOrder, () => {
      throw new ApiError(403, "FORBIDDEN", "Access denied");
    });

    expect(await screen.findByText("Không xem được lệnh sản xuất")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("thiếu production-orders:READ (vd chỉ đọc đơn) → không gọi API, báo không có quyền", async () => {
    const get = await renderDetail(
      customOrder,
      () => page([parent]),
      ORDER_PERMISSION_SETS.readOnly,
    );

    expect(await screen.findByText("Không xem được lệnh sản xuất")).toBeInTheDocument();
    expect(productionCalls(get)).toHaveLength(0);
    expect(screen.queryByText(/Chưa có lệnh sản xuất/)).not.toBeInTheDocument();
  });

  it("đơn chỉ hàng sẵn → không gọi API lệnh sản xuất, không thông báo", async () => {
    const get = await renderDetail(apiOrder, () => page([]));
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(productionCalls(get)).toHaveLength(0);
    expect(screen.queryByText("Không xem được lệnh sản xuất")).not.toBeInTheDocument();
  });
});
