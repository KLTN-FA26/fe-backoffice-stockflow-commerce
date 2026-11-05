/**
 * Order — feature public API.
 *
 * types.ts    → z.infer từ schemas + OrderStatus từ constants/statuses
 * schemas.ts  → zod DTO (BE OrderResponse); model-schemas.ts → model FE; history-schemas.ts → lịch sử
 * input-schemas.ts → input giữ / gỡ giữ / giao thất bại / đóng phần còn lại / giao một phần / hình thức giao
 * action-schemas.ts → input credit / huỷ; credit-hold-schemas.ts, production-schemas.ts
 * release-schemas.ts, release-errors.ts, release-rules.ts → release đơn (PR #74)
 * status-map.ts → BE→FE status mapping
 * api.ts      → axios calls (list, detail, admin-cancel, giữ / gỡ giữ / giao thất bại / đóng phần còn lại)
 * delivery-mode-api.ts → release + đổi hình thức giao; history-api.ts; partial-shipment-api.ts
 * action-api.ts → credit hold, lệnh sản xuất (GET /production/orders)
 * queries.ts  → React Query hooks
 * mutations.ts → mutation hooks
 * lifecycle.ts → transition table + action-gating
 * selectors.ts → pure flag derivations
 * index.ts    → barrel export
 */

// Types
export type {
  BackendOrderReadStatus,
  BackendOrderStatus,
  CreditHold,
  Order,
  OrderDto,
  OrderLine,
  OrderReadStatus,
  OrderDeliveryMode,
  OrderHistoryEntry,
  OrderStatus,
  ProductionOrder,
} from "./types";

// Schemas
export {
  adminCancelOrderSchema,
  creditApprovalSchema,
  creditRejectionSchema,
} from "./action-schemas";
export {
  deliveryFailureSchema,
  deliveryModeSchema,
  holdOrderSchema,
  partialShipmentSchema,
  remainderClosureSchema,
  resolveOrderHoldSchema,
} from "./input-schemas";
export { releaseFormSchema } from "./release-schemas";
export { orderDtoSchema, orderPageDtoSchema } from "./schemas";
export type {
  AdminCancelOrderInput,
  CreditApprovalInput,
  CreditRejectionFormInput,
  CreditRejectionInput,
} from "./types";
export type { ReleaseFormValues } from "./release-schemas";

// Status mapping
export { mapBackendOrderStatus, toBackendOrderStatuses } from "./status-map";

// Lifecycle
export {
  ORDER_ACTIONS,
  ORDER_TRANSITIONS,
  allowedOrderActions,
  allowedTransitions,
  canTransition,
  isOrderTerminal,
  isTerminal,
  nextOrderStatuses,
} from "./lifecycle";
export type { OrderAction, OrderActionCode, OrderActionContext } from "./lifecycle";

// Selectors
export {
  creditHoldSummary,
  creditOverage,
  creditState,
  customLineCount,
  depositState,
  groupProductionOrdersByLine,
  shouldFlagOrderRow,
} from "./selectors";

// Query hooks
export {
  orderKeys,
  useCreditHolds,
  useOrder,
  useOrderHistory,
  useOrderProductionOrders,
  useOrders,
} from "./queries";

// Error mapping
export {
  adminCancelErrorView,
  creditDecisionErrorView,
  isProductionForbidden,
  orderActionErrorView,
} from "./errors";
export type { OrderErrorView } from "./errors";
export { releaseErrorView } from "./release-errors";

// Mutation hooks
export {
  useAdminCancelOrder,
  useApproveCreditHold,
  useRejectCreditHold,
  useReleaseOrder,
} from "./mutations";

// Khe "Ước tính xếp xe" (SCRUM-287 F3): chỗ ghép truyền vào, feature không import chéo
export type { OrderEstimateSlot, OrderEstimateSlotProps } from "./estimate-slot";

// API params
export type { ListOrderParams } from "./api";
export type { ListCreditHoldParams } from "./action-api";
export type { ReleaseOrderInput } from "./delivery-mode-api";

// Components
export { CreditHoldList } from "./components/credit-hold/CreditHoldList";
export { OrderDetail } from "./components/OrderDetail";
export { OrderList } from "./components/OrderList";
export { OrderLoadError } from "./components/OrderLoadError";
export { OrderDetailSkeleton, OrderListPageSkeleton } from "./components/OrderSkeletons";
