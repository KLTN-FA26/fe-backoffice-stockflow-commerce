import type { z } from "zod";

import type {
  adjustmentCreateInput,
  adjustmentListInput,
  adjustmentPageDto,
  adjustmentRejectionInput,
  movementListInput,
  movementPageDto,
  stockAdjustmentDto,
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
