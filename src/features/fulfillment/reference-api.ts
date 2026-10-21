/**
 * Dữ liệu phụ trợ của module khác mà màn xuất kho cần — task BE chỉ trả id.
 *
 * - Đơn hàng (`GET /orders`, `/orders/{id}`): số đơn, dòng đơn (SKU, SL, thiết kế đã khoá). Cần
 *   `sales-orders:READ`; seed BE không cấp cho nhân viên kho / quản lý kho / QC.
 * - Người nhận task (`GET /fulfillment/assignees?warehouseId=`): danh sách chọn trong dialog gán / tạo
 *   task. Cần `fulfillment-task-assignment:UPDATE` — cùng quyền với việc gán, nên ai gán được thì thấy
 *   danh sách (không cần `identity-users:READ`). Tên người được gán trên task lấy từ `assignedUserName`.
 * Thiếu quyền → màn hình không gọi, hiện thông báo (xem `components`). Không import
 * `features/order` (import boundary) — parse bằng schema nhỏ của feature này.
 */

import { FULFILLABLE_ORDER_API_STATUSES, PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import { assigneeListSchema, fulfillmentOrderPageSchema, fulfillmentOrderSchema } from "./schemas";

import type { Assignee, FulfillmentOrder } from "./types";

const ORDERS_PATH = "/orders";
const ASSIGNEES_PATH = "/fulfillment/assignees";

/** Spring bind `@RequestParam List<OrderStatus> status` từ `status=A&status=B`. */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

export async function getFulfillmentOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<FulfillmentOrder> {
  const { data } = await api.get<unknown>(`${ORDERS_PATH}/${encodeURIComponent(orderId)}`, {
    signal,
  });
  return fulfillmentOrderSchema.parse(data);
}

/** Đơn đưa được vào xuất kho: chỉ READY_TO_FULFILL — đơn CONFIRMED phải release trước (BE PR #133, FulfillmentServiceImpl#createTask). */
export async function listFulfillableOrders(signal?: AbortSignal): Promise<FulfillmentOrder[]> {
  const { data } = await api.get<unknown>(ORDERS_PATH, {
    // Một trang tối đa của BE (Pages.MAX_PAGE_SIZE = 200), mới nhất trước — ô chọn chưa có tìm kiếm
    params: { page: 0, size: PAGE_SIZE.masterData, status: [...FULFILLABLE_ORDER_API_STATUSES] },
    paramsSerializer: REPEAT_ARRAY_PARAMS,
    signal,
  });
  return fulfillmentOrderPageSchema.parse(data).items;
}

/**
 * id đơn → số đơn cho cột danh sách (task chỉ có `orderId`). Một trang tối đa của BE
 * (Pages.MAX_PAGE_SIZE = 200), mới nhất trước; đơn ngoài trang này hiện id rút gọn.
 */
export async function listOrderNumbers(
  signal?: AbortSignal,
): Promise<Readonly<Record<string, string>>> {
  const { data } = await api.get<unknown>(ORDERS_PATH, {
    params: { page: 0, size: PAGE_SIZE.masterData },
    signal,
  });
  const page = fulfillmentOrderPageSchema.parse(data);
  return Object.fromEntries(page.items.map((order) => [order.orderId, order.orderNumber]));
}

/** Tên hiển thị của người nhận; thiếu tên thì id. */
export function assigneeName(user: Pick<Assignee, "userId" | "displayName">): string {
  return user.displayName || user.userId;
}

/**
 * Người nhận được task của một kho (BE `GET /fulfillment/assignees`): nhân viên kho / quản lý kho đang
 * hoạt động được gán cho kho đó, xếp theo tên.
 */
export async function listAssignees(
  warehouseId: string,
  signal?: AbortSignal,
): Promise<Assignee[]> {
  const { data } = await api.get<unknown>(ASSIGNEES_PATH, { params: { warehouseId }, signal });
  return [...assigneeListSchema.parse(data)].sort((a, b) =>
    assigneeName(a).localeCompare(assigneeName(b), "vi"),
  );
}
