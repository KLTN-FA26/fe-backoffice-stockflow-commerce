/**
 * Store in-memory cho mock giao hàng cho hãng (module 09), khớp BE PR #137 (SCRUM-288/292/293):
 * hãng, lô giao, chuyến xe. Chỉ dùng khi USE_MOCK=true.
 *
 * Kiện, đơn hàng, hãng lấy từ mock-data (`packingTasks[].packages`, `orders`, `carriers`); mock-data
 * chưa có lô giao nên ghép ở đây, phủ đủ trạng thái để thử cả luồng: lô chờ xuất (có / chưa hãng), một
 * lô chưa thanh toán / đang giữ / nhãn lệch COD (BE từ chối bàn giao theo lô), một chuyến đang xếp dở,
 * một chuyến đã bàn giao với lô HANDED_OVER và DELIVERY_FAILED để ghi kết quả giao.
 */

import { seedFtlScenario } from "./mock-dispatch-ftl-store";

export type MockShipmentStatus =
  "READY_TO_DISPATCH" | "HANDED_OVER" | "DELIVERED" | "DELIVERY_FAILED" | "RETURNED" | "CANCELLED";

export type MockLoadStatus = "PLANNED" | "VEHICLE_BOOKED" | "LOADING" | "DISPATCHED" | "CANCELLED";

/** BE `LoadStatus#isOpen`: lô và kiện còn thêm / bớt được, chuyến còn huỷ được. */
export const isMockLoadOpen = (status: MockLoadStatus): boolean =>
  status === "PLANNED" || status === "VEHICLE_BOOKED" || status === "LOADING";

export interface MockParcel {
  packageId: string;
  labelCode: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  /** Bộ nhiều kiện (BE `KitPartResponse`): kiện là phần `partNo/partCount` của bộ `groupId`. */
  kit?: { groupId: string; partNo: number; partCount: number };
  /** BE `package.label_outdated_at`: kiện đã chuyển lô sau khi in nhãn → quét lên xe bị 409 LABEL_OUTDATED. */
  labelOutdated?: boolean;
}

/** Kiện của đơn đã huỷ còn trên xe — phải quét dỡ xuống trước bàn giao (BE `LoadResponse.PendingUnload`). */
export interface MockPendingUnload {
  packageId: string;
  labelCode: string;
  shipmentId: string;
  shipmentCode: string;
  reason: string;
  requestedAt: string;
}

/** Phần của chuyến nguyên xe (FTL, BE PR #162): xe của một kế hoạch xếp xe, kiện kế hoạch xếp lên xe, đặt xe. */
export interface MockFtlPart {
  loadPlanId: string;
  loadPlanCode: string;
  vehicleSeq: number;
  vehicleTypeCode: string;
  /** Kiện (packageId) kế hoạch xếp lên xe này — chuyến chỉ nhận và hiện đúng các kiện đó. */
  placed: Set<string>;
  bookedAt: string | null;
  bookedBy: string | null;
  bookingCancelledAt: string | null;
  bookingCancelReason: string | null;
  pendingUnloads: MockPendingUnload[];
  carrierBookingToCancel: boolean;
}

/** Điều kiện làm BE từ chối bàn giao đúng lô này (G3-Q4 + BR-04) — để thử màn lỗi theo lô. */
export interface MockHandoverBlock {
  code: "ORDER_BALANCE_NOT_PAID" | "ORDER_INVALID_TRANSITION" | "LABEL_OUTDATED";
  message: string;
}

export interface MockStep {
  status: MockShipmentStatus;
  occurredAt: string;
  recordedByName: string;
  note: string | null;
}

export interface MockShipment {
  shipmentId: string;
  code: string;
  orderId: string;
  orderNumber: string;
  /** Task xuất kho / đóng gói của đơn (BE #137: `taskId` trên lô giao). */
  taskId: string;
  warehouseId: string;
  status: MockShipmentStatus;
  parcels: MockParcel[];
  labelCodAmount: number;
  codAmount: number;
  carrierId: string | null;
  loadId: string | null;
  readyAt: string;
  handedOverAt: string | null;
  outcomeAt: string | null;
  failureReason: string | null;
  failureNote: string | null;
  block: MockHandoverBlock | null;
  recipient: { name: string; phone: string; address: string };
  timeline: MockStep[];
  version: number;
}

