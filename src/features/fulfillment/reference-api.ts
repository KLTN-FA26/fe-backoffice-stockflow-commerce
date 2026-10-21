/**
 * Dữ liệu phụ trợ của module khác mà màn xuất kho cần — task BE chỉ trả id.
 *
 * - Đơn hàng (`GET /orders`, `/orders/{id}`): số đơn, dòng đơn (SKU, SL, thiết kế đã khoá). Cần
 *   `sales-orders:READ`; seed BE không cấp cho nhân viên kho / quản lý kho / QC.
 * - Nhân viên (`GET /identity/users`): chọn và hiện tên người được gán. Cần `identity-users:READ`;
 *   seed BE chỉ cấp cho quản trị thương mại điện tử.
 * Thiếu quyền → màn hình không gọi, hiện thông báo (xem `components`). Không import
 * `features/order` (import boundary) — parse bằng schema nhỏ của feature này.
 */

import { FULFILLABLE_ORDER_API_STATUSES, PAGE_SIZE } from "@/constants";
import { api } from "@/lib/api/client";

import {
  assignableUserPageSchema,
  fulfillmentOrderPageSchema,
  fulfillmentOrderSchema,
} from "./schemas";

import type { AssignableUser, FulfillmentOrder } from "./types";

const ORDERS_PATH = "/orders";
const USERS_PATH = "/identity/users";

/** Spring bind `@RequestParam List<OrderStatus> status` từ `status=A&status=B`. */
const REPEAT_ARRAY_PARAMS = { indexes: null } as const;

/**
 * BE `requireWarehouseAssignee`: người được gán phải ACTIVE và có một trong hai vai trò này. Đây là bộ
 * lọc danh sách người nhận (`GET /identity/users?role=`), KHÔNG phải quyết định quyền của người gọi — ai
 * được gán / tạo task do `fulfillment-task-assignment:*` quyết (allow-list trong no-role-gating.test.ts).
 */
export const ASSIGNABLE_ROLES = ["WAREHOUSE_STAFF", "WAREHOUSE_MANAGER"] as const;

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

async function listActiveUsersByRole(role: string, signal?: AbortSignal) {
  // BE `GET /identity/users` nhận MỘT mã vai trò mỗi lần gọi
  const { data } = await api.get<unknown>(USERS_PATH, {
    params: { page: 0, size: PAGE_SIZE.masterData, role, status: "ACTIVE" },
    signal,
  });
  return assignableUserPageSchema.parse(data).items;
}

/** Nhân viên gán được task: nhân viên kho + quản lý kho đang hoạt động, gộp và bỏ trùng. */
export async function listAssignableUsers(signal?: AbortSignal): Promise<AssignableUser[]> {
  const pages = await Promise.all(
    ASSIGNABLE_ROLES.map((role) => listActiveUsersByRole(role, signal)),
  );
  const byId = new Map<string, AssignableUser>();
  for (const user of pages.flat()) byId.set(user.userId, user);
  return [...byId.values()].sort((a, b) =>
    userDisplayName(a).localeCompare(userDisplayName(b), "vi"),
  );
}

export function userDisplayName(user: AssignableUser): string {
  return user.fullName || user.username || user.userId;
}
