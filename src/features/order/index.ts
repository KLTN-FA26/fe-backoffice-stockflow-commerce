/**
 * Order — feature public API.
 *
 * types.ts    → z.infer từ schemas + OrderStatus từ constants/statuses
 * schemas.ts  → zod DTO (BE OrderResponse); model-schemas.ts → model FE; history-schemas.ts → lịch sử
 * input-schemas.ts → input giữ / gỡ giữ / giao thất bại / đóng phần còn lại / giao một phần / hình thức giao
 * action-schemas.ts → input credit / huỷ; credit-hold-schemas.ts, production-schemas.ts
 * release-schemas.ts, release-errors.ts, release-rules.ts → release đơn (PR #74)
 * cancellation-request-*.ts → yêu cầu huỷ của khách: duyệt / từ chối (docs 17 §4.8, §5.4) + kết quả tất toán
 * delivery-batch-*.ts, delivery-window-*.ts → lịch giao của đơn (§5.5) + dời cửa sổ giao (§4.5, BR-28)
 * status-map.ts → BE→FE status mapping
 * api.ts      → axios calls (list, detail, admin-cancel, giữ / gỡ giữ / giao thất bại / đóng phần còn lại)
 * release-api.ts → release đơn; delivery-batch-api.ts → lịch giao (chọn đợt khi release); history-api.ts; partial-shipment-api.ts
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
export type { OrderSettlementSlot, OrderSettlementSlotProps } from "./settlement-slot";

// API params
export type { ListOrderParams } from "./api";
export type { ListCreditHoldParams } from "./action-api";
export type { ReleaseOrderInput } from "./release-api";

// Components
export { CancellationRequestList } from "./components/cancellation/CancellationRequestList";
export { CreditHoldList } from "./components/credit-hold/CreditHoldList";
export { OrderDetail } from "./components/OrderDetail";
export { OrderList } from "./components/OrderList";
export { OrderLoadError } from "./components/OrderLoadError";
export { OrderDetailSkeleton, OrderListPageSkeleton } from "./components/OrderSkeletons";
