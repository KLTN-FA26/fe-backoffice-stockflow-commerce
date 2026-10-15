/**
 * Fixture chuyến xe theo contract đề xuất SCRUM-288 (features/shipping/api.ts).
 */

import type { Load, LoadLine } from "../types";

export const LOAD_ID = "LOAD-2026-0001";

export function line(index: number, loadedAt: string | null): LoadLine {
  return {
    loadLineId: `ll-${index}`,
    packageId: `pkg-${index}`,
    packageCode: `PKG-000${index}`,
    orderId: `ORD-2026-000${index}`,
    orderNumber: `ORD-2026-000${index}`,
    weightKg: 1.5,
    loadedAt,
    loadedBy: loadedAt ? "staff" : null,
  };
}

export function apiLoad(patch: Partial<Load> = {}): Load {
  const lines = patch.lines ?? [line(1, "2026-10-12T01:10:00Z"), line(2, null)];
  return {
    loadId: LOAD_ID,
    number: LOAD_ID,
    warehouseId: "WH-HCM-01",
    status: "LOADING",
    vehiclePlate: "51C-628.14",
    vehicleType: "Xe tải 1,5 tấn",
    carrierName: "Giao Hàng Nhanh",
    bookedAt: "2026-10-12T00:30:00Z",
    dispatchedAt: null,
    manifest: null,
    version: 2,
    ...patch,
    lines,
    plannedPackages: lines.length,
    loadedPackages: lines.filter((l) => l.loadedAt).length,
  };
}
