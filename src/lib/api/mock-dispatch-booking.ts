/**
 * Mock chuyến xe — ghi nhận đặt xe, huỷ đặt xe, bắt đầu xếp (BE `DispatchService` / `DispatchLoad` /
 * `CarrierBookingService`): hãng thường nhập tay biển số / tài xế / mã vận đơn nếu đã có; hãng đặt xe qua API tạo đơn ở hãng
 * (BR-29). Bắt đầu xếp trả cảnh báo đơn chưa được phép đi. Dỡ kiện / huỷ có kiểm soát: `mock-dispatch-ftl-rules.ts`.
 */

import { MOCK_DISPATCHER, type DispatchState, type MockLoad } from "./mock-dispatch-store";
import { handoverBlocksOf, loadDetailView } from "./mock-dispatch-view";
import { fail, ok, validationFailed } from "./mock-route-utils";

import type { MockResponseShape } from "./mock-route-utils";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const stamp = () => new Date().toISOString();
const detail = (state: DispatchState, load: MockLoad) => ok(loadDetailView(state, load));
const invalid = (load: MockLoad, action: string) =>
  fail(409, "INVALID_LOAD_TRANSITION", `Load ${load.code} is ${load.status}; it cannot ${action}`);

const WAYBILL = /^[!-~]{1,64}$/;

/** Mã vận đơn trùng trong cùng hãng, bỏ qua chuyến đã huỷ (BR-23, BE `uk_dispatch_load_waybill`). */
export function waybillHeldBy(
  state: DispatchState,
  load: MockLoad,
  carrierId: string,
  waybillNo: string,
): MockLoad | undefined {
  return [...state.loads.values()].find(
    (other) =>
      other.loadId !== load.loadId &&
      other.status !== "CANCELLED" &&
      other.carrierId === carrierId &&
      other.waybillNo === waybillNo,
  );
}

let apiOrderSeq = 0;

/**
 * Đặt xe qua API hãng (BR-29): giờ hẹn + thứ tự điểm giao đúng các lô trên biên bản (E26); không nhận biển số / tài xế / mã
 * vận đơn (400). Hệ thống "tạo đơn ở hãng": chuyến VEHICLE_BOOKED, mã vận đơn = mã đơn hãng trả về, `carrierBooking` BOOKED.
 */
function bookThroughApi(
  state: DispatchState,
  load: MockLoad,
  carrierId: string,
  body: Record<string, unknown>,
): MockResponseShape {
  if (
    text(body.vehiclePlate) ||
    text(body.driverName) ||
    text(body.driverPhone) ||
    text(body.waybillNo)
  ) {
    return validationFailed(
      "carrierId",
      "This carrier gives the waybill number, the vehicle and the driver itself once a driver takes the order",
    );
  }
  if (load.carrierBooking && load.carrierBooking.status !== "CANCELLED") {
    return fail(
      409,
      "CARRIER_BOOKING_IN_PROGRESS",
      `Load ${load.code} is being booked or is booked through a carrier's API: cancel that booking first`,
    );
  }
  const manifest = load.shipmentIds;
  const stops = Array.isArray(body.stopShipmentIds)
    ? body.stopShipmentIds.filter((v): v is string => typeof v === "string")
    : manifest;
  if (stops.length !== manifest.length || !manifest.every((id) => stops.includes(id))) {
    return validationFailed("stopShipmentIds", "exactly the shipments on the manifest");
  }
  const orderId = `AHM-${String(++apiOrderSeq).padStart(6, "0")}`;
  load.carrierId = carrierId;
  load.vehiclePlate = null;
  load.driverName = null;
  load.driverPhone = null;
  load.waybillNo = orderId;
  load.waybillHistory.push({
    oldWaybillNo: null,
    newWaybillNo: orderId,
    source: "API",
    changedByName: MOCK_DISPATCHER,
    changedAt: stamp(),
    reason: null,
  });
  load.carrierBooking = {
    status: "BOOKED",
    carrierOrderId: orderId,
    trackingLink: null,
    bookedAt: stamp(),
  };
  load.status = "VEHICLE_BOOKED";
  load.ftl.bookedAt = stamp();
  load.ftl.bookedBy = MOCK_DISPATCHER;
  load.version += 1;
  return detail(state, load);
}

