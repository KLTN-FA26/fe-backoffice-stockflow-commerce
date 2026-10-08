import type { z } from "zod";

import type {
  atpLookupInputSchema,
  atpLookupResultSchema,
  inventoryHighlightSchema,
  inventoryOverviewSchema,
  reservationRowSchema,
  stockItemRowSchema,
  stockLevelRowSchema,
} from "./schemas";

export type StockLevelRow = z.infer<typeof stockLevelRowSchema>;
export type InventoryHighlight = z.infer<typeof inventoryHighlightSchema>;
export type StockItemRow = z.infer<typeof stockItemRowSchema>;
export type ReservationRow = z.infer<typeof reservationRowSchema>;
export type AtpLookupInput = z.infer<typeof atpLookupInputSchema>;
export type AtpLookupResult = z.infer<typeof atpLookupResultSchema>;
export type InventoryOverviewData = z.infer<typeof inventoryOverviewSchema>;
