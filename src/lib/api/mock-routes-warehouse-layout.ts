/**
 * Mock `GET /warehouses/{id}/layout` (BE LayoutController, cần `warehouse-locations:READ`). Kho trong store
 * module 06 (`mock-warehouse-store`) trả bản đồ đầy đủ; kho cũ của mock-data chỉ trả phần các màn
 * thao tác kho dùng: bin trong shelves → levels → bins, khu chứa trong areas, mỗi chỗ có `locationCode` +
 * `usable`. Dựng từ `locations` của mock-data; chỉ dùng khi USE_MOCK=true.
 */

import { WAREHOUSE_LOCATION_PERMISSIONS } from "@/constants";

import { registerMockRoute } from "./mock-adapter";
import { beError, beOk, readRouteId } from "./mock-routes-purchase-orders-store";
import { mockGrantsOf } from "./mock-user-grants";
import { mockStoredLayout } from "./mock-warehouse-layout-view";

import type { Location } from "@/lib/mock-data";

/** ASSUMPTION (mock-only): mã vị trí BE = `locationId` mock bỏ tiền tố `LOC-` (vd `HN-A01-01-01-A`). */
export const mockLocationCode = (location: Location) => location.locationId.replace(/^LOC-/, "");

/** BE `usable` = effectiveStatus ACTIVE — vị trí bị khoá / tắt thì không dùng được. */
export const isMockLocationUsable = (location: Location) =>
  location.status !== "Blocked" && location.status !== "Disabled";

/** Loại vị trí mock là khu chứa (BE Area có mã vị trí); aisle / rack / level / zone không phải chỗ chứa. */
const AREA_TYPES: readonly string[] = ["staging", "quarantine", "dock"];

export async function mockWarehouseLocations(warehouseId: string): Promise<Location[]> {
  const { locations } = await import("@/lib/mock-data");
  return locations.filter((location) => location.warehouseId === warehouseId);
}

/** Mã các bin lấy hàng được của kho (dùng được + pickable), sắp theo mã = thứ tự lộ trình mock. */
export async function mockPickableBinCodes(warehouseId: string): Promise<string[]> {
  return (await mockWarehouseLocations(warehouseId))
    .filter((location) => location.type === "bin" && location.isPickable)
    .filter(isMockLocationUsable)
    .map(mockLocationCode)
    .sort();
}

/** Người gọi có `warehouse-locations:READ` không (quyền theo `mock-user-grants`, như BFF mock). */
async function canReadLayout(): Promise<boolean> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const userId = useAuthStore.getState().user?.userId ?? "";
  return mockGrantsOf(userId).has(WAREHOUSE_LOCATION_PERMISSIONS.read);
}

export function registerWarehouseLayoutMockRoutes(): void {
  registerMockRoute("GET", "/warehouses/:id/layout", async (config) => {
    if (!(await canReadLayout())) return beError(403, "FORBIDDEN", "Access denied");
    const warehouseId = readRouteId(config);
    // Kho của store module 06 (seed demo BE + kho vừa tạo) → bản đồ đầy đủ như BE
    const stored = mockStoredLayout(warehouseId);
    if (stored) return beOk(stored);
    const { warehouses } = await import("@/lib/mock-data");
    if (!warehouses.some((warehouse) => warehouse.warehouseId === warehouseId)) {
      return beError(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found");
    }
    const places = await mockWarehouseLocations(warehouseId);
    const toPlace = (location: Location) => ({
      locationCode: mockLocationCode(location),
      usable: isMockLocationUsable(location),
    });
    return beOk({
      shelves: [
        {
          levels: [{ bins: places.filter((place) => place.type === "bin").map(toPlace) }],
        },
      ],
      areas: places.filter((place) => AREA_TYPES.includes(place.type)).map(toPlace),
    });
  });
}