export interface MockLoadedParcel {
  packageId: string;
  scanId: string;
  loadedAt: string;
  loadedBy: string;
}

export interface MockLoad {
  loadId: string;
  code: string;
  warehouseId: string;
  status: MockLoadStatus;
  /** Chuyến nguyên xe chưa đặt xe (PLANNED) thì chưa có hãng. */
  carrierId: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  shipmentIds: string[];
  loaded: Map<string, MockLoadedParcel>;
  /** Chuyến nguyên xe chưa bắt đầu xếp hàng thì chưa có. */
  loadingStartedAt: string | null;
  dispatchedAt: string | null;
  carrierRepresentative: string | null;
  signatureRef: string | null;
  handoverNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** codTotal chốt khi bàn giao; trước đó tính theo nhãn. */
  fixedCodTotal: number | null;
  version: number;
  /** Có = chuyến nguyên xe (FULL_TRUCKLOAD) của kế hoạch xếp xe; vắng = chuyến gửi kiện (PARCEL). */
  ftl?: MockFtlPart;
}

export interface MockCarrier {
  carrierId: string;
  code: string;
  name: string;
  contactName: string;
  contactPhone: string;
  status: "ACTIVE" | "INACTIVE";
  version: number;
}

export interface DispatchState {
  carriers: MockCarrier[];
  shipments: Map<string, MockShipment>;
  loads: Map<string, MockLoad>;
  /** `requestId` → chuyến đã mở (mở lại cùng id trả đúng chuyến đó). */
  openRequests: Map<string, string>;
  warehouseNames: Map<string, { name: string; address: string }>;
}

export const MOCK_DISPATCHER = "Nhân viên kho (mock)";
export const MOCK_COORDINATOR = "Điều phối đơn hàng (mock)";
const SEED_AT = "2026-10-20T02:00:00Z";

let store: Promise<DispatchState> | null = null;

/** Cache promise (không cache kết quả): hai request đầu chạy song song dùng chung một store. */
export function getDispatchState(): Promise<DispatchState> {
  store ??= buildState();
  return store;
}

export function resetDispatchMockStore(): void {
  store = null;
}

export const codTotalOf = (state: DispatchState, load: MockLoad): number =>
  load.fixedCodTotal ??
  load.shipmentIds.reduce((sum, id) => sum + (state.shipments.get(id)?.labelCodAmount ?? 0), 0);

