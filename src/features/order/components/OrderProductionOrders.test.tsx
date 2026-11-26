import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PRODUCTION_ORDER_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";

import { apiOrder } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler } from "../__fixtures__/render";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
/** BE ProductionOrderController#list — `/production-orders`, lọc theo đơn bằng query `salesOrderId`. */
const PRODUCTION_PATH = "/production-orders";
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

/** BE `ProductionOrder` của đợt giao 1 — Jackson non_null bỏ field null. */
const batch1 = {
  id: "0b0b0b0b-0000-4000-8000-000000000001",
  code: "PRD-20261020-0001",
  salesOrderId: apiOrder.orderId,
  receivingWarehouseId: "8f8f8f8f-0000-4000-8000-000000000001",
  needByDate: "2026-11-05",
  expectedCompletionDate: "2026-11-03",
  status: "IN_PRODUCTION",
  sampleApprovalRequired: false,
  currency: "VND",
  lines: [
    {
      id: "0c0c0c0c-0000-4000-8000-000000000001",
      orderLineId: LINE_ID,
      sku: "CUP-PRINT-12OZ",
      cartons: 6,
      unitsPerCarton: 50,
      totalUnits: 300,
      receivedCartons: 0,
    },
  ],
  version: 2,
};
/** Đợt giao 2 của cùng dòng: đã nhập kho đủ. */
const batch2 = {
  ...batch1,
  id: "0b0b0b0b-0000-4000-8000-000000000002",
  code: "PRD-20261020-0002",
  status: "RECEIVED",
  expectedCompletionDate: undefined,
  needByDate: "2026-11-20",
  lines: [
    {
      ...batch1.lines[0],
      id: "0c0c0c0c-0000-4000-8000-000000000002",
      cartons: 4,
      totalUnits: 200,
      receivedCartons: 4,
    },
  ],
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

describe("Chưa có Đơn sản xuất → lối mở thẳng hộp Lập (S11-5)", () => {
  it("người có production-orders:CREATE thấy link 'Lập Đơn sản xuất' trỏ tới lịch với đơn này", async () => {
    await renderDetail(customOrder, () => page([]), [
      ...ORDER_PERMISSION_SETS.salesStaff,
      PRODUCTION_ORDER_PERMISSIONS.read,
      PRODUCTION_ORDER_PERMISSIONS.create,
    ]);
    const link = await screen.findByRole("link", { name: "Lập Đơn sản xuất" });
    expect(link).toHaveAttribute(
      "href",
      `/admin/production-schedule?tab=batches&drawOrder=${apiOrder.orderId}`,
    );
  });

  it("không có quyền lập → chỉ câu giải thích, không link", async () => {
    await renderDetail(customOrder, () => page([]), [
      ...ORDER_PERMISSION_SETS.salesStaff,
      PRODUCTION_ORDER_PERMISSIONS.read,
    ]);
    await screen.findByText(/Chưa có đơn sản xuất — Điều phối sản xuất lập/);
    expect(screen.queryByRole("link", { name: "Lập Đơn sản xuất" })).not.toBeInTheDocument();
  });
});

describe("OrderDetail — Đơn sản xuất theo dòng in (docs 17 §4.3)", () => {
  it("gửi đúng request BE: salesOrderId = orderId, cũ nhất trước, cỡ trang tối đa 200", async () => {
    const get = await renderDetail(customOrder, () => page([batch1]));

    await screen.findByRole("listitem", { name: "Đơn sản xuất PRD-20261020-0001" });
    const [call] = productionCalls(get);
    const params = (call?.[1] as { params: URLSearchParams }).params;
    expect(params.get("salesOrderId")).toBe(apiOrder.orderId);
    expect(params.get("sort")).toBe("createdAt,asc");
    expect(params.has("type")).toBe(false);
    expect(params.get("page")).toBe("0");
    expect(params.get("size")).toBe("200");
  });

  it("mỗi đợt giao một Đơn sản xuất, gom theo dòng, với trạng thái docs 17 §5.3 và số thùng đã nhập kho", async () => {
    await renderDetail(customOrder, () => page([batch1, batch2]));

    const first = await screen.findByRole("listitem", { name: "Đơn sản xuất PRD-20261020-0001" });
    expect(within(first).getByText("Đang sản xuất")).toBeInTheDocument();
    expect(within(first).getByText(/Nhập kho 0\/6 thùng · dự kiến xong/)).toBeInTheDocument();

    const second = screen.getByRole("listitem", { name: "Đơn sản xuất PRD-20261020-0002" });
    expect(within(second).getByText("Đã nhập kho đủ")).toBeInTheDocument();
    expect(within(second).getByText(/Nhập kho 4\/4 thùng · cần hàng/)).toBeInTheDocument();
    expect(screen.getByText("Đơn sản xuất · đã nhập đủ 1/2")).toBeInTheDocument();
  });

  it("nhiều trang (hasNext) → đọc hết các trang rồi mới gom", async () => {
    const get = await renderDetail(customOrder, (params) =>
      params?.get("page") === "0" ? page([batch1], 0, true) : page([batch2], 1),
    );

    expect(await screen.findByText("Đơn sản xuất · đã nhập đủ 1/2")).toBeInTheDocument();
    expect(productionCalls(get)).toHaveLength(2);
  });

  it("trang rỗng → dòng in báo 'chưa có đơn sản xuất', KHÔNG báo lỗi", async () => {
    await renderDetail({ ...customOrder, status: "CONFIRMED" }, () => page([]));
    expect(
      await screen.findByText(/Chưa có đơn sản xuất — Điều phối sản xuất lập/),
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
    expect(screen.queryByText(/Chưa có đơn sản xuất/)).not.toBeInTheDocument();
  });

  it("hình trả về sai hợp đồng (mảng trần) → báo lỗi tải, không hiện dữ liệu, trang đơn vẫn còn", async () => {
    await renderDetail(customOrder, () => [batch1]);

    expect(await screen.findByText("Dữ liệu trả về không đúng định dạng")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /Đơn sản xuất PRD/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: apiOrder.orderNumber })).toBeInTheDocument();
  });

  it("BE 403 (quyền bị thu) → báo không có quyền, không Thử lại", async () => {
    await renderDetail(customOrder, () => {
      throw new ApiError(403, "FORBIDDEN", "Access denied");
    });

    expect(await screen.findByText("Không xem được đơn sản xuất")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Thử lại" })).not.toBeInTheDocument();
  });

  it("thiếu production-orders:READ (vd chỉ đọc đơn) → không gọi API, báo không có quyền", async () => {
    const get = await renderDetail(
      customOrder,
      () => page([batch1]),
      ORDER_PERMISSION_SETS.readOnly,
    );

    expect(await screen.findByText("Không xem được đơn sản xuất")).toBeInTheDocument();
    expect(productionCalls(get)).toHaveLength(0);
    expect(screen.queryByText(/Chưa có đơn sản xuất/)).not.toBeInTheDocument();
  });

  it("đơn chỉ hàng sẵn → không gọi API đơn sản xuất, không thông báo", async () => {
    const get = await renderDetail(apiOrder, () => page([]));
    await screen.findByRole("heading", { name: apiOrder.orderNumber });
    expect(productionCalls(get)).toHaveLength(0);
    expect(screen.queryByText("Không xem được đơn sản xuất")).not.toBeInTheDocument();
  });
});
