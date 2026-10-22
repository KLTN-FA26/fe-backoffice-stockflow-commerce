/**
 * Seed mock chuyến nguyên xe (FTL, BE PR #162, SCRUM-392): một kế hoạch xếp xe với bốn xe phủ đủ tình huống —
 * xe đang xếp có kiện thuộc bộ + kiện của đơn đã huỷ cần dỡ, xe đã đặt chưa xếp (có kiện nhãn cũ), xe chưa đặt
 * (đặt xe lần trước đã huỷ), xe đã bị huỷ sau khi đặt (nhắc huỷ xe ở ngoài hệ thống). Đơn lấy từ mock-data; kiện
 * là dữ liệu mẫu của mock như `extra` ở store chuyến gửi kiện. Chỉ type được import từ store (store gọi seed).
 */

import type {
  DispatchState,
  MockLoad,
  MockParcel,
  MockShipment,
  MockShipmentStatus,
} from "./mock-dispatch-store";

/** Phần đơn hàng mà seed dùng — khớp field của `orders` trong mock-data. */
export interface FtlSeedOrder {
  orderId: string;
  orderNumber: string;
  recipientName?: string;
  recipientPhone?: string;
  shippingAddress?: { street: string; ward: string; district: string; province: string };
}

const SEED_AT = "2026-10-21T02:00:00Z";
const PLAN = { id: "LP-2026-0001", code: "LP-2026-0001" } as const;
const TRUCK = "TRUCK-1T25";
// Trùng MOCK_DISPATCHER của store (không import giá trị để tránh vòng phụ thuộc)
const DISPATCHER = "Nhân viên kho (mock)";

const parcel = (orderNumber: string, n: number, patch: Partial<MockParcel> = {}): MockParcel => ({
  packageId: `ftl-pkg-${orderNumber}-${n}`,
  labelCode: `PKG-${orderNumber}-${n}`,
  weightKg: 24 + n,
  lengthCm: 120,
  widthCm: 60,
  heightCm: 45,
  ...patch,
});

function shipmentOf(
  order: FtlSeedOrder,
  warehouseId: string,
  parcels: MockParcel[],
  status: MockShipmentStatus = "READY_TO_DISPATCH",
): MockShipment {
  const address = order.shippingAddress;
  return {
    shipmentId: `shp-ftl-${order.orderId}`,
    code: `${order.orderNumber}-S1`,
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    taskId: "",
    warehouseId,
    status,
    parcels,
    // Chuyến nguyên xe không thu hộ (BE: COD 0)
    labelCodAmount: 0,
    codAmount: 0,
    carrierId: null,
    loadId: null,
    readyAt: SEED_AT,
    handedOverAt: null,
    outcomeAt: null,
    failureReason: null,
    failureNote: null,
    block: null,
    recipient: {
      name: order.recipientName ?? "Người nhận",
      phone: order.recipientPhone ?? "",
      address: address
        ? `${address.street}, ${address.ward}, ${address.district}, ${address.province}`
        : "",
    },
    timeline: [
      { status: "READY_TO_DISPATCH", occurredAt: SEED_AT, recordedByName: DISPATCHER, note: null },
    ],
    version: 0,
  };
}

function vehicle(
  state: DispatchState,
  seq: number,
  warehouseId: string,
  status: MockLoad["status"],
  patch: Partial<MockLoad> & { placed: MockParcel[]; members: MockShipment[] },
): MockLoad {
  const { placed, members, ...rest } = patch;
  const code = `LD-2026-F${String(seq).padStart(3, "0")}`;
  const load: MockLoad = {
    loadId: code,
    code,
    warehouseId,
    status,
    carrierId: null,
    vehiclePlate: null,
    driverName: null,
    driverPhone: null,
    shipmentIds: members.map((s) => s.shipmentId),
    loaded: new Map(),
    loadingStartedAt: null,
    dispatchedAt: null,
    carrierRepresentative: null,
    signatureRef: null,
    handoverNote: null,
    cancelledAt: null,
    cancelReason: null,
    fixedCodTotal: null,
    version: 2,
    ftl: {
      loadPlanId: PLAN.id,
      loadPlanCode: PLAN.code,
      vehicleSeq: seq,
      vehicleTypeCode: TRUCK,
      placed: new Set(placed.map((p) => p.packageId)),
      bookedAt: null,
      bookedBy: null,
      bookingCancelledAt: null,
      bookingCancelReason: null,
      pendingUnloads: [],
      carrierBookingToCancel: false,
    },
    ...rest,
  };
  state.loads.set(load.loadId, load);
  return load;
}

const scan = (load: MockLoad, p: MockParcel, at = "2026-10-21T03:20:00Z") =>
  load.loaded.set(p.packageId, {
    packageId: p.packageId,
    scanId: `seed-scan-${p.packageId}`,
    loadedAt: at,
    loadedBy: DISPATCHER,
  });

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

  // Lô của kế hoạch giữ trên xe đầu tiên của nó (BE: lô FTL không đưa lên chuyến khác)
  shipA.loadId = v1.loadId;
  shipB.loadId = v1.loadId;
  shipD.loadId = v3.loadId;
}
