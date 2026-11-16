/**
 * Seed mock chuyến xe (một xe của kế hoạch xếp xe): hai kế hoạch phủ đủ tình huống của slice "đặt xe → mã vận đơn →
 * xếp xe → ký bàn giao" —
 * - xe 1 đang xếp có kiện của đơn đã huỷ cần dỡ và một đơn còn đợt thanh toán trước khi giao chưa thu (BE từ chối cả xe);
 * - xe 2 đã đặt, chưa có mã vận đơn (bước nhập mã vận đơn / nhập file);
 * - xe 3 chưa đặt (đặt xe lần trước đã huỷ) chở một đơn không bị chặn — luồng "vui" đặt xe → xếp → ký;
 * - xe 4 đã huỷ sau khi đặt (nhắc huỷ xe ở ngoài hệ thống);
 * - xe của kế hoạch thứ hai: chưa đặt, đơn chưa tới cửa sổ giao; xe đã bàn giao với lô HANDED_OVER và DELIVERY_FAILED.
 * Đơn lấy từ mock-data. Chỉ type được import từ store (store gọi seed).
 */

import {
  DISPATCHER,
  PLAN,
  TRUCK,
  parcel,
  scan,
  shipmentOf,
  vehicle,
  withWaybill,
  type FtlSeedOrder,
} from "./mock-dispatch-ftl-factory";

import type { DispatchState, MockHandoverBlock, MockShipment } from "./mock-dispatch-store";

export type { FtlSeedOrder };

const OTHER_PLAN = { id: "LP-2026-0002", code: "LP-2026-0002" } as const;

const UNPAID: MockHandoverBlock = {
  reasonCode: "ORDER_BALANCE_NOT_PAID",
  amountDue: 15_000_000,
  deliveryBatchSeq: 1,
};
const WINDOW_NOT_OPEN: MockHandoverBlock = {
  reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
  amountDue: 0,
  deliveryBatchSeq: 2,
  windowStart: "2026-12-01",
};

/** Thêm các kế hoạch + xe mẫu vào store; bỏ qua khi mock-data không đủ đơn / hãng. */
export function seedFtlScenario(
  state: DispatchState,
  orders: readonly FtlSeedOrder[],
  existing: readonly MockShipment[],
): void {
  const warehouseId = existing[0]?.warehouseId ?? "";
  const used = new Set([...state.shipments.values()].map((s) => s.orderId));
  const [a, b, c, d, e] = orders.filter((o) => !used.has(o.orderId));
  const [ghn, vtp] = state.carriers;
  if (!a || !b || !c || !d || !ghn || !vtp || !warehouseId) return;

  const a1 = parcel(a.orderNumber, 1);
  const a2 = parcel(a.orderNumber, 2);
  const a3 = parcel(a.orderNumber, 3);
  const b1 = parcel(b.orderNumber, 1);
  const b2 = parcel(b.orderNumber, 2);
  const c1 = parcel(c.orderNumber, 1);
  const d1 = parcel(d.orderNumber, 1);
  const shipA = shipmentOf(a, warehouseId, [a1, a2, a3]);
  const shipB = shipmentOf(b, warehouseId, [b1, b2]);
  // Đơn đã huỷ khi xe 1 đang xếp: lô rời biên bản, kiện đã quét lên xe thành "cần dỡ"
  const shipC = shipmentOf(c, warehouseId, [c1], "CANCELLED");
  const shipD = shipmentOf(d, warehouseId, [d1]);
  // Đơn B còn đợt thanh toán trước khi giao chưa thu: BE từ chối ký cả xe chở nó (09 BR-18)
  shipB.block = UNPAID;
  for (const s of [shipA, shipB, shipC, shipD]) state.shipments.set(s.shipmentId, s);

  const booked = (carrierId: string, plate: string, driver: string, phone: string) => ({
    carrierId,
    vehiclePlate: plate,
    driverName: driver,
    driverPhone: phone,
  });
  const v1 = vehicle(state, 1, warehouseId, "LOADING", {
    ...booked(ghn.carrierId, "29C-123.45", "Lê Văn Tải", "0903 111 222"),
    loadingStartedAt: "2026-10-21T03:00:00Z",
    placed: [a1, a2, b1],
    members: [shipA, shipB],
  });
  Object.assign(v1.ftl, { bookedAt: "2026-10-21T01:00:00Z", bookedBy: DISPATCHER });
  withWaybill(v1, "GHN-250001");
  scan(v1, a1);
  scan(v1, c1);
  v1.ftl.pendingUnloads.push({
    packageId: c1.packageId,
    labelCode: c1.labelCode,
    shipmentId: shipC.shipmentId,
    shipmentCode: shipC.code,
    reason: `Đơn ${c.orderNumber} đã huỷ khi xe đang xếp hàng`,
    requestedAt: "2026-10-21T03:25:00Z",
  });

  // Xe 2 đã đặt nhưng chưa có mã vận đơn: chưa ký được (BR-23) cho tới khi nhập mã
  const v2 = vehicle(state, 2, warehouseId, "VEHICLE_BOOKED", {
    ...booked(vtp.carrierId, "51D-678.90", "Trần Văn Xe", "0912 333 444"),
    placed: [a3, b2],
    members: [shipA, shipB],
  });
  Object.assign(v2.ftl, { bookedAt: "2026-10-21T01:30:00Z", bookedBy: DISPATCHER });

  // Xe 3 chưa đặt, chở một đơn không bị chặn: đặt xe → nhập mã vận đơn → bắt đầu xếp → quét → ký
  const v3 = vehicle(state, 3, warehouseId, "PLANNED", { placed: [d1], members: [shipD] });
  Object.assign(v3.ftl, {
    bookingCancelledAt: "2026-10-21T02:30:00Z",
    bookingCancelReason: "Hãng báo hết xe trong ngày",
  });

  vehicle(state, 4, warehouseId, "CANCELLED", {
    ...booked(ghn.carrierId, "29H-555.66", "Phạm Văn Lái", "0988 777 666"),
    placed: [],
    members: [],
    cancelledAt: "2026-10-21T04:00:00Z",
    cancelReason: `auto-cancelled: nothing to carry - order ${c.orderNumber} cancelled`,
    ftl: {
      loadPlanId: PLAN.id,
      loadPlanCode: PLAN.code,
      vehicleSeq: 4,
      vehicleTypeCode: TRUCK,
      placed: new Set(),
      bookedAt: "2026-10-21T01:45:00Z",
      bookedBy: DISPATCHER,
      bookingCancelledAt: null,
      bookingCancelReason: null,
      pendingUnloads: [],
      carrierBookingToCancel: true,
    },
  });

  // Lô của kế hoạch giữ trên xe đầu tiên của nó (một lô nằm trên một chuyến còn sống)
  shipA.loadId = v1.loadId;
  shipB.loadId = v1.loadId;
  shipD.loadId = v3.loadId;

  seedSecondPlan(state, warehouseId, [ghn.carrierId, e, existing]);
}

