import type { z } from "zod";

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
  BoundaryCreateBody,
  BoundaryCreateInput,
  WarehouseCreateBody,
  WarehouseCreateInput,
  ZoneCreateBody,
  ZoneCreateInput,
} from "./input-schemas";
export type {
  AreaCreateInput,
  AreaCreateValues,
  ShelfCreateInput,
  ShelfCreateValues,
} from "./input-schemas-layout";

/** Đổi trạng thái kệ hoặc khu vực (`PUT /shelves|areas/{id}/status`). */
export interface PlaceStatusInput {
  kind: "shelf" | "area";
  id: string;
  status: LocationStatus;
}

/** Các bước của "Thêm kệ": tạo kệ → tạo N tầng → sinh bin (docs 06 §4.1 bước 5–7). */
export type ShelfCreateStep =
  { phase: "shelf" } | { phase: "levels"; done: number; total: number } | { phase: "bins" };
