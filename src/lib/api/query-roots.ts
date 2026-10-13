/**
 * Root query key của các feature bán hàng / sản xuất — một nguồn duy nhất cho invalidation
 * liên module (feature không import chéo nhau). Giá trị PHẢI trùng `createQueryKeys(...)` của
 * feature sở hữu dữ liệu; có test đối chiếu ở `query-roots.test.ts`.
 */
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
} as const satisfies Record<string, readonly [string]>;
