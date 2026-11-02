/** Render màn chi tiết đơn CONFIRMED rồi mở hộp thoại Release — dùng cho test lý do từ chối / tranh chấp / Idempotency-Key. */

import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { OrderDetail } from "../components/OrderDetail";

import { DETAIL_PATH, HISTORY_PATH } from "./detail";
import { apiOrder, apiOrderDelivery } from "./order";
import { mockOrderApiGet, ORDER_PERMISSION_SETS, renderOrderScreen } from "./render";

import type { PermissionCode } from "@/lib/auth";

export const RELEASE_PATH = `${DETAIL_PATH}/release`;
export const WAREHOUSES = {
  items: [
    { id: "wh-hn", prefix: "HN01", name: "Kho Hà Nội", status: "ACTIVE" },
    { id: "wh-hcm", prefix: "HCM01", name: "Kho TP.HCM", status: "ACTIVE" },
  ],
};

/** Header `Idempotency-Key` của một lần gửi release: lấy từ lệnh gọi thứ `index` của spy `api.post`. */
export const keyOfCall = (calls: readonly unknown[][], index: number): string => {
  const config = calls[index]?.[2] as { headers?: Record<string, string> } | undefined;
  return config?.headers?.["Idempotency-Key"] ?? "";
};

export async function renderConfirmedScreen(
  status: Parameters<typeof apiOrderDelivery>[0] = "CONFIRMED",
  patch: Record<string, unknown> = {},
  permissions: readonly PermissionCode[] = ORDER_PERMISSION_SETS.coordinatorWithModes,
  warehouses: () => unknown = () => WAREHOUSES,
) {
  mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () =>
      apiOrderDelivery(status, { deliveryMode: "PARCEL", deliveryModeLocked: false }, patch),
    [HISTORY_PATH]: () => [],
    "/warehouses": warehouses,
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
}

export async function openReleaseDialog() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Release đơn" }));
  return { user, dialog: await screen.findByRole("dialog") };
}
