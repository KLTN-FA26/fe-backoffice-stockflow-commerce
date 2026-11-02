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
  recoverDeliveryInputSchema,
  sendPoInputSchema,
  supplierConfirmationInputSchema,
  updatePoSchema,
} from "./schemas";
export type {
  CreatePoInput,
  PoStatusCount,
  RecoverDeliveryInput,
  SendPoInput,
  SupplierConfirmationInput,
  SupplierSpendRow,
  UpdatePoInput,
} from "./schemas";

// Form tạo PO (react-hook-form) — schema chuỗi + map lỗi BE vào ô
export { poCreateFormSchema, poFormSchema } from "./create-form-schema";
export {
  minimumOrderQuantity,
  orderQuantityIssues,
  poQuantityTermsMessage,
  termsOf,
} from "./line-terms";
export type { OrderQuantityIssue, PoLineTerms } from "./line-terms";
export type { PoCreateFormLine, PoCreateFormValues } from "./create-form-schema";
export { poCreateFieldErrors } from "./create-form-errors";
export { poToFormValues } from "./draft-form";
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
  deliveryAlert,
  isDeliveryFailing,
  isDeliveryInFlight,
  linesMissingDescription,
  showsCancellationNotice,
  deliveryRound,
  effectiveUnitPrice,
  isUnitPriceRequired,
  formatMoney,
  planLeadTimeDays,
  isExpectedDatePast,
  isFirstDelivery,
  openQuantity,
  poAttentionReason,
  shouldFlagPoRow,
  suggestExpectedDate,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
} from "./selectors";

// Errors
export { isStalePoError, poErrorMessage } from "./errors";
export type { PoErrorContext } from "./errors";

// Query hooks
export {
  poKeys,
  usePoDeliveries,
  useRefreshDeliveriesOnSettle,
  usePoDeliveryDecisions,
  usePoStatusDashboard,
  usePurchaseOrder,
  usePurchaseOrderReload,
  usePurchaseOrders,
  useSupplierSpend,
} from "./queries";

// Mutation hooks
export {
  useApprovePo,
  useCancelPo,
  useClosePo,
  useCloseShortPo,
  useCreatePo,
  useRecordSupplierConfirmation,
  useRecoverPoDelivery,
  useRejectPo,
  useSendPo,
  useSubmitPo,
  useUpdateDraftPo,
} from "./mutations";

// API types
export type { CreatePoResult, PoHistoryParams } from "./api";
