import type { z } from "zod";

import type { ShelfBuild } from "./draft";

import type {
  boundaryDto,
  footprintDto,
  layoutAreaDto,
  layoutBinDto,
  layoutLevelDto,
  layoutShelfDto,
  warehouseDto,
  warehouseLayoutDto,
  zoneDto,
} from "./schemas";

export type Warehouse = z.infer<typeof warehouseDto>;
export type Footprint = z.infer<typeof footprintDto>;
export type Zone = z.infer<typeof zoneDto>;
export type LayoutBin = z.infer<typeof layoutBinDto>;
export type LayoutLevel = z.infer<typeof layoutLevelDto>;
export type LayoutShelf = z.infer<typeof layoutShelfDto>;
export type LayoutArea = z.infer<typeof layoutAreaDto>;
export type Boundary = z.infer<typeof boundaryDto>;
export type WarehouseLayout = z.infer<typeof warehouseLayoutDto>;
export type LocationStatus = LayoutShelf["status"];

export type {
  WarehouseCreateBody,
  WarehouseCreateInput,
  ZoneCreateBody,
  ZoneCreateInput,
} from "./input-schemas";

/** Đổi trạng thái kệ hoặc khu vực (`PUT /shelves|areas/{id}/status`). */
export interface PlaceStatusInput {
  kind: "shelf" | "area";
  id: string;
  status: LocationStatus;
}

/** Thông số tự sinh bin (`GenerateBins`, BR-14) — phần lưới của `ShelfBuild` trong bản nháp. */
export type BinGeneration = Omit<ShelfBuild, "levelCount" | "levelHeight" | "generateBins">;
