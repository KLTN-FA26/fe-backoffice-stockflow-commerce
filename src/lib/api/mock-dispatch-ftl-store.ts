/**
 * Seed mock chuyến nguyên xe (FTL, BE PR #162, SCRUM-392): một kế hoạch xếp xe với bốn xe phủ đủ tình huống —
 * xe đang xếp có kiện thuộc bộ + kiện của đơn đã huỷ cần dỡ, xe đã đặt chưa xếp (có kiện nhãn cũ), xe chưa đặt
 * (đặt xe lần trước đã huỷ), xe đã bị huỷ sau khi đặt (nhắc huỷ xe ở ngoài hệ thống). Đơn lấy từ mock-data; kiện
 * là dữ liệu mẫu của mock như `extra` ở store chuyến gửi kiện. Chỉ type được import từ store (store gọi seed).
 */

import {
  DISPATCHER,
  PLAN,
  TRUCK,
  parcel,
  scan,
  shipmentOf,
  vehicle,
  type FtlSeedOrder,
} from "./mock-dispatch-ftl-factory";

import type { DispatchState } from "./mock-dispatch-store";

export type { FtlSeedOrder };

/** Thêm kế hoạch + bốn xe mẫu vào store; bỏ qua khi mock-data không đủ đơn / hãng. */
export function seedFtlScenario(
  state: DispatchState,
  orders: readonly FtlSeedOrder[],
  warehouseId: string,
): void {
  const used = new Set([...state.shipments.values()].map((s) => s.orderId));
  const [a, b, c, d] = orders.filter((o) => !used.has(o.orderId));
  const [ghn, vtp] = state.carriers;
  if (!a || !b || !c || !d || !ghn || !vtp || !warehouseId) return;

  const kit = { groupId: `kit-${a.orderNumber}`, partCount: 2 };
  const a1 = parcel(a.orderNumber, 1, { kit: { ...kit, partNo: 1 } });
  const a2 = parcel(a.orderNumber, 2, { kit: { ...kit, partNo: 2 } });
  const a3 = parcel(a.orderNumber, 3);
  const b1 = parcel(b.orderNumber, 1);
  const b2 = parcel(b.orderNumber, 2, { labelOutdated: true });
  const c1 = parcel(c.orderNumber, 1);
  const d1 = parcel(d.orderNumber, 1);
  const shipA = shipmentOf(a, warehouseId, [a1, a2, a3]);
  const shipB = shipmentOf(b, warehouseId, [b1, b2]);
  // Đơn đã huỷ khi xe 1 đang xếp: lô rời biên bản, kiện đã quét lên xe thành "cần dỡ"
  const shipC = shipmentOf(c, warehouseId, [c1], "CANCELLED");
  const shipD = shipmentOf(d, warehouseId, [d1]);
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
  Object.assign(v1.ftl ?? {}, { bookedAt: "2026-10-21T01:00:00Z", bookedBy: DISPATCHER });
  scan(v1, a1);
  scan(v1, c1);
  v1.ftl?.pendingUnloads.push({
    packageId: c1.packageId,
    labelCode: c1.labelCode,
    shipmentId: shipC.shipmentId,
    shipmentCode: shipC.code,
    reason: `Đơn ${c.orderNumber} đã huỷ khi xe đang xếp hàng`,
    requestedAt: "2026-10-21T03:25:00Z",
  });

  const v2 = vehicle(state, 2, warehouseId, "VEHICLE_BOOKED", {
    ...booked(vtp.carrierId, "51D-678.90", "Trần Văn Xe", "0912 333 444"),
    placed: [a3, b2],
    members: [shipA, shipB],
  });
  Object.assign(v2.ftl ?? {}, { bookedAt: "2026-10-21T01:30:00Z", bookedBy: DISPATCHER });

  const v3 = vehicle(state, 3, warehouseId, "PLANNED", { placed: [d1], members: [shipD] });
  Object.assign(v3.ftl ?? {}, {
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

  seedTransferVehicle(state, warehouseId);

  // Lô của kế hoạch giữ trên xe đầu tiên của nó (BE: lô FTL không đưa lên chuyến khác)
  shipA.loadId = v1.loadId;
  shipB.loadId = v1.loadId;
  shipD.loadId = v3.loadId;
}

/** Số kiện của lệnh chuyển kho seed trên xe mẫu (khớp `TO-2026-0006` của kế hoạch xếp xe). */
const TRANSFER_PARCELS = 2;

/**
 * Xe thứ năm là của kế hoạch nguồn TRANSFER (BE PR #164): một lệnh chuyển kho đã đóng gói đi nguyên chuyến — dòng biên
 * bản mang số lệnh và `transferOrderId`, người nhận là kho đích, không COD.
 */
function seedTransferVehicle(state: DispatchState, warehouseId: string): void {
  const parcels = Array.from({ length: TRANSFER_PARCELS }, (_, i) =>
    parcel("TO-2026-0006", i + 1, { lengthCm: 60, widthCm: 40, heightCm: 35, weightKg: 18.5 }),
  );
  const base = shipmentOf(
    { orderId: "TO-2026-0006", orderNumber: "TO-2026-0006", recipientName: "Kho Đà Nẵng" },
    warehouseId,
    parcels,
  );
  const transfer = {
    ...base,
    shipmentId: "to-ftl-TO-2026-0006",
    code: "TO-2026-0006",
    orderId: "",
    orderNumber: "",
    transferOrderId: "TO-2026-0006",
  };
  state.shipments.set(transfer.shipmentId, transfer);
  const v5 = vehicle(state, 5, warehouseId, "VEHICLE_BOOKED", {
    placed: parcels,
    members: [transfer],
    ftl: {
      loadPlanId: "LP-2026-0005",
      loadPlanCode: "LP-2026-0005",
      vehicleSeq: 1,
      vehicleTypeCode: TRUCK,
      placed: new Set(parcels.map((p) => p.packageId)),
      bookedAt: "2026-10-22T05:00:00Z",
      bookedBy: DISPATCHER,
      bookingCancelledAt: null,
      bookingCancelReason: null,
      pendingUnloads: [],
      carrierBookingToCancel: false,
    },
  });
  transfer.loadId = v5.loadId;
}
