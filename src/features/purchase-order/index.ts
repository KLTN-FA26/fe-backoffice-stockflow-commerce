/**
 * Purchase Order — feature public API.
 *
 * Template for all feature modules. Other modules follow this pattern:
 *   types.ts    → z.infer types from schemas.ts
 *   api.ts      → axios calls (list, detail, create, update, transition)
 *   queries.ts  → React Query hooks using factory (createListQuery, createDetailQuery)
 *   mutations.ts → mutation hooks using factory (createMutation, createTransitionMutation)
 *   index.ts    → barrel export
 */

// Types
export type {
  Currency,
  PurchaseOrder,
  PoLine,
  PoStatus,
  ProposalStatus,
  ReplenishmentProposal,
  Supplier,
  Warehouse,
} from "./types";

// Schemas
export {
  createPoSchema,
  poLineInputSchema,
  poLineSchema,
  poStatusSchema,
  poStatusValues,
  proposalStatusSchema,
  proposalStatusValues,
  purchaseOrderSchema,
  receiveGoodsInputSchema,
  receiveGoodsLineInputSchema,
  replenishmentProposalSchema,
} from "./schemas";
export type {
  CreatePoInput,
  PoLineDto,
  PoLineInput,
  PoStatusCount,
  PoStatusValue,
  ProposalStatusValue,
  PurchaseOrderDto,
  ReceiveGoodsInput,
  ReplenishmentProposalDto,
  SupplierSpendRow,
} from "./schemas";

// Lifecycle
export {
  PO_ACTIONS,
  PO_TRANSITIONS,
  allowedPoActions,
  allowedTransitions,
  canTransition,
  isPoTerminal,
  isTerminal,
  nextPoStatuses,
} from "./lifecycle";
export type { PoAction } from "./lifecycle";

// Selectors
export {
  formatMoney,
  openQuantity,
  shouldFlagPoRow,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
  validateReceiveDraft,
} from "./selectors";
export type { ReceiveDraftResult } from "./selectors";

// Query hooks
export {
  poDashboardKeys,
  poKeys,
  poSupplierKeys,
  poWarehouseKeys,
  replenishmentKeys,
  supplierSpendKeys,
  usePoStatusDashboard,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrder,
  usePurchaseOrders,
  useReplenishmentProposals,
  useSupplierSpend,
} from "./queries";

// Mutation hooks
export {
  useApprovePo,
  useCancelPo,
  useCloseShortPo,
  useCreatePo,
  useReceiveGoodsPo,
  useSendPo,
} from "./mutations";

// API (for direct use in non-hook contexts)
export type { CreatePoResult, ListPoParams, ReceiveLineInput } from "./api";
