/**
 * Fixture chuyến xe / lô giao theo contract BE PR #137 (features/shipping/api.ts). Trường null của BE
 * bị BỎ khỏi JSON (Jackson non_null) nên fixture cũng bỏ — schema `.nullish()` được chạm đúng.
 */

import type { Load, LoadParcel, LoadShipment, Manifest, Shipment, ShipmentRow } from "../types";

export const LOAD_ID = "LOAD-2026-0001";
export const WAREHOUSE_ID = "wh-hcm";
export const CARRIER_ID = "car-ghn";

export function parcel(code: string, loaded: boolean, patch: Partial<LoadParcel> = {}): LoadParcel {
  return {
    packageId: `pkg-${code}`,
    labelCode: code,
    weightKg: 1.5,
    loaded,
    ...(loaded ? { loadedAt: "2026-10-21T01:10:00Z", loadedBy: "staff" } : {}),
    ...patch,
  };
}

export function loadShipment(
  code: string,
  parcels: LoadParcel[],
  patch: Partial<LoadShipment> = {},
): LoadShipment {
  return {
    shipmentId: `shp-${code}`,
    code,
    orderId: `ord-${code}`,
    orderNumber: code.replace(/-S\d+$/, ""),
    status: "READY_TO_DISPATCH",
    packageCount: parcels.length,
    loadedCount: parcels.filter((p) => p.loaded).length,
    labelCodAmount: 270_000,
    packages: parcels,
    ...patch,
  };
}

/** Chuyến LOADING có hai lô: S1 đủ 1/1 kiện, S2 mới 0/2. */
export function apiLoad(patch: Partial<Load> = {}): Load {
  const shipments = patch.shipments ?? [
    loadShipment("SO-1-S1", [parcel("PKG-SO-1-1", true)]),
    loadShipment("SO-2-S1", [parcel("PKG-SO-2-1", false), parcel("PKG-SO-2-2", false)]),
  ];
  const expected = shipments.reduce((n, s) => n + s.packageCount, 0);
  const loaded = shipments.reduce((n, s) => n + s.loadedCount, 0);
  return {
    loadId: LOAD_ID,
    code: LOAD_ID,
    warehouseId: WAREHOUSE_ID,
    mode: "PARCEL",
    status: "LOADING",
    carrierId: CARRIER_ID,
    carrierCode: "GHN",
    carrierName: "Giao Hàng Nhanh",
    vehiclePlate: "51C-628.14",
    driverName: "Lê Văn Xế",
    loadingStartedAt: "2026-10-21T01:00:00Z",
    shipmentCount: shipments.length,
    expectedPackageCount: expected,
    loadedPackageCount: loaded,
    codTotal: 540_000,
    currency: "VND",
    version: 4,
    ...patch,
    shipments,
  };
}

export function shipmentRow(patch: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    shipmentId: "shp-1",
    code: "SO-1-S1",
    orderId: "ord-1",
    orderNumber: "SO-1",
    warehouseId: WAREHOUSE_ID,
    status: "READY_TO_DISPATCH",
    deliveryMode: "PARCEL",
    packageCount: 2,
    codAmount: 270_000,
    partial: false,
    readyAt: "2026-10-20T02:00:00Z",
    wholeOrderHandover: false,
    version: 1,
    ...patch,
  };
}

export function apiShipment(patch: Partial<ShipmentRow> = {}): Shipment {
  return {
    shipment: shipmentRow(patch),
    packages: [
      { packageId: "pkg-1", labelCode: "PKG-SO-1-1", status: "SEALED", weightKg: 1.5 },
      { packageId: "pkg-2", labelCode: "PKG-SO-1-2", status: "SEALED", weightKg: 0.8 },
    ],
    timeline: [
      { status: "READY_TO_DISPATCH", occurredAt: "2026-10-20T02:00:00Z", recordedByName: "Packer" },
    ],
  };
}

export function apiManifest(patch: Partial<Manifest> = {}): Manifest {
  return {
    loadCode: LOAD_ID,
    status: "LOADING",
    warehouseName: "Kho TP.HCM",
    carrierCode: "GHN",
    carrierName: "Giao Hàng Nhanh",
    vehiclePlate: "51C-628.14",
    driverName: "Lê Văn Xế",
    shipments: [
      {
        shipmentCode: "SO-1-S1",
        orderNumber: "SO-1",
        recipientName: "Vũ Đức Long",
        recipientPhone: "0966777888",
        deliveryAddress: "15 Quang Trung, Hà Đông, Hà Nội",
        packageCount: 1,
        weightKg: 1.5,
        codAmount: 270_000,
        codChangedSinceLabel: false,
        packages: [{ labelCode: "PKG-SO-1-1", weightKg: 1.5, loaded: true }],
      },
    ],
    shipmentCount: 1,
    packageCount: 1,
    totalWeightKg: 1.5,
    codTotal: 270_000,
    currency: "VND",
    printedAt: "2026-10-21T02:00:00Z",
    ...patch,
  };
}
