import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WAREHOUSE_PERMISSIONS } from "@/constants";

import { apiOrder, apiOrderWith } from "../__fixtures__/order";
import { ORDER_PERMISSION_SETS, mockOrderApiGet, renderOrderScreen } from "../__fixtures__/render";
import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * "Kho xuất" trên trang chi tiết: tên kho tra qua GET /warehouses (warehouse-warehouses:READ). Live BE
 * 5683fe14: ORDER_COORDINATOR chưa có quyền này (BE V20261022000100 bổ sung) → mỗi lần mở đơn đều 403
 * và hiện UUID trần. Thiếu quyền thì không gọi API, báo không xem được tên; có quyền thì hiện tên kho.
 */

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const WAREHOUSE_ID = "8f8f8f8f-0000-4000-8000-000000000001";
const released = apiOrderWith({ status: "READY_TO_FULFILL", warehouseId: WAREHOUSE_ID });

async function renderDetail(permissions: readonly PermissionCode[]) {
  const get = mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => released,
    [`${DETAIL_PATH}/history`]: () => [],
    "/warehouses": () => ({ items: [{ id: WAREHOUSE_ID, prefix: "HN", name: "Kho Hà Nội" }] }),
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  await screen.findByRole("heading", { name: apiOrder.orderNumber });
  return get;
}

const warehouseCalls = (get: Awaited<ReturnType<typeof renderDetail>>) =>
  get.mock.calls.filter(([url]) => url === "/warehouses");

afterEach(() => vi.restoreAllMocks());

describe("OrderInfoCard — Kho xuất theo quyền warehouse-warehouses:READ", () => {
  it("thiếu quyền (Coordinator trước BE V20261022000100) → không gọi GET /warehouses, báo không xem được tên", async () => {
    const get = await renderDetail(ORDER_PERMISSION_SETS.coordinator);

    const fallback = await screen.findByText(/tài khoản chưa có quyền xem tên kho/);
    expect(fallback).toHaveAttribute("title", WAREHOUSE_ID);
    expect(screen.queryByText(WAREHOUSE_ID)).not.toBeInTheDocument();
    expect(warehouseCalls(get)).toHaveLength(0);
  });

  it("có quyền → tra danh mục kho (mọi trạng thái) và hiện tên kho", async () => {
    const get = await renderDetail([
      ...ORDER_PERMISSION_SETS.coordinator,
      WAREHOUSE_PERMISSIONS.read,
    ]);

    expect(await screen.findByText("Kho Hà Nội")).toBeInTheDocument();
    expect(screen.queryByText(/chưa có quyền xem tên kho/)).not.toBeInTheDocument();
    const [call] = warehouseCalls(get);
    const params = (call?.[1] as { params: URLSearchParams }).params;
    expect(params.get("status")).toBeNull();
  });

  it("đơn chưa release → 'Chưa release', không tra kho", async () => {
    const get = mockOrderApiGet(
      [...ORDER_PERMISSION_SETS.coordinator, WAREHOUSE_PERMISSIONS.read],
      {
        [DETAIL_PATH]: () => apiOrderWith({ status: "CONFIRMED", warehouseId: null }),
        [`${DETAIL_PATH}/history`]: () => [],
      },
    );
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    expect(await screen.findByText("Chưa release")).toBeInTheDocument();
    expect(warehouseCalls(get)).toHaveLength(0);
  });
});
