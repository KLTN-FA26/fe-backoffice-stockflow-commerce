import {
  QUARANTINE_ACTION,
  QUARANTINE_PACKAGE_STATUS_IN_STOCK,
  QUARANTINE_STOCK_STATUS,
} from "@/constants/quarantine";
import { INVENTORY_PERMISSIONS, STOCK_PACKAGE_PERMISSIONS } from "@/constants/permissions";

import type { StockPackageDetail } from "./quarantine-types";
import type { PermissionCode } from "@/lib/auth";

export type QuarantineAction = (typeof QUARANTINE_ACTION)[keyof typeof QUARANTINE_ACTION];

// Docs 20 §5.1: the stock of a carton is `Quarantine` when what it holds is; the carton itself stays `In Stock`.
export function isQuarantined(carton: StockPackageDetail): boolean {
  return (carton.contents ?? []).some((row) => row.status === QUARANTINE_STOCK_STATUS);
}

// Docs 20 §4.8 bước 2: only a free carton is quarantined — one held for an order is released / reallocated first.
export function isHeldForOrder(carton: StockPackageDetail): boolean {
  return carton.reserved > 0;
}

/**
 * Docs 20 §4.8, BR-21: only the warehouse manager quarantines / releases (`inventory-stock-packages:UPDATE`),
 * and only a carton that is still `In Stock`. UI-only — StockPackageController re-checks all of it.
 */
export function allowedQuarantineActions(
  carton: StockPackageDetail,
  can: (code: PermissionCode) => boolean,
): QuarantineAction[] {
  if (carton.status !== QUARANTINE_PACKAGE_STATUS_IN_STOCK) return [];
  if (!can(STOCK_PACKAGE_PERMISSIONS.update)) return [];
  if (isQuarantined(carton)) return [QUARANTINE_ACTION.RELEASE];
  return isHeldForOrder(carton) ? [] : [QUARANTINE_ACTION.QUARANTINE];
}

// Writing a damaged carton off is an adjustment request (docs 20 §4.3, §4.8 bước 3): floor work, then four eyes.
export function canWriteOffCarton(
  carton: StockPackageDetail,
  can: (code: PermissionCode) => boolean,
): boolean {
  return (
    carton.status === QUARANTINE_PACKAGE_STATUS_IN_STOCK &&
    isQuarantined(carton) &&
    can(INVENTORY_PERMISSIONS.stockUpdate)
  );
}
