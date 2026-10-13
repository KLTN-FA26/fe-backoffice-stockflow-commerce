/** Selector thuần cho đơn của khách. */

import { ORDER_STATUS_GROUP_DISPLAY } from "@/constants";

import type { OrderStatusGroup } from "@/constants";

export function statusGroupDisplay(group: OrderStatusGroup): string {
  return ORDER_STATUS_GROUP_DISPLAY[group];
}

/** Trạng thái in theo dòng (BE `CustomerOrderLine.production.state`). */
export const PRODUCTION_STATE_LABEL: Readonly<Record<string, string>> = {
  NOT_STARTED: "Chưa in",
  IN_PROGRESS: "Đang in",
  DONE: "In xong",
  CANCELLED: "Đã huỷ in",
};
