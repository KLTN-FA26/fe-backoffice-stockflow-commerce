/**
 * Fixture chuyến theo contract BE hiện tại: một xe của kế hoạch xếp xe ở từng bước (chưa đặt → đã đặt → đang xếp → đã bàn
 * giao), kiện cần dỡ, biên bản theo xe, cảnh báo / chặn bàn giao. Trường null của BE bị BỎ khỏi JSON nên fixture cũng bỏ.
 */

import { apiLoad, apiManifest, loadShipment, parcel } from "./load";

import type { HandoverWarning, Load, LoadParcel, LoadRow, Manifest, PendingUnload } from "../types";

export const FTL_ID = "LD-F001";
export const OTHER_VEHICLE = { seq: "2", loadCode: "LD-F002" };

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

/** Xe số 1 của kế hoạch LP-2026-0001, đã đặt xe với GHN (không webhook), chưa có mã vận đơn; lô SO-1-S1 có hai kiện chưa quét. */
export function ftlLoad(patch: Partial<Load> = {}): Load {
  return apiLoad({
    loadId: FTL_ID,
    code: FTL_ID,
    status: "VEHICLE_BOOKED",
    waybillNo: undefined,
    loadingStartedAt: undefined,
    shipments: [
      loadShipment("SO-1-S1", [ftlParcel("PKG-SO-1-1", false), ftlParcel("PKG-SO-1-2", false)]),
    ],
    bookedAt: "2026-10-21T01:00:00Z",
    ...patch,
  });
}

/** Xe chưa đặt: không hãng / biển số / tài xế / mã vận đơn. */
export function plannedLoad(patch: Partial<Load> = {}): Load {
  return ftlLoad({
    status: "PLANNED",
    carrierId: undefined,
    carrierCode: undefined,
    carrierName: undefined,
    carrierConnectionType: undefined,
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

/** Xe đã bàn giao: người ký bên hãng, mã biên bản, thời điểm rời kho. */
export function dispatchedLoad(patch: Partial<Load> = {}): Load {
  return loadingFtl({
    status: "DISPATCHED",
    waybillNo: "GHN-250001",
    dispatchedAt: "2026-10-21T04:00:00Z",
    dispatchedByName: "Nhân viên kho",
    carrierRepresentative: "Lê Văn Xế",
    signatureRef: "BB-2026-0001",
    ...patch,
  });
}

export function ftlRow(patch: Partial<LoadRow> = {}): LoadRow {
  return {
    loadId: FTL_ID,
    code: FTL_ID,
    warehouseId: "wh-hcm",
    status: "VEHICLE_BOOKED",
    carrierId: "car-ghn",
    carrierName: "Giao Hàng Nhanh",
    shipmentCount: 1,
    packageCount: 0,
    version: 2,
    loadPlanId: "lp-1",
    loadPlanCode: "LP-2026-0001",
    vehicleSeq: 1,
    ...patch,
  };
}

export function ftlManifest(patch: Partial<Manifest> = {}): Manifest {
  return { ...apiManifest(), loadCode: FTL_ID, ...patch };
}

/** Đơn chưa được phép đi (BE `HandoverWarning` / một phần tử của `details.orders`). */
export function blockedOrder(patch: Partial<HandoverWarning> = {}): HandoverWarning {
  return {
    orderId: "ord-SO-2",
    orderNumber: "SO-2",
    reasonCode: "ORDER_BALANCE_NOT_PAID",
    amountDue: 15_000_000,
    currency: "VND",
    deliveryBatchSeq: 1,
    ...patch,
  };
}
