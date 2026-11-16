/**
 * Mock giao hàng cho hãng — phần response của chuyến xe (một xe của kế hoạch xếp xe): trường kế hoạch, đặt xe, mã vận đơn,
 * hãng đặt qua API, và các kiện thuộc xe (chuyến chỉ hiện kiện kế hoạch xếp lên xe đó).
 */

import type { MockCarrier, MockLoad, MockParcel, MockShipment } from "./mock-dispatch-store";

/** Kiện của lô nằm trên chuyến này: chỉ kiện kế hoạch xếp lên xe. */
export const parcelsOn = (load: MockLoad, shipment: MockShipment): MockParcel[] =>
  shipment.parcels.filter((parcel) => load.ftl.placed.has(parcel.packageId));

export const ftlRowFields = (load: MockLoad) => ({
  loadPlanId: load.ftl.loadPlanId,
  loadPlanCode: load.ftl.loadPlanCode,
  vehicleSeq: load.ftl.vehicleSeq,
  waybillNo: load.waybillNo,
});

export function ftlDetailFields(load: MockLoad, carrier: MockCarrier | undefined) {
  const ftl = load.ftl;
  return {
    ...ftlRowFields(load),
    vehicleTypeCode: ftl.vehicleTypeCode,
    bookedAt: ftl.bookedAt,
    bookedBy: ftl.bookedBy,
    bookingCancelledAt: ftl.bookingCancelledAt,
    bookingCancelReason: ftl.bookingCancelReason,
    pendingUnloads: ftl.pendingUnloads,
    carrierBookingToCancel: ftl.carrierBookingToCancel,
    cancelReasonCode: ftl.cancelReasonCode ?? undefined,
    replacementLoadId: ftl.replacementLoadId ?? undefined,
    replacementLoadCode: ftl.replacementLoadId ? `${load.code}-R` : undefined,
    carrierConnectionType: carrier?.connectionType,
    carrierBooking: load.carrierBooking
      ? {
          status: load.carrierBooking.status,
          carrierOrderId: load.carrierBooking.carrierOrderId,
          trackingLink: load.carrierBooking.trackingLink,
          bookedAt: load.carrierBooking.bookedAt,
        }
      : undefined,
  };
}

export const ftlManifestFields = (load: MockLoad) => ({
  loadPlanCode: load.ftl.loadPlanCode,
  vehicleSeq: load.ftl.vehicleSeq,
  vehicleTypeCode: load.ftl.vehicleTypeCode,
  waybillNo: load.waybillNo,
});