async function buildState(): Promise<DispatchState> {
  const { packingTasks, carriers, orders, warehouses } = await import("@/lib/mock-data");
  const mockCarriers: MockCarrier[] = carriers.map((carrier, index) => ({
    carrierId: carrier.carrierId,
    code: carrier.code,
    name: carrier.name,
    contactName: `Điều phối ${carrier.code}`,
    contactPhone: `028 3900 00${10 + index}`,
    status: "ACTIVE",
    version: 0,
  }));
  const state: DispatchState = {
    carriers: mockCarriers,
    shipments: new Map(),
    loads: new Map(),
    openRequests: new Map(),
    warehouseNames: new Map(
      warehouses.map((w) => [
        w.warehouseId,
        {
          name: w.name,
          address: `${w.address.street}, ${w.address.district}, ${w.address.province}`,
        },
      ]),
    ),
  };
  // Mỗi đơn đã đóng gói xong = một lô giao; thêm kiện thứ hai ở vài lô để thấy tiến độ "1/2"
  const packed = packingTasks.filter(
    (task) => ["Packed", "Handed to Shipping"].includes(task.status) && task.packages.length > 0,
  );
  packed.forEach((task, index) => {
    const order = orders.find((o) => o.orderId === task.orderId);
    const orderNumber = order?.orderNumber ?? task.orderId;
    const parcels: MockParcel[] = task.packages.map((pkg, n) => ({
      packageId: pkg.packageId,
      labelCode: `PKG-${orderNumber}-${n + 1}`,
      weightKg: pkg.weightKg,
      lengthCm: pkg.dimensions.lengthCm,
      widthCm: pkg.dimensions.widthCm,
      heightCm: pkg.dimensions.heightCm,
    }));
    if (index % 2 === 0) {
      parcels.push({
        packageId: `${task.taskId}-extra`,
        labelCode: `PKG-${orderNumber}-${parcels.length + 1}`,
        weightKg: 0.8,
        lengthCm: 25,
        widthCm: 18,
        heightCm: 10,
      });
    }
    const due = order ? Math.max(0, order.grandTotal - order.amountPaid) : 0;
    const address = order?.shippingAddress;
    const shipment: MockShipment = {
      shipmentId: `shp-${task.taskId}`,
      code: `${orderNumber}-S1`,
      orderId: task.orderId,
      orderNumber,
      taskId: task.taskId,
      warehouseId: task.warehouseId,
      status: "READY_TO_DISPATCH",
      parcels,
      labelCodAmount: due,
      codAmount: due,
      carrierId: null,
      loadId: null,
      readyAt: SEED_AT,
      handedOverAt: null,
      outcomeAt: null,
      failureReason: null,
      failureNote: null,
      block: null,
      recipient: {
        name: order?.recipientName ?? "Người nhận",
        phone: order?.recipientPhone ?? "",
        address: address
          ? `${address.street}, ${address.ward}, ${address.district}, ${address.province}`
          : "",
      },
      timeline: [
        {
          status: "READY_TO_DISPATCH",
          occurredAt: SEED_AT,
          recordedByName: "Nhân viên đóng gói (mock)",
          note: null,
        },
      ],
      version: 0,
    };
    state.shipments.set(shipment.shipmentId, shipment);
  });
  seedScenarios(state, [...state.shipments.values()]);
  seedFtlScenario(state, orders, [...state.loads.values()][0]?.warehouseId ?? "");
  // Lô giao mà mock đơn hàng đã dựng sẵn (`<id đơn>-SHIP-1`, đơn giao một phần): cùng id để liên kết từ
  // chi tiết đơn sang chi tiết lô mở được (BE `fk_order_shipment_shipment`: lô của đơn = lô của kho)
  const dispatched = [...state.loads.values()].find((l) => l.status === "DISPATCHED");
  for (const order of orders.filter((o) => o.status === "Partially Fulfilled")) {
    if (!dispatched) break;
    const base = [...state.shipments.values()][0];
    if (!base) break;
    const parcel: MockParcel = {
      packageId: `${order.orderId}-pkg-1`,
      labelCode: `PKG-${order.orderNumber}-1`,
      weightKg: 1,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10,
    };
    const shipment: MockShipment = {
      ...base,
      shipmentId: `${order.orderId}-SHIP-1`,
      code: `${order.orderNumber}-S1`,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      warehouseId: dispatched.warehouseId,
      status: "HANDED_OVER",
      parcels: [parcel],
      labelCodAmount: 0,
      codAmount: 0,
      carrierId: dispatched.carrierId,
      loadId: dispatched.loadId,
      handedOverAt: dispatched.dispatchedAt,
      block: null,
      timeline: [...base.timeline.slice(0, 1)],
    };
    state.shipments.set(shipment.shipmentId, shipment);
    dispatched.shipmentIds.push(shipment.shipmentId);
    dispatched.loaded.set(parcel.packageId, {
      packageId: parcel.packageId,
      scanId: `seed-scan-${parcel.packageId}`,
      loadedAt: dispatched.dispatchedAt ?? SEED_AT,
      loadedBy: MOCK_DISPATCHER,
    });
  }
  return state;
}

