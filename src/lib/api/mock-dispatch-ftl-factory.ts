/**
 * Mock chuyến nguyên xe — hàm dựng dữ liệu seed (kiện, lô giao, xe của kế hoạch). Tách khỏi
 * `mock-dispatch-ftl-store.ts` để mỗi file dưới giới hạn 200 dòng. Chỉ type được import từ store.
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

export const SEED_AT = "2026-10-21T02:00:00Z";
export const PLAN = { id: "LP-2026-0001", code: "LP-2026-0001" } as const;
export const TRUCK = "TRUCK-1T25";
// Trùng MOCK_DISPATCHER của store (không import giá trị để tránh vòng phụ thuộc)
export const DISPATCHER = "Nhân viên kho (mock)";

export const parcel = (
  orderNumber: string,
  n: number,
  patch: Partial<MockParcel> = {},
): MockParcel => ({
  packageId: `ftl-pkg-${orderNumber}-${n}`,
  labelCode: `PKG-${orderNumber}-${n}`,
  weightKg: 24 + n,
  lengthCm: 120,
  widthCm: 60,
  heightCm: 45,
  ...patch,
});

export function shipmentOf(
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

export function vehicle(
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

export const scan = (load: MockLoad, p: MockParcel, at = "2026-10-21T03:20:00Z") =>
  load.loaded.set(p.packageId, {
    packageId: p.packageId,
    scanId: `seed-scan-${p.packageId}`,
    loadedAt: at,
    loadedBy: DISPATCHER,
  });
