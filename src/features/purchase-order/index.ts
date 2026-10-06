/**
 * Purchase Order — public API của feature (docs 02-purchase-order ↔ BE PurchaseOrderController).
 */

// Types
export type {
  DeliveryAttempt,
  DeliveryDecision,
  PoDeliveryStatus,
  PoLine,
  PoStatus,
  PurchaseOrder,
  SupplierConfirmationStatus,
} from "./types";

// Schemas
export {
  PO_DELIVERY_STATUSES,
  PO_INPUT_CURRENCIES,
  PO_REASON_MAX,
  SUPPLIER_CONFIRMATION_STATUSES,
  createPoSchema,
  receiveGoodsInputSchema,
  recoverDeliveryInputSchema,
  sendPoInputSchema,
  supplierConfirmationInputSchema,
} from "./schemas";
export type {
  CreatePoInput,
  PoStatusCount,
  RecoverDeliveryInput,
  SendPoInput,
  SupplierConfirmationInput,
  SupplierSpendRow,
} from "./schemas";

// Form tạo PO (react-hook-form) — schema chuỗi + map lỗi BE vào ô
export { poCreateFormSchema } from "./create-form-schema";
export type { PoCreateFormLine, PoCreateFormValues } from "./create-form-schema";
export { poCreateFieldErrors } from "./create-form-errors";
export type { PoCreateFieldError, PoCreateFieldPath } from "./create-form-errors";

// Lifecycle
export {
  PO_ACTIONS,
  PO_TRANSITIONS,
  allowedPoActions,
  isPoTerminal,
  nextPoStatuses,
} from "./lifecycle";
export type { PoAction, PoActionCode, PoGateState } from "./lifecycle";

// Selectors
export {
  deliveryFailureName,
  hasDeliveryDateWarning,
  isDeliveryFailing,
  isDeliveryInFlight,
  linesMissingDescription,
  showsCancellationNotice,
  deliveryRound,
  formatMoney,
  isExpectedDatePast,
  isFirstDelivery,
  openQuantity,
  shouldFlagPoRow,
  suggestExpectedDate,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
  validateReceiveDraft,
} from "./selectors";
export type { ReceiveDraftResult } from "./selectors";

// Errors
export { isStalePoError, poErrorMessage } from "./errors";
export type { PoErrorContext } from "./errors";

// Query hooks
export {
  poKeys,
  usePoDeliveries,
  usePoDeliveryDecisions,
  usePoStatusDashboard,
  usePurchaseOrder,
  usePurchaseOrders,
  useSupplierSpend,
} from "./queries";

// Mutation hooks
export {
  useApprovePo,
  useCancelPo,
  useCloseShortPo,
  useCreatePo,
  useReceiveGoodsPo,
  useRecordSupplierConfirmation,
  useRecoverPoDelivery,
  useSendPo,
} from "./mutations";

// API types
export type { PoHistoryParams, ReceiveLineInput } from "./api";
