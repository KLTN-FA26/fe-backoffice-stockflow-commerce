/**
 * Purchase Order — types.
 *
 * BE contract (PurchaseOrderStatus.java): 7-state SCREAMING_SNAKE.
 * Mock seed (mock-data.ts) still uses legacy Title Case for demo;
 * the FE canonical PoStatus is BE (from constants). Mappers bridge the gap.
 */

import type { PoStatus as BEPoStatus } from "@/constants";
import type {
  Currency,
  PoLine as MockPoLine,
  PurchaseOrder as MockPurchaseOrder,
  ProposalStatus,
  ReplenishmentProposal,
  Supplier,
  Warehouse,
} from "@/lib/mock-data";

export type PoStatus = BEPoStatus;
export type PoLine = MockPoLine;
export type PurchaseOrder = Omit<MockPurchaseOrder, "status"> & { status: PoStatus };

export type { Currency, ProposalStatus, ReplenishmentProposal, Supplier, Warehouse };
