/**
 * Luật dùng chung của mock module 06 — cổng quyền, mã thành phần vị trí (BR-10), footprint và kiểm
 * hình học BR-06 / BR-07 như BE `Footprint`. Chỉ dùng khi USE_MOCK=true.
 */

import { fail, text } from "./mock-route-utils";
import { mockGrantsOf } from "./mock-user-grants";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { PermissionCode } from "@/lib/auth";
import type { MockFootprint, MockWarehouse } from "./mock-warehouse-store";

const PART = /^[A-Za-z0-9]+$/;

/** Cổng quyền thay `@RequiresPermission` — theo userId của phiên mock. */
export async function mockCan(code: PermissionCode): Promise<boolean> {
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  return mockGrantsOf(useAuthStore.getState().user?.userId ?? "").has(code);
}

export const forbidden = () => fail(403, "FORBIDDEN", "Access denied");
export const invalid = (field: string, message: string) =>
  fail(400, "VALIDATION_FAILED", "Invalid request data", [{ field, message }]);

/** Mã thành phần vị trí (BR-10): A–Z0–9, không `-`, tự viết hoa. */
export function locationPart(value: unknown, max: number): string | null {
  const raw = text(value);
  return raw && raw.length <= max && PART.test(raw) ? raw.toUpperCase() : null;
}

/** BE `Footprint`: toạ độ ≥ 0, cạnh > 0, xoay 0/90/180/270; `null` nếu sai. */
export function footprintOf(value: unknown): MockFootprint | null {
  if (!value || typeof value !== "object") return null;
  const f = value as Record<string, unknown>;
  const [x, y, width, length, rotation] = [f.x, f.y, f.width, f.length, f.rotation].map(Number);
  if ([x, y, width, length].some((n) => !Number.isFinite(n))) return null;
  if (x < 0 || y < 0 || width <= 0 || length <= 0 || ![0, 90, 180, 270].includes(rotation))
    return null;
  return { x, y, width, length, rotation };
}

export const boxOf = (f: MockFootprint) => {
  const turned = f.rotation === 90 || f.rotation === 270;
  return { x: f.x, y: f.y, w: turned ? f.length : f.width, h: turned ? f.width : f.length };
};

/** BR-06 / BR-07 dưới "khoá theo kho": trong khung, không chồng lấn kệ / khu vực không INACTIVE. */
export function placementError(warehouse: MockWarehouse, footprint: MockFootprint) {
  const b = boxOf(footprint);
  if (b.x + b.w > warehouse.mapWidth || b.y + b.h > warehouse.mapHeight)
    return fail(409, "LAYOUT_OUT_OF_BOUNDS", "The shape leaves the warehouse map");
  const { shelves, areas } = getWarehouseStore();
  const clash = [...shelves, ...areas].some((place) => {
    if (place.warehouseId !== warehouse.id || place.status === "INACTIVE") return false;
    const o = boxOf(place.footprint);
    return b.x < o.x + o.w && o.x < b.x + b.w && b.y < o.y + o.h && o.y < b.y + b.h;
  });
  return clash ? fail(409, "LAYOUT_OVERLAP", "The shape overlaps a shelf or an area") : null;
}

export function warehouseOf(id: string) {
  return getWarehouseStore().warehouses.get(id) ?? null;
}

export const notFound = () => fail(404, "WAREHOUSE_NOT_FOUND", "Warehouse not found");
