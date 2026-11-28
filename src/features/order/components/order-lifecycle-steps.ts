import { ORDER_STATUS_UNKNOWN } from "@/constants";
import { statusLabelVi } from "@/lib/status-map";

import type { Order } from "../types";

/**
 * Mốc chính của vòng đời đơn (19 trạng thái BE quá dài cho một hàng): hợp đồng → xác nhận → sản xuất → sẵn sàng xuất →
 * đã giao hàng → đã giao → hoàn tất. Nhãn lấy nguyên văn `statusLabelVi(…, "order")`.
 */
const MILESTONE_STATUSES = [
  "Pending Contract",
  "Confirmed",
  "In Production",
  "Ready to Fulfill",
  "Shipped",
  "Delivered",
  "Completed",
] as const;
/** Trạng thái → bước đang ở (theo thứ tự mốc); nhánh rẽ (tạm giữ, huỷ, trả hàng…) nối thêm làm bước cuối. */
const STEP_OF: Partial<Record<Order["status"], number>> = {
  Draft: 0,
  "Pending Contract": 0,
  "Pending Payment": 1,
  Confirmed: 1,
  "Awaiting Stock": 2,
  "In Production": 2,
  "Ready to Fulfill": 3,
  Picking: 3,
  Packed: 3,
  "Partially Fulfilled": 4,
  Shipped: 4,
  Delivered: 5,
  Completed: 6,
  Closed: 6,
};

export function orderLifecycle(status: Order["status"]): { steps: string[]; current: number } {
  const steps = MILESTONE_STATUSES.map((s) => statusLabelVi(s, "order") ?? s);
  const step = STEP_OF[status];
  if (step !== undefined) return { steps, current: status === "Closed" ? steps.length : step };
  // Trạng thái BE mới FE chưa hỗ trợ: không đoán đang ở bước nào (trạng thái đã ghi ở header)
  if (status === ORDER_STATUS_UNKNOWN) return { steps, current: -1 };
  // Nhánh rẽ: giữ các mốc đã qua (ước theo mốc "Xác nhận"), thêm trạng thái hiện tại làm bước cuối
  const label = statusLabelVi(status, "order") ?? status;
  return { steps: [...steps.slice(0, 2), label], current: 2 };
}
