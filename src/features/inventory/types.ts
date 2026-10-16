import type { z } from "zod";

import type {
  adjustmentCreateInput,
  adjustmentListInput,
  adjustmentPageDto,
  adjustmentRejectionInput,
  atpLookupInputSchema,
  atpLookupResultSchema,
  inventoryHighlightSchema,
  inventoryOverviewSchema,
  movementListInput,
  movementPageDto,
  reservationRowSchema,
  stockAdjustmentDto,
  stockItemRowSchema,
  stockLevelRowSchema,
  stockMovementDto,
} from "./schemas";

export type StockAdjustment = z.infer<typeof stockAdjustmentDto>;
export type StockMovement = z.infer<typeof stockMovementDto>;
export type CreateAdjustmentInput = z.infer<typeof adjustmentCreateInput>;
export type RejectAdjustmentInput = z.infer<typeof adjustmentRejectionInput>;
export type AdjustmentListParams = z.infer<typeof adjustmentListInput>;
export type MovementListParams = z.infer<typeof movementListInput>;
export type AdjustmentPage = z.infer<typeof adjustmentPageDto>;
export type MovementPage = z.infer<typeof movementPageDto>;

// Inventory overview (SCRUM-438) UI view-models.
export type StockLevelRow = z.infer<typeof stockLevelRowSchema>;
export type InventoryHighlight = z.infer<typeof inventoryHighlightSchema>;
export type StockItemRow = z.infer<typeof stockItemRowSchema>;
export type ReservationRow = z.infer<typeof reservationRowSchema>;
export type AtpLookupInput = z.infer<typeof atpLookupInputSchema>;
export type AtpLookupResult = z.infer<typeof atpLookupResultSchema>;
export type InventoryOverviewData = z.infer<typeof inventoryOverviewSchema>;
