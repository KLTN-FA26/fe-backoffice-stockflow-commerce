/**
 * Purchase Order — types.
 *
 * PO types are inferred from the zod schemas (never declared by hand). Master data
 * (Supplier / Warehouse / ReplenishmentProposal) still comes from the FE-only mock
 * because BE has no endpoint for it yet — see `api.ts`.
 */

import type {
  Currency,
  ProposalStatus,
  ReplenishmentProposal,
  Supplier,
  Warehouse,
} from "@/lib/mock-data";

import type { PoLineDto, PoStatusValue, PurchaseOrderDto } from "./schemas";

export type PoStatus = PoStatusValue;
export type PoLine = PoLineDto;
export type PurchaseOrder = PurchaseOrderDto;

export type { Currency, ProposalStatus, ReplenishmentProposal, Supplier, Warehouse };
