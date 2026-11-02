/**
 * Fixture chuyến nguyên xe (FTL) theo contract BE PR #162: một xe của kế hoạch xếp xe, đặt xe, kiện thuộc bộ,
 * kiện cần dỡ, biên bản theo xe. Trường null của BE bị BỎ khỏi JSON nên fixture cũng bỏ.
 */

import { apiLoad, apiManifest, loadShipment, parcel } from "./load";

import type { Load, LoadParcel, LoadRow, Manifest, PendingUnload } from "../types";

export const FTL_ID = "LD-F001";
export const OTHER_VEHICLE = { seq: "2", loadCode: "LD-F002" };

export const kit = (partNo: number, partCount = 2) => ({
  groupId: "kit-SO-1",
  partNo,
  partCount,
});

export function ftlParcel(
  code: string,
  loaded: boolean,
  patch: Partial<LoadParcel> = {},
): LoadParcel {
  return parcel(code, loaded, patch);
}

export function pendingUnload(
  code = "PKG-SO-9-1",
  patch: Partial<PendingUnload> = {},
): PendingUnload {
  return {
    packageId: `pkg-${code}`,
    labelCode: code,
    shipmentId: "shp-SO-9-S1",
    shipmentCode: "SO-9-S1",
    reason: "Đơn SO-9 đã huỷ khi xe đang xếp hàng",
    requestedAt: "2026-10-21T03:25:00Z",
    ...patch,
  };
}

/** Xe số 1 của kế hoạch LP-2026-0001, đã đặt xe với GHN; lô SO-1-S1 có kiện 1/2 của bộ đã lên xe, kiện 2/2 chưa. */
export function ftlLoad(patch: Partial<Load> = {}): Load {
  return apiLoad({
    loadId: FTL_ID,
    code: FTL_ID,
    mode: "FULL_TRUCKLOAD",
    status: "VEHICLE_BOOKED",
    codTotal: 0,
    loadingStartedAt: undefined,
    shipments: [
      loadShipment("SO-1-S1", [
        ftlParcel("PKG-SO-1-1", false, { kit: kit(1) }),
        ftlParcel("PKG-SO-1-2", false, { kit: kit(2) }),
      ]),
    ],
    loadPlanId: "lp-1",
    loadPlanCode: "LP-2026-0001",
    vehicleSeq: 1,
    vehicleTypeCode: "TRUCK-1T25",
    bookedAt: "2026-10-21T01:00:00Z",
    bookedBy: "staff",
    pendingUnloads: [],
    carrierBookingToCancel: false,
    ...patch,
  });
}

/** Xe chưa đặt: không hãng / biển số / tài xế. */
export function plannedLoad(patch: Partial<Load> = {}): Load {
  return ftlLoad({
    status: "PLANNED",
    carrierId: undefined,
    carrierCode: undefined,
    carrierName: undefined,
    vehiclePlate: undefined,
    driverName: undefined,
    bookedAt: undefined,
    bookedBy: undefined,
    ...patch,
  });
}

export function loadingFtl(patch: Partial<Load> = {}): Load {
  return ftlLoad({ status: "LOADING", loadingStartedAt: "2026-10-21T03:00:00Z", ...patch });
}

export function ftlRow(patch: Partial<LoadRow> = {}): LoadRow {
  return {
    loadId: FTL_ID,
    code: FTL_ID,
    warehouseId: "wh-hcm",
    mode: "FULL_TRUCKLOAD",
    status: "VEHICLE_BOOKED",
    carrierId: "car-ghn",
    carrierName: "Giao Hàng Nhanh",
    shipmentCount: 1,
    packageCount: 0,
    codTotal: 0,
    version: 2,
    loadPlanId: "lp-1",
    loadPlanCode: "LP-2026-0001",
    vehicleSeq: 1,
    ...patch,
  };
}

export function ftlManifest(patch: Partial<Manifest> = {}): Manifest {
  const base = apiManifest();
  return {
    ...base,
    loadCode: FTL_ID,
    mode: "FULL_TRUCKLOAD",
    loadPlanCode: "LP-2026-0001",
    vehicleSeq: 1,
    vehicleTypeCode: "TRUCK-1T25",
    codTotal: 0,
    ...patch,
  };
}

/* ── Xe của kế hoạch nguồn TRANSFER (BE PR #164): dòng của xe là MỘT lệnh chuyển kho ───────────────────────────── */

export const TRANSFER_ORDER_ID = "to-ftl-1";
export const TRANSFER_NUMBER = "TO-20261022-0001";

/**
 * Dòng biên bản của lệnh chuyển kho: `shipmentId` / `orderId` / `orderNumber` / `taskId` vắng, `code` là số lệnh, chỉ có
 * `transferOrderId`; không thu hộ.
 */
export function transferShipment(
  parcels: LoadParcel[],
  patch: Partial<Load["shipments"][number]> = {},
): Load["shipments"][number] {
  return {
    code: TRANSFER_NUMBER,
    transferOrderId: TRANSFER_ORDER_ID,
    status: "UNKNOWN",
    packageCount: parcels.length,
    loadedCount: parcels.filter((p) => p.loaded).length,
    labelCodAmount: 0,
    packages: parcels,
    ...patch,
  };
}

/** Xe số 1 của một kế hoạch TRANSFER đã đặt xe, chở một lệnh chuyển kho (hai kiện, chưa quét). */
export function transferLoad(patch: Partial<Load> = {}): Load {
  return ftlLoad({
    shipments: [transferShipment([ftlParcel("PKG-TO-1-1", false), ftlParcel("PKG-TO-1-2", false)])],
    loadPlanCode: "LP-2026-0005",
    ...patch,
  });
}

export function transferManifest(patch: Partial<Manifest> = {}): Manifest {
  return ftlManifest({
    shipments: [
      {
        shipmentCode: TRANSFER_NUMBER,
        transferOrderId: TRANSFER_ORDER_ID,
        recipientName: "Kho Đà Nẵng",
        deliveryAddress: "12 Nguyễn Văn Linh, Đà Nẵng",
        packageCount: 2,
        weightKg: 37,
        codAmount: 0,
        codChangedSinceLabel: false,
        packages: [
          { labelCode: "PKG-TO-1-1", weightKg: 18.5, loaded: true, labelOutdated: false },
          { labelCode: "PKG-TO-1-2", weightKg: 18.5, loaded: false, labelOutdated: false },
        ],
      },
    ],
    shipmentCount: 1,
    packageCount: 2,
    totalWeightKg: 37,
    codTotal: 0,
    ...patch,
  });
}
