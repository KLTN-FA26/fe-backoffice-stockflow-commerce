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
import type {
  atpInput,
  reservationListInput,
  reservationPageDto,
  reservationRowDto,
  stockAlertDto,
  stockAlertListInput,
  stockAlertPageDto,
  stockLevelDto,
  stockLevelsInput,
  warehouseStockItemDto,
  warehouseStockItemPageDto,
  warehouseStockItemsInput,
} from "./stock-schemas";

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

// Inventory overview (SCRUM-438) backend read contracts. Params are the caller-side input:
// the schemas normalise SKU, drop blanks and comma-join list filters before the request.
export type StockLevel = z.infer<typeof stockLevelDto>;
export type WarehouseStockItem = z.infer<typeof warehouseStockItemDto>;
export type WarehouseStockItemPage = z.infer<typeof warehouseStockItemPageDto>;
export type StockReservation = z.infer<typeof reservationRowDto>;
export type StockReservationPage = z.infer<typeof reservationPageDto>;
export type StockAlert = z.infer<typeof stockAlertDto>;
export type StockAlertPage = z.infer<typeof stockAlertPageDto>;
export type StockLevelsParams = z.input<typeof stockLevelsInput>;
export type WarehouseStockItemsParams = z.input<typeof warehouseStockItemsInput>;
export type AtpParams = z.input<typeof atpInput>;
export type ReservationListParams = z.input<typeof reservationListInput>;
export type StockAlertListParams = z.input<typeof stockAlertListInput>;
