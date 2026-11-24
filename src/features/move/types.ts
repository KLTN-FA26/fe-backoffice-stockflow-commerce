import type { z } from "zod";

import type {
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
