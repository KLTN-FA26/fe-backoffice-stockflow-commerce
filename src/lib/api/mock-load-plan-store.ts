/**
 * Store in-memory cho mock kế hoạch xếp xe (SCRUM-287 PR D, BE PR #161). Lô giao nguyên xe và kiện lấy từ fixture của
 * F1 (`features/load-planning/__fixtures__`: bộ bàn A+B + ghế bar) cộng vài lô nhỏ; bốn kế hoạch phủ các trạng thái:
 * PLANNED (đủ kiện trên một xe), DRAFT, CANCELLED, và CONFIRMED với một xe đang xếp hàng (thử BR-14). Chỉ dùng khi
 * USE_MOCK=true.
 */

import { LOAD_PLAN_STATUS } from "@/constants";
import { LAYOUT_PICKUP_KIT } from "@/features/load-planning/__fixtures__/layouts";

import {
  SEED_PACKED_TRANSFER_FROM,
  SEED_PACKED_TRANSFER_ID,
  SEED_PACKED_TRANSFER_NUMBER,
  SEED_PACKED_TRANSFER_PACKED_AT,
  SEED_PACKED_TRANSFER_PARCELS,
  SEED_PACKED_TRANSFER_TO,
} from "./mock-transfer-pack-seed";
import { getVehicleTypeStore } from "./mock-vehicle-type-store";

import type { LoadPlanSelectionMode, LoadPlanStatus, LoadPlanUnplacedReason } from "@/constants";

export interface MockParcel {
  packageId: string;
  labelCode: string;
  shipmentId: string;
  shipmentCode: string;
  partName: string;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  weightKg: number;
  rotatable: boolean;
  kitGroupId: string | null;
  kitPartNo: number | null;
  kitPartCount: number | null;
}

export interface MockShipment {
  /** Lô giao; với lệnh chuyển kho (`transfer`) là chính id lệnh — mock dùng chung kho ứng viên cho cả hai nguồn. */
  shipmentId: string;
  code: string;
  orderId: string;
  orderNumber: string;
  allowPartialShipment: boolean;
  readyAt: string;
  warehouseId: string;
  packages: MockParcel[];
  /** SCRUM-287 PR T: đây là MỘT lệnh chuyển kho đã đóng gói (nguồn TRANSFER), không phải lô giao của đơn khách. */
  transfer?: { transferOrderId: string; number: string; toWarehouseId: string; status: string };
}

export interface MockPlanVehicle {
  seq: number;
  loadPlanVehicleId: string;
  vehicleTypeId: string;
  /** Mã loại xe + kích thước tại lúc tính (BE sao chép số liệu loại xe lúc tính). */
  code: string;
  innerMm: { l: number; w: number; h: number };
  maxPayloadKg: number;
  boxes: {
    packageId: string;
    xMm: number;
    yMm: number;
    zMm: number;
    wMm: number;
    hMm: number;
    dMm: number;
    orientation: string;
  }[];
  needsRecalculation: boolean;
  load: { loadId: string; code: string; status: string } | null;
}

export interface MockPlan {
  loadPlanId: string;
  code: string;
  requestId: string;
  warehouseId: string;
  /** Nguồn của kế hoạch (BE `LoadPlan.source_type`): lô giao của đơn khách hay MỘT lệnh chuyển kho (`shipmentIds` = [id lệnh]). */
  sourceType: "ORDER" | "TRANSFER";
  selectionMode: LoadPlanSelectionMode;
  status: LoadPlanStatus;
  note: string | null;
  vehicleTypeIds: string[];
  shipmentIds: string[];
  vehicles: MockPlanVehicle[];
  /** Kiện chưa xếp → lý do; kiện không có ở đây và không ở xe nào là kiện đã bị thả (LEFT_BEHIND). */
  unplaced: Map<string, LoadPlanUnplacedReason>;
  leftBehind: string[];
  acknowledgement: { at: string; note: string | null } | null;
  createdAt: string;
  calculatedAt: string | null;
  confirmedAt: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  version: number;
}

