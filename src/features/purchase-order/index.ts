/**
 * Purchase Order — feature public API.
 *
 * Template for all feature modules. Other modules follow this pattern:
 *   types.ts    → re-export types from mock-data
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
  replenishmentProposalSchema,
  transitionPoSchema,
} from "./schemas";
export type {
  CreatePoInput,
  PoLineDto,
  PoLineInput,
  PoStatusValue,
  ProposalStatusValue,
  PurchaseOrderDto,
  ReplenishmentProposalDto,
  TransitionPoInput,
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
  computePoStats,
  formatCompactVND,
  formatMoney,
  isLineFullyReceived,
  openQuantity,
  receivedPercent,
  shouldFlagPoRow,
  totalOpenQuantity,
  totalOrderedQuantity,
  totalReceivedQuantity,
} from "./selectors";
export type { PoListStats } from "./selectors";

// Query hooks
export {
  poKeys,
  poSupplierKeys,
  poWarehouseKeys,
  replenishmentKeys,
  usePoSuppliers,
  usePoWarehouses,
  usePurchaseOrder,
  usePurchaseOrders,
  useReplenishmentProposals,
} from "./queries";

// Mutation hooks
export { useCreatePo, useTransitionPo, useUpdatePo } from "./mutations";

// API (for direct use in non-hook contexts)
export type { CreatePoResult, ListPoParams } from "./api";
