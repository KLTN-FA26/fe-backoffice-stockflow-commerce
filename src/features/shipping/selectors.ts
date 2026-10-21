/**
 * Shipping — selector thuần: đối soát biên bản với kiện đã quét (docs 09 §4.1 bước 3, BR-03).
 */

import type { Load, LoadParcel, LoadShipment, ShipmentRow } from "./types";

export function isParcelLoaded(parcel: LoadParcel): boolean {
  return parcel.loaded;
}

/** Lô đủ kiện khi mọi kiện của nó đã lên xe (và có ít nhất một kiện). */
export function isShipmentComplete(shipment: LoadShipment): boolean {
  return shipment.packageCount > 0 && shipment.loadedCount >= shipment.packageCount;
}

export function missingParcels(shipment: LoadShipment): LoadParcel[] {
  return shipment.packages.filter((parcel) => !parcel.loaded);
}

export interface LoadReconciliation {
  expected: number;
  loaded: number;
  /** 0..100, làm tròn xuống — 100 chỉ khi đủ kiện. */
  progress: number;
  /** Lô còn thiếu kiện. */
  incompleteShipments: LoadShipment[];
}

export function reconcileLoad(
  load: Pick<Load, "expectedPackageCount" | "loadedPackageCount" | "shipments">,
): LoadReconciliation {
  const expected = load.expectedPackageCount;
  const loaded = load.loadedPackageCount;
  return {
    expected,
    loaded,
    progress: expected === 0 ? 0 : Math.min(100, Math.floor((loaded / expected) * 100)),
    incompleteShipments: load.shipments.filter((shipment) => !isShipmentComplete(shipment)),
  };
}

/** Mã kiện đang nằm trên xe của chuyến — để bỏ khỏi danh sách "quét không thành công". */
export function loadedLabelCodes(load: Pick<Load, "shipments">): string[] {
  return load.shipments.flatMap((shipment) =>
    shipment.packages.filter(isParcelLoaded).map((parcel) => parcel.labelCode),
  );
}

export function findShipmentByCode(
  load: Pick<Load, "shipments">,
  code: string,
): LoadShipment | undefined {
  return load.shipments.find((shipment) => shipment.code === code);
}

export interface SelectedShipmentsSummary {
  /** Kho chung của các lô đã chọn; `null` khi không chọn lô nào. */
  warehouseId: string | null;
  mixedWarehouses: boolean;
  /** Hãng chung đã gán; `null` khi chưa lô nào gán hoặc các lô gán hãng khác nhau. */
  carrierId: string | null;
  mixedCarriers: boolean;
}

/** Tóm tắt các lô đã chọn để mở chuyến: cùng một kho, cùng một hãng (BE 409 SHIPMENT_NOT_FOR_LOAD / OTHER_CARRIER). */
export function summarizeSelection(rows: readonly ShipmentRow[]): SelectedShipmentsSummary {
  const warehouses = new Set(rows.map((row) => row.warehouseId));
  const carriers = new Set(rows.map((row) => row.carrierId).filter((id): id is string => !!id));
  return {
    warehouseId: warehouses.size === 1 ? (rows[0]?.warehouseId ?? null) : null,
    mixedWarehouses: warehouses.size > 1,
    carrierId: carriers.size === 1 ? ([...carriers][0] ?? null) : null,
    mixedCarriers: carriers.size > 1,
  };
}