const ID = (n: number) => `00000000-0000-4000-8000-0000000f2${String(n).padStart(3, "0")}`;
const HN = "WH-HN-01";
const HCM = "WH-HCM-01";

function parcelsOf(
  shipment: Pick<MockShipment, "shipmentId" | "code">,
  rows: Array<[string, number, number, number, number, number]>,
): MockParcel[] {
  let n = 0;
  return rows.flatMap(([partName, count, l, w, h, kg]) =>
    Array.from({ length: count }, () => {
      n += 1;
      return {
        packageId: `${shipment.shipmentId}-p${String(n).padStart(2, "0")}`,
        labelCode: `PKG-${shipment.code}-${n}`,
        shipmentId: shipment.shipmentId,
        shipmentCode: shipment.code,
        partName,
        lengthMm: l,
        widthMm: w,
        heightMm: h,
        weightKg: kg,
        rotatable: true,
        kitGroupId: null,
        kitPartNo: null,
        kitPartCount: null,
      };
    }),
  );
}

function shipment(
  n: number,
  warehouseId: string,
  orderNumber: string,
  allowPartialShipment: boolean,
  rows: Array<[string, number, number, number, number, number]>,
): MockShipment {
  const head = { shipmentId: ID(n), code: `${orderNumber}-S1` };
  return {
    ...head,
    orderId: ID(n + 100),
    orderNumber,
    allowPartialShipment,
    readyAt: `2026-10-22T0${n}:30:00Z`,
    warehouseId,
    packages: parcelsOf(head, rows),
  };
}

/** Kiện của lô S1 = đúng các hộp của fixture F1 (xe bán tải 4 bộ bàn + 3 ghế bar), id kiện = `ref` của hộp. */
function kitShipment(): MockShipment {
  const head = { shipmentId: ID(1), code: "SO-20261004-000001-S1" };
  const packages = LAYOUT_PICKUP_KIT.boxes.map((box, index): MockParcel => ({
    packageId: box.ref,
    labelCode: `PKG-${head.code}-${index + 1}`,
    shipmentId: head.shipmentId,
    shipmentCode: head.code,
    partName: box.partName,
    lengthMm: box.origMm.l,
    widthMm: box.origMm.w,
    heightMm: box.origMm.h,
    weightKg: box.weightKg,
    rotatable: box.rotatable,
    kitGroupId: box.kitGroup,
    kitPartNo: null,
    kitPartCount: null,
  }));
  return {
    ...head,
    orderId: ID(101),
    orderNumber: "SO-20261004-000001",
    allowPartialShipment: false,
    readyAt: "2026-10-22T01:30:00Z",
    warehouseId: HN,
    packages,
  };
}

/** Lệnh chuyển kho seed đã đóng gói (`TO-2026-0006`): ứng viên của kế hoạch xe nguồn TRANSFER. */
function seedTransferShipment(): MockShipment {
  const head = { shipmentId: SEED_PACKED_TRANSFER_ID, code: SEED_PACKED_TRANSFER_NUMBER };
  return {
    ...head,
    orderId: "",
    orderNumber: "",
    allowPartialShipment: false,
    readyAt: SEED_PACKED_TRANSFER_PACKED_AT,
    warehouseId: SEED_PACKED_TRANSFER_FROM,
    packages: SEED_PACKED_TRANSFER_PARCELS.map((p) => ({
      packageId: `${SEED_PACKED_TRANSFER_ID}-pkg-${p.n}`,
      labelCode: `PKG-${SEED_PACKED_TRANSFER_ID}-${p.n}`,
      shipmentId: SEED_PACKED_TRANSFER_ID,
      shipmentCode: SEED_PACKED_TRANSFER_NUMBER,
      partName: p.sku,
      lengthMm: p.lengthCm * 10,
      widthMm: p.widthCm * 10,
      heightMm: p.heightCm * 10,
      weightKg: p.kg,
      rotatable: true,
      kitGroupId: null,
      kitPartNo: null,
      kitPartCount: null,
    })),
    transfer: {
      transferOrderId: SEED_PACKED_TRANSFER_ID,
      number: SEED_PACKED_TRANSFER_NUMBER,
      toWarehouseId: SEED_PACKED_TRANSFER_TO,
      status: "PICKING",
    },
  };
}