export function book(
  state: DispatchState,
  load: MockLoad,
  body: Record<string, unknown>,
): MockResponseShape {
  const carrierId = text(body.carrierId);
  if (!carrierId) return validationFailed("carrierId", "must not be null");
  if (load.status !== "PLANNED" && load.status !== "VEHICLE_BOOKED")
    return invalid(load, "be booked");
  const carrier = state.carriers.find((c) => c.carrierId === carrierId);
  if (!carrier) return fail(404, "CARRIER_NOT_FOUND", "Carrier not found");
  if (carrier.status !== "ACTIVE")
    return fail(409, "CARRIER_INACTIVE", `Carrier ${carrier.code} is not in use`);
  if (carrier.connectionType === "API_BOOKING") return bookThroughApi(state, load, carrierId, body);
  if (load.carrierBooking && load.carrierBooking.status !== "CANCELLED") {
    return fail(
      409,
      "CARRIER_BOOKING_IN_PROGRESS",
      `Load ${load.code} is booked through a carrier's API: cancel that booking first`,
    );
  }
  const given = text(body.waybillNo);
  if (given && !WAYBILL.test(given))
    return validationFailed("waybillNo", "1-64 printable characters, no spaces");
  // Bỏ trống: giữ mã đang có khi vẫn cùng hãng, bỏ khi đổi hãng (mã là của một hãng — DispatchLoad.book)
  const waybillNo = given || (carrierId === load.carrierId ? load.waybillNo : null);
  if (waybillNo && waybillHeldBy(state, load, carrierId, waybillNo)) {
    return fail(
      409,
      "WAYBILL_DUPLICATE",
      `Another load of ${carrier.code} has waybill ${waybillNo}`,
    );
  }
  if (waybillNo !== load.waybillNo) {
    load.waybillHistory.push({
      oldWaybillNo: load.waybillNo,
      newWaybillNo: waybillNo,
      source: "MANUAL",
      changedByName: MOCK_DISPATCHER,
      changedAt: stamp(),
      reason: waybillNo ? null : `Booked with carrier ${carrier.code}`,
    });
  }
  load.carrierId = carrierId;
  load.vehiclePlate = text(body.vehiclePlate) || null;
  load.driverName = text(body.driverName) || null;
  load.driverPhone = text(body.driverPhone) || null;
  load.waybillNo = waybillNo;
  load.status = "VEHICLE_BOOKED";
  load.ftl.bookedAt = stamp();
  load.ftl.bookedBy = MOCK_DISPATCHER;
  load.version += 1;
  return detail(state, load);
}

export function cancelBooking(
  state: DispatchState,
  load: MockLoad,
  reason: string,
): MockResponseShape {
  if (load.status === "PLANNED") return detail(state, load);
  if (load.status !== "VEHICLE_BOOKED") return invalid(load, "cancel its booking");
  if (!reason) return validationFailed("reason", "must not be blank");
  // Đơn ở hãng API huỷ trước; hãng chỉ cho huỷ khi tài xế chưa lấy hàng (BR-29) — mock luôn cho
  if (load.carrierBooking && load.carrierBooking.status === "BOOKED") {
    load.carrierBooking = { ...load.carrierBooking, status: "CANCELLED" };
  }
  // Thông tin đặt xe (hãng, mã vận đơn, biển số, tài xế) bị xoá khỏi chuyến, vẫn lưu trong lịch sử (09 §4.2 bước 6)
  if (load.waybillNo) {
    load.waybillHistory.push({
      oldWaybillNo: load.waybillNo,
      newWaybillNo: null,
      source: "MANUAL",
      changedByName: MOCK_DISPATCHER,
      changedAt: stamp(),
      reason,
    });
  }
  load.carrierId = null;
  load.vehiclePlate = null;
  load.driverName = null;
  load.driverPhone = null;
  load.waybillNo = null;
  load.status = "PLANNED";
  load.ftl.bookedAt = null;
  load.ftl.bookedBy = null;
  load.ftl.bookingCancelledAt = stamp();
  load.ftl.bookingCancelReason = reason;
  load.version += 1;
  return detail(state, load);
}

/** Bắt đầu xếp: câu trả lời mang cảnh báo đơn chưa được phép đi (`handoverWarnings`) — chỉ ở lần này, không ở GET (BE). */
export function startLoading(state: DispatchState, load: MockLoad): MockResponseShape {
  if (load.status !== "VEHICLE_BOOKED") {
    return fail(
      409,
      "INVALID_LOAD_TRANSITION",
      `Load ${load.code} has no vehicle booked yet: book it first`,
    );
  }
  load.status = "LOADING";
  load.loadingStartedAt = stamp();
  load.version += 1;
  return ok(loadDetailView(state, load, handoverBlocksOf(state, load)));
}
