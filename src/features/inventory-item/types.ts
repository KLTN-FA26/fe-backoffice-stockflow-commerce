import type { z } from "zod";

import type {
  inventoryItemDtoSchema,
  inventoryItemPageSchema,
  inventoryItemSummaryDtoSchema,
  itemLogisticsDtoSchema,
  logisticsFormSchema,
} from "./schemas";

export type InventoryItemSummary = z.infer<typeof inventoryItemSummaryDtoSchema>;
export type InventoryItemPage = z.infer<typeof inventoryItemPageSchema>;
export type InventoryItem = z.infer<typeof inventoryItemDtoSchema>;
export type ItemLogistics = z.infer<typeof itemLogisticsDtoSchema>;
export type LogisticsFormValues = z.infer<typeof logisticsFormSchema>;
