/**
 * Shipping — selector thuần: đối soát biên bản với kiện đã quét (docs 09 §4.1 bước 3, BR-03).
 */

import type { Load, LoadParcel, LoadShipment } from "./types";

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

/** Kiện có mã nhãn này đang nằm trên xe của chuyến (so không phân biệt hoa thường như BE). */
export function isLabelLoaded(load: Pick<Load, "shipments">, labelCode: string): boolean {
  const wanted = labelCode.toUpperCase();
  return loadedLabelCodes(load).some((code) => code.toUpperCase() === wanted);
}

export function findShipmentByCode(
  load: Pick<Load, "shipments">,
  code: string,
): LoadShipment | undefined {
  return load.shipments.find((shipment) => shipment.code === code);
}