/** Kế hoạch thứ hai: một xe chưa tới cửa sổ giao (BR-04) và một xe đã bàn giao có lô để ghi kết quả giao. */
function seedSecondPlan(
  state: DispatchState,
  warehouseId: string,
  [carrierId, e, existing]: [string, FtlSeedOrder | undefined, readonly MockShipment[]],
): void {
  if (e) {
    const e1 = parcel(e.orderNumber, 1);
    const shipE = shipmentOf(e, warehouseId, [e1]);
    shipE.block = WINDOW_NOT_OPEN;
    state.shipments.set(shipE.shipmentId, shipE);
    const v5 = vehicle(state, 5, warehouseId, "PLANNED", { placed: [e1], members: [shipE] });
    Object.assign(v5.ftl, {
      loadPlanId: OTHER_PLAN.id,
      loadPlanCode: OTHER_PLAN.code,
      vehicleSeq: 1,
    });
    shipE.loadId = v5.loadId;
  }
  const [handed, failed] = [existing[5], existing[6]];
  if (!handed) return;
  const members = [handed, failed].filter((s): s is MockShipment => !!s);
  const placed = members.flatMap((s) => s.parcels);
  const v6 = vehicle(state, 6, warehouseId, "DISPATCHED", {
    carrierId,
    vehiclePlate: "51D-904.33",
    driverName: "Trần Văn Tài",
    driverPhone: "0903 111 222",
    loadingStartedAt: "2026-10-20T01:00:00Z",
    dispatchedAt: "2026-10-20T03:00:00Z",
    carrierRepresentative: "Trần Văn Tài",
    signatureRef: "BB-2026-0001",
    placed,
    members,
  });
  Object.assign(v6.ftl, {
    loadPlanId: OTHER_PLAN.id,
    loadPlanCode: OTHER_PLAN.code,
    vehicleSeq: 2,
    bookedAt: "2026-10-20T00:30:00Z",
    bookedBy: DISPATCHER,
  });
  withWaybill(v6, "GHN-250000", "2026-10-20T00:45:00Z");
  for (const parcelOf of placed) scan(v6, parcelOf, "2026-10-20T02:30:00Z");
  for (const shipment of members) {
    shipment.status = shipment === failed ? "DELIVERY_FAILED" : "HANDED_OVER";
    shipment.handedOverAt = v6.dispatchedAt;
    shipment.carrierId = carrierId;
    shipment.loadId = v6.loadId;
    shipment.timeline.push({
      status: "HANDED_OVER",
      occurredAt: v6.dispatchedAt ?? "2026-10-20T03:00:00Z",
      recordedByName: DISPATCHER,
      note: null,
    });
  }
  if (failed) {
    failed.failureReason = "CUSTOMER_ABSENT";
    failed.outcomeAt = "2026-10-20T08:00:00Z";
    failed.timeline.push({
      status: "DELIVERY_FAILED",
      occurredAt: failed.outcomeAt,
      recordedByName: "Điều phối đơn hàng (mock)",
      note: null,
    });
  }
}
