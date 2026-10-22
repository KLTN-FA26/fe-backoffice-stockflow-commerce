/**
 * Mock giao hàng cho hãng — phần response của chuyến nguyên xe (BE PR #162): trường thêm vào
 * `LoadRowResponse` / `LoadResponse` / `ManifestResponse`, và các kiện thuộc xe (FTL chỉ hiện kiện kế hoạch xếp
 * lên xe đó, COD 0).
 */

import type { MockLoad, MockParcel, MockShipment } from "./mock-dispatch-store";

/** Kiện của lô nằm trên chuyến này: chuyến gửi kiện = cả lô, chuyến nguyên xe = chỉ kiện kế hoạch xếp lên xe. */
export const parcelsOn = (load: MockLoad, shipment: MockShipment): MockParcel[] =>
  load.ftl
    ? shipment.parcels.filter((parcel) => load.ftl?.placed.has(parcel.packageId))
    : shipment.parcels;

export const modeOf = (load: MockLoad): "PARCEL" | "FULL_TRUCKLOAD" =>
  load.ftl ? "FULL_TRUCKLOAD" : "PARCEL";

/** Kiện: bộ (n/N) và cờ nhãn cũ (chỉ khi có — BE bỏ trường vắng). */
export const parcelExtras = (parcel: MockParcel) => ({
  kit: parcel.kit,
  labelOutdated: parcel.labelOutdated,
});

export const ftlRowFields = (load: MockLoad) => ({
  loadPlanId: load.ftl?.loadPlanId,
  loadPlanCode: load.ftl?.loadPlanCode,
  vehicleSeq: load.ftl?.vehicleSeq,
});

export function ftlDetailFields(load: MockLoad) {
  const ftl = load.ftl;
  if (!ftl) return {};
  return {
    ...ftlRowFields(load),
    vehicleTypeCode: ftl.vehicleTypeCode,
    bookedAt: ftl.bookedAt,
    bookedBy: ftl.bookedBy,
    bookingCancelledAt: ftl.bookingCancelledAt,
    bookingCancelReason: ftl.bookingCancelReason,
    pendingUnloads: ftl.pendingUnloads,
    carrierBookingToCancel: ftl.carrierBookingToCancel,
  };
}

export const ftlManifestFields = (load: MockLoad) => ({
  mode: modeOf(load),
  loadPlanCode: load.ftl?.loadPlanCode,
  vehicleSeq: load.ftl?.vehicleSeq,
  vehicleTypeCode: load.ftl?.vehicleTypeCode,
});