function seedShipments(): MockShipment[] {
  return [
    kitShipment(),
    // Có kiện 2600 mm: dài hơn mọi xe bán tải / xe tải nhỏ → TOO_LARGE; đơn KHÔNG cho giao một phần (LP-4)
    shipment(2, HN, "SO-20261006-000004", false, [
      ["Bàn trà", 6, 1000, 600, 500, 14],
      ["Tủ vải", 2, 2600, 500, 500, 30],
    ]),
    shipment(3, HN, "SO-20261007-000002", true, [["Ghế ăn", 8, 800, 500, 300, 6.2]]),
    shipment(4, HCM, "SO-20261008-000003", true, [
      ["Kệ sách", 4, 1200, 300, 1800, 22],
      ["Phụ kiện", 6, 400, 300, 200, 3],
    ]),
    shipment(5, HN, "SO-20261003-000007", true, [["Sofa", 5, 600, 400, 400, 9.5]]),
    seedTransferShipment(),
  ];
}

function seedPlans(shipments: MockShipment[]): MockPlan[] {
  const types = [...getVehicleTypeStore().values()];
  const pickup = types.find((type) => type.code === "PICKUP") ?? types[0];
  const truck = types.find((type) => type.code === "TRUCK-1T25") ?? types[0];
  const common = {
    sourceType: "ORDER" as const,
    unplaced: new Map<string, LoadPlanUnplacedReason>(),
    leftBehind: [],
    acknowledgement: null,
    reopenedAt: null,
    reopenReason: null,
    cancelledAt: null,
    cancelReason: null,
    note: null,
    selectionMode: "SINGLE_TYPE" as const,
  };
  const vehicleOf = (s: MockShipment, loadStatus: string | null): MockPlanVehicle => ({
    seq: 1,
    loadPlanVehicleId: `${s.shipmentId}-v1`,
    vehicleTypeId: truck.vehicleTypeId,
    code: truck.code,
    innerMm: { l: truck.innerLengthMm, w: truck.innerWidthMm, h: truck.innerHeightMm },
    maxPayloadKg: truck.maxPayloadKg,
    boxes: s.packages.map((p, i) => ({
      packageId: p.packageId,
      xMm: (i % 3) * p.widthMm,
      yMm: 0,
      zMm: Math.floor(i / 3) * p.lengthMm,
      wMm: p.widthMm,
      hMm: p.heightMm,
      dMm: p.lengthMm,
      orientation: "LWH",
    })),
    needsRecalculation: false,
    load: loadStatus
      ? { loadId: `${s.shipmentId}-load`, code: "LD-20261021-0001", status: loadStatus }
      : null,
  });
  const [kit, , draftShipment, , loading] = shipments;
  return [
    {
      ...common,
      loadPlanId: ID(201),
      code: "LP-20261022-0001",
      requestId: ID(301),
      warehouseId: HN,
      status: LOAD_PLAN_STATUS.PLANNED,
      vehicleTypeIds: [pickup.vehicleTypeId],
      shipmentIds: [kit.shipmentId],
      vehicles: [
        {
          seq: 1,
          loadPlanVehicleId: ID(401),
          vehicleTypeId: pickup.vehicleTypeId,
          code: LAYOUT_PICKUP_KIT.code,
          innerMm: LAYOUT_PICKUP_KIT.innerMm,
          maxPayloadKg: LAYOUT_PICKUP_KIT.maxPayloadKg,
          boxes: LAYOUT_PICKUP_KIT.boxes.map((box) => ({
            packageId: box.ref,
            xMm: box.xMm,
            yMm: box.yMm,
            zMm: box.zMm,
            wMm: box.wMm,
            hMm: box.hMm,
            dMm: box.dMm,
            orientation: box.orientation,
          })),
          needsRecalculation: false,
          load: null,
        },
      ],
      createdAt: "2026-10-22T02:00:00Z",
      calculatedAt: "2026-10-22T02:05:00Z",
      confirmedAt: null,
      version: 4,
    },
    {
      ...common,
      loadPlanId: ID(202),
      code: "LP-20261022-0002",
      requestId: ID(302),
      warehouseId: HN,
      status: LOAD_PLAN_STATUS.DRAFT,
      vehicleTypeIds: [truck.vehicleTypeId],
      shipmentIds: [draftShipment.shipmentId],
      vehicles: [],
      createdAt: "2026-10-22T03:00:00Z",
      calculatedAt: null,
      confirmedAt: null,
      version: 1,
    },
    {
      ...common,
      loadPlanId: ID(203),
      code: "LP-20261020-0003",
      requestId: ID(303),
      warehouseId: HCM,
      status: LOAD_PLAN_STATUS.CANCELLED,
      vehicleTypeIds: [truck.vehicleTypeId],
      shipmentIds: [],
      vehicles: [],
      createdAt: "2026-10-20T03:00:00Z",
      calculatedAt: null,
      confirmedAt: null,
      cancelledAt: "2026-10-20T04:00:00Z",
      cancelReason: "Khách đổi lịch nhận hàng",
      version: 2,
    },
    {
      ...common,
      loadPlanId: ID(204),
      code: "LP-20261021-0004",
      requestId: ID(304),
      warehouseId: HN,
      status: LOAD_PLAN_STATUS.CONFIRMED,
      vehicleTypeIds: [truck.vehicleTypeId],
      shipmentIds: [loading.shipmentId],
      // Xe đang xếp hàng (chuyến LOADING): mở lại / huỷ → 409 LOAD_PLAN_LOADING_STARTED (BR-14)
      vehicles: [vehicleOf(loading, "LOADING")],
      createdAt: "2026-10-21T02:00:00Z",
      calculatedAt: "2026-10-21T02:05:00Z",
      confirmedAt: "2026-10-21T02:30:00Z",
      version: 6,
    },
  ];
}

