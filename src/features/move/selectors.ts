import {
  MOVE_CARTON_STATUS_IN_STOCK,
  MOVE_LIMITS,
  MOVE_MESSAGES,
  MOVE_STAGING_AREA_TYPE,
} from "@/constants/move";

import type { Carton, ScannedCarton, WarehouseLayout } from "./types";

// BE `LocationId`: trim + upper case.
export function normalizeLocation(code: string): string {
  return code.trim().toUpperCase();
}

// LPN in hoa trên tem (BE `LPN-yyyyMMdd-nnnnnn`); máy quét / người gõ có thể kèm khoảng trắng hoặc chữ thường.
export function normalizeLpn(lpn: string): string {
  return lpn.trim().toUpperCase();
}

/** Warehouse prefix = the segment before the first hyphen (BE `LocationId.warehouseCode()`). */
export function warehouseOf(code: string): string {
  const normalized = normalizeLocation(code);
  const dash = normalized.indexOf(MOVE_LIMITS.warehouseSeparator);
  return dash > 0 ? normalized.slice(0, dash) : normalized;
}

/** Mã thuộc kho của tab — vị trí `HCM-…` của kho `HCM` (06 BR-10). */
export function isInWarehouse(code: string, prefix: string): boolean {
  return normalizeLocation(code).startsWith(
    `${prefix.toUpperCase()}${MOVE_LIMITS.warehouseSeparator}`,
  );
}

/**
 * Lý do một thùng vừa tra KHÔNG được vào danh sách (docs 11 §4.1 bước 1), hoặc `null`. UI-only — BE kiểm lại khi gửi:
 * - BR-05: thùng có phần giữ cho đơn (`reserved > 0`) chỉ rời vị trí bằng lấy hàng (STOCK_PACKAGE_HELD).
 * - BR-04: chỉ thùng `IN_STOCK` mới chuyển (INVALID_STOCK_PACKAGE_TRANSITION).
 * - BR-01: thùng ở kho khác kho của tab (403 OUT_OF_DATA_SCOPE / MOVE_ACROSS_WAREHOUSES).
 */
export function cartonProblem(carton: Carton, prefix: string): string | null {
  if (carton.status !== MOVE_CARTON_STATUS_IN_STOCK) {
    return MOVE_MESSAGES.notInStock(carton.lpn, carton.status);
  }
  if (carton.reserved > 0) return MOVE_MESSAGES.held(carton.lpn);
  if (!carton.locationCode || !isInWarehouse(carton.locationCode, prefix)) {
    return MOVE_MESSAGES.cartonOtherWarehouse(carton.lpn, prefix.toUpperCase());
  }
  return null;
}

/** LPN đã ở sẵn vị trí đích — BE từ chối cả lệnh (requireMovableBetween → 422 VALIDATION_FAILED, docs 11 BR-01). */
export function cartonsAlreadyAt(cartons: readonly ScannedCarton[], toLocation: string): string[] {
  const to = normalizeLocation(toLocation);
  if (to === "") return [];
  return cartons
    .filter((carton) => carton.locationCode && normalizeLocation(carton.locationCode) === to)
    .map((carton) => carton.lpn);
}

/**
 * Dữ liệu dẫn xuất của danh sách thùng cho form: vị trí hiện tại (`here`, để đánh dấu trên bản đồ và bỏ khỏi gợi ý),
 * thùng đã ở sẵn đích, tập LPN, và các dòng cần đánh dấu đỏ — thùng ở sẵn đích + thùng BE vừa từ chối (chỉ khi còn trong
 * danh sách).
 */
export function cartonMarks(
  cartons: readonly ScannedCarton[],
  toLocation: string,
  rejectedLpn: string | undefined,
) {
  const here = cartons.flatMap((carton) => (carton.locationCode ? [carton.locationCode] : []));
  const alreadyAt = cartonsAlreadyAt(cartons, toLocation);
  const inList = new Set(cartons.map((carton) => carton.lpn));
  const rejected = rejectedLpn && inList.has(rejectedLpn) ? [rejectedLpn] : [];
  return { here, alreadyAt, inList, flagged: new Set([...alreadyAt, ...rejected]) };
}

/**
 * Vị trí đích gợi ý (docs 11 §4.1 bước 2): bin / khu `usable` của kho, không phải khu tập kết (BR-09), khác vị trí hiện
 * tại của mọi thùng trong danh sách. Sắp xếp, không trùng.
 */
export function destinationCodes(
  layout: WarehouseLayout | undefined,
  exclude: readonly string[] = [],
): string[] {
  if (!layout) return [];
  const skip = new Set(exclude.map(normalizeLocation));
  const places = [
    ...layout.shelves.flatMap((shelf) => shelf.levels.flatMap((level) => level.bins)),
    ...layout.areas,
  ];
  const codes = places
    .filter((place) => place.usable === true && place.locationCode)
    .filter((place) => place.type !== MOVE_STAGING_AREA_TYPE)
    .map((place) => normalizeLocation(place.locationCode ?? ""))
    .filter((code) => !skip.has(code));
  return [...new Set(codes)].sort();
}

/** Ô tìm thùng: mã vị trí của kho tab (`HCM-…`) → lọc theo vị trí, còn lại là SKU. Rỗng → không tìm. */
export function cartonSearchParams(
  term: string,
  prefix: string,
): { location: string } | { sku: string } | null {
  const value = term.trim().toUpperCase();
  if (value === "") return null;
  return isInWarehouse(value, prefix) ? { location: value } : { sku: value };
}

/** Thùng của tab: BE liệt kê mọi kho người dùng được phân — bộ tìm chỉ giữ thùng trong kho đang làm việc. */
export function cartonsInWarehouse(cartons: readonly Carton[], prefix: string): Carton[] {
  return cartons.filter(
    (carton) => carton.locationCode && isInWarehouse(carton.locationCode, prefix),
  );
}

/** Thùng đã tra → dòng của danh sách sẽ chuyển. */
export function toScanned(carton: Carton): ScannedCarton {
  return {
    lpn: normalizeLpn(carton.lpn),
    sku: carton.sku,
    lotNumber: carton.lotNumber ?? null,
    onHand: carton.onHand,
    locationCode: carton.locationCode ?? null,
  };
}
