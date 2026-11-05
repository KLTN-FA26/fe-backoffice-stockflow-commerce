/** Kiểu của ước tính xếp xe — suy ra từ zod (`estimate-schemas.ts`), không khai báo tay. */

import type { z } from "zod";

import type {
  CreateEstimateInputSchema,
  EstimateLineSchema,
  EstimateMetaSchema,
  EstimateUnplacedSchema,
  EstimateVehicleTypeSchema,
  EstimateWarningSchema,
  KitWarningSchema,
  LoadEstimateSchema,
  MissingLineSchema,
} from "./estimate-schemas";

export type LoadEstimate = z.infer<typeof LoadEstimateSchema>;
export type EstimateLine = z.infer<typeof EstimateLineSchema>;
export type MissingLine = z.infer<typeof MissingLineSchema>;
export type EstimateWarning = z.infer<typeof EstimateWarningSchema>;
export type KitWarning = z.infer<typeof KitWarningSchema>;
export type EstimateUnplaced = z.infer<typeof EstimateUnplacedSchema>;
export type EstimateMeta = z.infer<typeof EstimateMetaSchema>;
export type EstimateVehicleType = z.infer<typeof EstimateVehicleTypeSchema>;
export type CreateEstimateInput = z.infer<typeof CreateEstimateInputSchema>;
