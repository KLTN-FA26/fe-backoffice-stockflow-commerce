/**
 * Order — feature public API.
 *
 * types.ts    → z.infer từ schemas + OrderStatus từ constants/statuses
 * schemas.ts  → zod DTO (BE OrderResponse) + model FE + admin-cancel input
 * status-map.ts → BE→FE status mapping
 * api.ts      → axios calls (list, detail, admin-cancel)
 * queries.ts  → React Query hooks
 * mutations.ts → mutation hooks
 * lifecycle.ts → transition table + action-gating
 * selectors.ts → pure flag derivations
 * index.ts    → barrel export
 */

// Types
export type { BackendOrderStatus, Order, OrderDto, OrderLine, OrderStatus } from "./types";

// Schemas
export { adminCancelOrderSchema, orderDtoSchema, orderPageDtoSchema } from "./schemas";
export type { AdminCancelOrderInput as AdminCancelOrderFormInput } from "./schemas";

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
export type { OrderAction } from "./lifecycle";

// Selectors
export { shouldFlagOrderRow } from "./selectors";

// Query hooks
export { orderKeys, useOrder, useOrders } from "./queries";

// Error mapping
export { adminCancelErrorView } from "./errors";
export type { OrderErrorView } from "./errors";

// Mutation hooks
export { useAdminCancelOrder } from "./mutations";

// API (for direct use in non-hook contexts)
export type { AdminCancelOrderInput, ListOrderParams } from "./api";

// Components
export { OrderDetail } from "./components/OrderDetail";
export { OrderList } from "./components/OrderList";
