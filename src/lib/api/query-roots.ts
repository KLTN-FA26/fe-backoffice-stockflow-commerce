/**
 * Root query key của các feature bán hàng / sản xuất — một nguồn duy nhất cho invalidation
 * liên module (feature không import chéo nhau). Giá trị PHẢI trùng `createQueryKeys(...)` của
 * feature sở hữu dữ liệu; có test đối chiếu ở `query-roots.test.ts`.
 */

import { INVENTORY_QUERY_KEYS } from "@/constants/inventory";

export const QUERY_ROOTS = {
  customers: ["customers"],
  quotes: ["quotes"],
  sampleRequests: ["sample-requests"],
  productionOrders: ["production-orders"],
  /** = `orderKeys.all` (features/order). */
  orders: ["orders"],
  /** = `myOrderKeys.all` (features/customer-order). */
  myOrders: ["my-orders"],
  /** = `fulfillmentKeys.all` (features/fulfillment) — danh sách lấy hàng / đóng gói. */
  fulfillmentTasks: ["fulfillment-tasks"],
  /** = `stockKeys.all` (features/inventory) — tồn theo SKU / lô / vị trí. */
  inventoryStock: [INVENTORY_QUERY_KEYS.stock],
  /** = `stockReservationKeys.all` (features/inventory) — phiếu giữ hàng. */
  inventoryReservations: [INVENTORY_QUERY_KEYS.reservations],
} as const satisfies Record<string, readonly [string]>;