let shipments: MockShipment[] | null = null;
let plans: Map<string, MockPlan> | null = null;
let planSerial = 4;

export function getMockShipments(): MockShipment[] {
  shipments ??= seedShipments();
  return shipments;
}

export function getMockPlans(): Map<string, MockPlan> {
  plans ??= new Map(seedPlans(getMockShipments()).map((plan) => [plan.loadPlanId, plan]));
  return plans;
}

export function resetLoadPlanMockStore(): void {
  shipments = null;
  plans = null;
  planSerial = 4;
}

export function nextLoadPlan(): { loadPlanId: string; code: string } {
  planSerial += 1;
  return {
    loadPlanId: ID(200 + planSerial),
    code: `LP-20261022-${String(planSerial).padStart(4, "0")}`,
  };
}

/** Kiện đang bị một kế hoạch còn sống (DRAFT / PLANNED / CONFIRMED) giữ — BR-09. */
export function heldPackageIds(exceptPlanId?: string): Set<string> {
  const held = new Set<string>();
  for (const plan of getMockPlans().values()) {
    if (plan.loadPlanId === exceptPlanId) continue;
    if (plan.status === "CANCELLED" || plan.status === "DISPATCHED") continue;
    const lot = new Set(plan.shipmentIds);
    for (const s of getMockShipments())
      if (lot.has(s.shipmentId))
        for (const p of s.packages)
          if (!plan.leftBehind.includes(p.packageId)) held.add(p.packageId);
  }
  return held;
}
