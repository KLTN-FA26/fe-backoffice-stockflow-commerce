import type { z } from "zod";

import type { moveCreateInput, stockMoveDto, stockRowDto, warehouseLayoutDto } from "./schemas";

export type MoveCreateInput = z.infer<typeof moveCreateInput>;
export type StockMove = z.infer<typeof stockMoveDto>;
export type StockRow = z.infer<typeof stockRowDto>;
export type WarehouseLayout = z.infer<typeof warehouseLayoutDto>;
