/**
 * Order — feature public API.
 *
 * types.ts    → re-export types from mock-data + constants/statuses
 * schemas.ts  → zod (admin-cancel input)
 * status-map.ts → BE→FE status mapping
 * api.ts      → axios calls (list, detail, admin-cancel)
 * queries.ts  → React Query hooks
 * mutations.ts → mutation hooks
 * lifecycle.ts → transition table + action-gating
 * selectors.ts → pure stats/flag derivations
 * index.ts    → barrel export
 */

// Types
export type { Order, OrderEvent, OrderLine, OrderStatus } from "./types";

// Schemas
export { adminCancelOrderSchema } from "./schemas";
export type { AdminCancelOrderInput as AdminCancelOrderFormInput } from "./schemas";

// Status mapping
export { mapBackendOrderStatus } from "./status-map";
export type { BackendOrderStatus } from "./status-map";

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
export { computeOrderStats, formatCompactVND, formatMoney, shouldFlagOrderRow } from "./selectors";
export type { OrderListStats } from "./selectors";

// Query hooks
export { orderKeys, useOrder, useOrderEvents, useOrders } from "./queries";

// Error mapping
export { adminCancelErrorView } from "./errors";
export type { OrderErrorView } from "./errors";

// Mutation hooks
export { useAdminCancelOrder } from "./mutations";

// API (for direct use in non-hook contexts)
export type { AdminCancelOrderInput, ListOrderParams } from "./api";

// List page config (display prefs, not shareable — see state-persistence.md)
export {
  DEFAULT_ORDERS_CONFIG,
  DEFAULT_SEARCH_FIELDS,
  DEFAULT_VISIBLE_COLUMNS,
  mergeOrdersConfig,
  ORDER_COLUMN_SEARCH_LABELS,
  ORDER_SEARCH_FIELDS,
  ORDER_TABLE_COLUMN_LABELS,
  orderStatTiles,
  ORDERS_STORAGE_KEY,
} from "./list-config";
export type {
  OrderColumnSearchKey,
  OrdersPageConfig,
  OrderSearchField,
  OrderTableColumnKey,
} from "./list-config";

// Components
export { OrderDetail } from "./components/OrderDetail";
export { OrderList } from "./components/OrderList";
