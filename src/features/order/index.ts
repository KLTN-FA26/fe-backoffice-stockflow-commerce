/**
 * Order — feature public API.
 *
 * types.ts    → z.infer từ schemas + OrderStatus từ constants/statuses
 * schemas.ts  → zod DTO (BE OrderResponse) + model FE + history
 * action-schemas.ts → input release / credit / huỷ; credit-hold-schemas.ts, production-schemas.ts
 * status-map.ts → BE→FE status mapping
 * api.ts      → axios calls (list, detail, history, admin-cancel)
 * action-api.ts → release, credit hold, lệnh sản xuất (contract pending)
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
  OrderStatus,
  OrderStatusChange,
  ProductionOrder,
} from "./types";

// Schemas
export {
  adminCancelOrderSchema,
  creditApprovalSchema,
  creditRejectionSchema,
  releaseOrderSchema,
} from "./action-schemas";
export { orderDtoSchema, orderPageDtoSchema } from "./schemas";
export type {
  AdminCancelOrderInput,
  CreditApprovalInput,
  CreditRejectionFormInput,
  CreditRejectionInput,
  ReleaseOrderInput,
} from "./types";

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
  isProductionApiUnavailable,
  releaseErrorView,
} from "./errors";
export type { OrderErrorView } from "./errors";

// Mutation hooks
export {
  useAdminCancelOrder,
  useApproveCreditHold,
  useRejectCreditHold,
  useReleaseOrder,
} from "./mutations";

// API params
export type { ListOrderParams } from "./api";
export type { ListCreditHoldParams } from "./action-api";

// Components
export { CreditHoldList } from "./components/credit-hold/CreditHoldList";
export { OrderDetail } from "./components/OrderDetail";
export { OrderList } from "./components/OrderList";
export { OrderLoadError } from "./components/OrderLoadError";
export { OrderDetailSkeleton, OrderListPageSkeleton } from "./components/OrderSkeletons";
