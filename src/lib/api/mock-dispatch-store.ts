/**
 * Store in-memory cho mock giao nguyên chuyến cho hãng (module 09) theo hợp đồng BE hiện tại: hãng, lô giao, chuyến xe
 * (mỗi chuyến là một xe của kế hoạch xếp xe — không còn chuyến gửi kiện, không COD). Chỉ dùng khi USE_MOCK=true.
 *
 * Kiện, đơn hàng, hãng lấy từ mock-data (`packingTasks[].packages`, `orders`, `carriers`); mock-data chưa có lô giao nên
 * ghép ở đây, phủ đủ trạng thái để thử cả luồng: lô chờ xuất, các lô bị BE chặn bàn giao (chưa thu đợt thanh toán trước
 * khi giao / chưa tới cửa sổ giao / đơn đang giữ), xe đang xếp dở, xe đã đặt chưa có mã vận đơn, xe đã bàn giao có lô
 * HANDED_OVER và DELIVERY_FAILED để ghi kết quả giao.
 */

import { seedFtlScenario } from "./mock-dispatch-ftl-store";

export type MockShipmentStatus =
  "READY_TO_DISPATCH" | "HANDED_OVER" | "DELIVERED" | "DELIVERY_FAILED" | "RETURNED" | "CANCELLED";

export type MockLoadStatus = "PLANNED" | "VEHICLE_BOOKED" | "LOADING" | "DISPATCHED" | "CANCELLED";

export interface MockParcel {
  packageId: string;
  labelCode: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/** Kiện của đơn đã huỷ còn trên xe — phải quét dỡ xuống trước bàn giao (BE `LoadResponse.PendingUnload`). */
export interface MockPendingUnload {
  packageId: string;
  labelCode: string;
  shipmentId: string;
  shipmentCode: string;
  reason: string;
  requestedAt: string;
  /** Có khi xe huỷ có kiểm soát (SCRUM-474): XE_HONG / SAI_XE / KIEN_KHONG_VUA / KHAC. */
  reasonCode?: string;
}

/** Phần xe của kế hoạch xếp xe: kế hoạch, kiện kế hoạch xếp lên xe, đặt xe. */
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
  /** Mã lý do của lần huỷ có kiểm soát (SCRUM-474); null với mọi cách huỷ khác. */
  cancelReasonCode?: string | null;
  /** Chuyến PLANNED thay xe đã huỷ có kiểm soát (vắng khi xe không còn gì để chở). */
  replacementLoadId?: string | null;
}

/**
 * Vì sao BE chặn bàn giao đơn của lô này (09 BR-04, BR-18): trả trong `LoadResponse.handoverWarnings` khi bắt đầu xếp và
 * trong `details.orders` của 409 LOAD_HANDOVER_BLOCKED khi ký.
 */
