import type { z } from "zod";
import type {
  capacityBoardDto,
  capacityGroupDto,
  factorWarehouseDto,
  utilizationFactorInput,
} from "./schemas";

export type CapacityBoard = z.infer<typeof capacityBoardDto>;
export type CapacityGroup = z.infer<typeof capacityGroupDto>;
export type CapacityGroupKind = CapacityGroup["kind"];
export type FactorWarehouse = z.infer<typeof factorWarehouseDto>;
export type UtilizationFactorInput = z.infer<typeof utilizationFactorInput>;

/** Lưu hệ số: bản kho vừa đọc (để gửi lại đủ trường + `version`) và hệ số mới (0, 1]. */
export interface UtilizationFactorUpdate {
  warehouse: FactorWarehouse;
  utilizationFactor: number;
}