/** Phân vai các lô thành các tình huống thử (theo thứ tự, an toàn khi ít lô). */
function seedScenarios(state: DispatchState, list: MockShipment[]): void {
  const [, unpaid, outdated, hold, loading, handed, failed, assigned] = list;
  const block = (shipment: MockShipment | undefined, value: MockHandoverBlock) => {
    if (shipment) shipment.block = value;
  };
  block(unpaid, { code: "ORDER_BALANCE_NOT_PAID", message: "Order balance not paid" });
  block(hold, { code: "ORDER_INVALID_TRANSITION", message: "Order is on hold" });
  block(outdated, { code: "LABEL_OUTDATED", message: "Label COD differs" });
  if (assigned) assigned.carrierId = state.carriers[0]?.carrierId ?? null;

  const carrierOf = (n: number) => state.carriers[n]?.carrierId ?? "";
  if (handed) {
    const dispatched = makeLoad(state, 1, handed.warehouseId, carrierOf(1), "DISPATCHED", [
      handed,
      failed,
    ]);
    for (const shipment of [handed, failed]) {
      if (!shipment) continue;
      shipment.status = shipment === failed ? "DELIVERY_FAILED" : "HANDED_OVER";
      shipment.handedOverAt = dispatched.dispatchedAt;
      shipment.carrierId = dispatched.carrierId;
      shipment.loadId = dispatched.loadId;
      shipment.timeline.push({
        status: "HANDED_OVER",
        occurredAt: dispatched.dispatchedAt ?? SEED_AT,
        recordedByName: MOCK_DISPATCHER,
        note: null,
      });
    }
    if (failed) {
      failed.failureReason = "CUSTOMER_ABSENT";
      failed.outcomeAt = "2026-10-20T08:00:00Z";
      failed.timeline.push({
        status: "DELIVERY_FAILED",
        occurredAt: failed.outcomeAt,
        recordedByName: MOCK_COORDINATOR,
        note: null,
      });
    }
  }
  if (loading) {
    // Chuyến đang xếp dở: một lô có sẵn kiện đã lên xe
    const open = makeLoad(state, 2, loading.warehouseId, carrierOf(0), "LOADING", [loading]);
    loading.carrierId = open.carrierId;
    loading.loadId = open.loadId;
    const first = loading.parcels[0];
    if (first) {
      open.loaded.set(first.packageId, {
        packageId: first.packageId,
        scanId: `seed-scan-${first.packageId}`,
        loadedAt: "2026-10-21T01:20:00Z",
        loadedBy: MOCK_DISPATCHER,
      });
    }
  }
}

function makeLoad(
  state: DispatchState,
  n: number,
  warehouseId: string,
  carrierId: string,
  status: MockLoadStatus,
  shipments: (MockShipment | undefined)[],
): MockLoad {
  const code = `LOAD-2026-${String(n).padStart(4, "0")}`;
  const dispatched = status === "DISPATCHED";
  const members = shipments.filter((s): s is MockShipment => !!s);
  const load: MockLoad = {
    loadId: code,
    code,
    warehouseId,
    status,
    carrierId,
    vehiclePlate: dispatched ? "51D-904.33" : "51C-628.14",
    driverName: dispatched ? "Trần Văn Tài" : "Lê Văn Xế",
    driverPhone: dispatched ? "0903 111 222" : null,
    shipmentIds: members.map((s) => s.shipmentId),
    loaded: new Map(),
    loadingStartedAt: "2026-10-20T01:00:00Z",
    dispatchedAt: dispatched ? "2026-10-20T03:00:00Z" : null,
    carrierRepresentative: dispatched ? "Trần Văn Tài" : null,
    signatureRef: dispatched ? "BB-2026-0001" : null,
    handoverNote: null,
    cancelledAt: null,
    cancelReason: null,
    fixedCodTotal: dispatched ? members.reduce((sum, s) => sum + s.codAmount, 0) : null,
    version: 3,
  };
  if (dispatched) {
    for (const shipment of members) {
      for (const parcel of shipment.parcels) {
        load.loaded.set(parcel.packageId, {
          packageId: parcel.packageId,
          scanId: `seed-scan-${parcel.packageId}`,
          loadedAt: "2026-10-20T02:30:00Z",
          loadedBy: MOCK_DISPATCHER,
        });
      }
    }
  }
  state.loads.set(load.loadId, load);
  return load;
}