export interface MockHandoverBlock {
  reasonCode:
    "ORDER_BALANCE_NOT_PAID" | "DELIVERY_BATCH_WINDOW_NOT_OPEN" | "ORDER_INVALID_TRANSITION";
  /** Số tiền đợt thanh toán trước khi giao còn thiếu (0 khi lý do khác). */
  amountDue: number;
  deliveryBatchSeq?: number;
  /** `yyyy-MM-dd` — ngày đầu tiên của đợt giao được bàn giao. */
  windowStart?: string;
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
  /** Task xuất kho / đóng gói của đơn (BE: `taskId` trên lô giao). */
  taskId: string;
  warehouseId: string;
  status: MockShipmentStatus;
  parcels: MockParcel[];
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

/** Một lần đổi mã vận đơn (BE `WaybillChangeResponse`). */
export interface MockWaybillChange {
  oldWaybillNo: string | null;
  newWaybillNo: string | null;
  source: "MANUAL" | "FILE" | "WEBHOOK" | "API";
  changedByName: string | null;
  changedAt: string;
  reason: string | null;
}

/** Đơn của chuyến ở hãng đặt xe qua API (BE `LoadResponse.CarrierBooking`). */
export interface MockCarrierBooking {
  status: "REQUESTED" | "BOOKED" | "FAILED" | "CANCELLED" | "CANCEL_FAILED";
  carrierOrderId: string | null;
  trackingLink: string | null;
  bookedAt: string | null;
}

export interface MockLoad {
  loadId: string;
  code: string;
  warehouseId: string;
  status: MockLoadStatus;
  /** Xe chưa đặt (PLANNED) thì chưa có hãng. */
  carrierId: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  driverPhone: string | null;
  /** Mã vận đơn của hãng (BR-23: bắt buộc trước khi ký). */
  waybillNo: string | null;
  waybillHistory: MockWaybillChange[];
  carrierBooking: MockCarrierBooking | null;
  shipmentIds: string[];
  loaded: Map<string, MockLoadedParcel>;
  /** Xe chưa bắt đầu xếp hàng thì chưa có. */
  loadingStartedAt: string | null;
  dispatchedAt: string | null;
  carrierRepresentative: string | null;
  signatureRef: string | null;
  handoverNote: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  version: number;
  ftl: MockFtlPart;
}

export interface MockCarrier {
  carrierId: string;
  code: string;
  name: string;
  contactName: string;
  contactPhone: string;
  status: "ACTIVE" | "INACTIVE";
  connectionType: "MANUAL" | "WEBHOOK_LOAD" | "API_BOOKING";
  /** Khoá bí mật webhook đã lưu (BE chỉ nói đã đặt hay chưa). */
  webhookSecretConfigured: boolean;
  version: number;
}

export interface DispatchState {
  carriers: MockCarrier[];
  shipments: Map<string, MockShipment>;
  loads: Map<string, MockLoad>;
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

const CONNECTIONS = ["MANUAL", "WEBHOOK_LOAD"] as const;

async function buildState(): Promise<DispatchState> {
  const { packingTasks, carriers, orders, warehouses } = await import("@/lib/mock-data");
  const mockCarriers: MockCarrier[] = carriers.map((carrier, index) => ({
    carrierId: carrier.carrierId,
    code: carrier.code,
    name: carrier.name,
    contactName: `Điều phối ${carrier.code}`,
    contactPhone: `028 3900 00${10 + index}`,
    status: "ACTIVE",
    connectionType: CONNECTIONS[index % CONNECTIONS.length] ?? "MANUAL",
    webhookSecretConfigured: index % CONNECTIONS.length === 1,
    version: 0,
  }));
  // Một hãng tích hợp API đặt xe để thử luồng đặt xe qua API (BR-29); mock-data không có hãng loại này
  mockCarriers.push({
    carrierId: "carrier-api-booking",
    code: "AHAMOVE",
    name: "Ahamove (đặt xe qua API)",
    contactName: "Điều phối AHAMOVE",
    contactPhone: "028 3900 0099",
    status: "ACTIVE",
    connectionType: "API_BOOKING",
    webhookSecretConfigured: false,
    version: 0,
  });
  const state: DispatchState = {
    carriers: mockCarriers,
    shipments: new Map(),
    loads: new Map(),
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
  seedFtlScenario(state, orders, [...state.shipments.values()]);
  linkPartiallyFulfilledOrders(state, orders);
  return state;
}

/**
 * Lô giao mà mock đơn hàng đã dựng sẵn (`<id đơn>-SHIP-1`, đơn giao một phần): cùng id để liên kết từ chi tiết đơn sang
 * chi tiết lô mở được (BE `fk_order_shipment_shipment`: lô của đơn = lô của kho). Lô nằm trên xe đã bàn giao đầu tiên.
 */
function linkPartiallyFulfilledOrders(
  state: DispatchState,
  orders: readonly { orderId: string; orderNumber: string; status: string }[],
): void {
  const dispatched = [...state.loads.values()].find((l) => l.status === "DISPATCHED");
  const base = [...state.shipments.values()][0];
  if (!dispatched || !base) return;
  for (const order of orders.filter((o) => o.status === "Partially Fulfilled")) {
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
      carrierId: dispatched.carrierId,
      loadId: dispatched.loadId,
      handedOverAt: dispatched.dispatchedAt,
      block: null,
      timeline: [...base.timeline.slice(0, 1)],
    };
    state.shipments.set(shipment.shipmentId, shipment);
    dispatched.shipmentIds.push(shipment.shipmentId);
    dispatched.ftl.placed.add(parcel.packageId);
    dispatched.loaded.set(parcel.packageId, {
      packageId: parcel.packageId,
      scanId: `seed-scan-${parcel.packageId}`,
      loadedAt: dispatched.dispatchedAt ?? SEED_AT,
      loadedBy: MOCK_DISPATCHER,
    });
  }
}
