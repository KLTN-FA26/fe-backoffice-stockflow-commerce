import { act, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SALES_OWNER_READ } from "@/test/sales-owner-screen";

import { apiOrder } from "../__fixtures__/order";
import {
  mockOrderApiGet,
  ORDER_PERMISSION_SETS,
  orderAction,
  renderOrderScreen,
} from "../__fixtures__/render";

import { OrderDetail } from "./OrderDetail";

import type { PermissionCode } from "@/lib/auth";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
const OWNER_URL = `/customers/${apiOrder.customerId}/sales-owner`;

describe("OrderDetail — Sale phụ trách khách (KE-HOACH BR-S13)", () => {
  it("BR-S13: việc vận hành (huỷ, giữ đơn) không bị chặn dù khách do Sale khác phụ trách", async () => {
    const permissions: PermissionCode[] = [...ORDER_PERMISSION_SETS.salesStaff, SALES_OWNER_READ];
    mockOrderApiGet(permissions, {
      [DETAIL_PATH]: () => ({ ...apiOrder, status: "PICKING" }),
      [OWNER_URL]: () => ({
        customerId: apiOrder.customerId,
        salesOwnerId: "someone-else",
        salesOwnerName: "Trần Văn Sales",
        active: true,
        state: "ASSIGNED",
      }),
    });
    await act(async () => {
      renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
    });
    expect(await orderAction("Huỷ đơn")).toBeEnabled();
    expect(await orderAction("Giữ đơn")).toBeEnabled();
    expect(screen.queryByText(/Khách này do .* phụ trách/)).not.toBeInTheDocument();
  });
});
