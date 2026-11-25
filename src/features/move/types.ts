import type { z } from "zod";

import type {
  binSuggestionDto,
  binSuggestionsDto,
  cartonDto,
  movedCartonDto,
  moveCreateInput,
  scannedCartonSchema,
  warehouseLayoutDto,
} from "./schemas";

export type MoveCreateInput = z.infer<typeof moveCreateInput>;
export type MovedCarton = z.infer<typeof movedCartonDto>;
export type Carton = z.infer<typeof cartonDto>;
export type ScannedCarton = z.infer<typeof scannedCartonSchema>;
export type WarehouseLayout = z.infer<typeof warehouseLayoutDto>;
export type BinSuggestion = z.infer<typeof binSuggestionDto>;
export type BinSuggestions = z.infer<typeof binSuggestionsDto>;
