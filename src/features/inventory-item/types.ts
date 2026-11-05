import type { z } from "zod";

import type {
  inventoryItemDtoSchema,
  inventoryItemPageSchema,
  inventoryItemSummaryDtoSchema,
  itemEvaluationDtoSchema,
  itemLogisticsDtoSchema,
  itemPolicyDtoSchema,
  logisticsFormSchema,
  policyFormSchema,
  REMOVAL_STRATEGIES,
  STORAGE_CLASSES,
  TRACKING_MODES,
} from "./schemas";

export type InventoryItemSummary = z.infer<typeof inventoryItemSummaryDtoSchema>;
export type InventoryItemPage = z.infer<typeof inventoryItemPageSchema>;
export type InventoryItem = z.infer<typeof inventoryItemDtoSchema>;
export type ItemLogistics = z.infer<typeof itemLogisticsDtoSchema>;
export type ItemPolicy = z.infer<typeof itemPolicyDtoSchema>;
export type ItemEvaluation = z.infer<typeof itemEvaluationDtoSchema>;
export type LogisticsFormValues = z.infer<typeof logisticsFormSchema>;
export type PolicyFormValues = z.infer<typeof policyFormSchema>;
export type StorageClass = (typeof STORAGE_CLASSES)[number];
export type TrackingMode = (typeof TRACKING_MODES)[number];
export type RemovalStrategy = (typeof REMOVAL_STRATEGIES)[number];
