/** Render màn chi tiết đơn với quyền + response giả lập (chi tiết và lịch sử đơn). */

import { act } from "@testing-library/react";

import { OrderDetail } from "../components/OrderDetail";

import { apiOrder } from "./order";
import { mockOrderApiGet, renderOrderScreen } from "./render";

import type { PermissionCode } from "@/lib/auth";

export const DETAIL_PATH = `/orders/${apiOrder.orderId}`;
export const HISTORY_PATH = `${DETAIL_PATH}/history`;

export async function renderDetail(
  permissions: readonly PermissionCode[],
  handler: () => unknown,
  history: () => unknown = () => [],
) {
  mockOrderApiGet(permissions, { [DETAIL_PATH]: handler, [HISTORY_PATH]: history });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}
