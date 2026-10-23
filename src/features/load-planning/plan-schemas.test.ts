import { describe, expect, it } from "vitest";

import { LayoutSchema } from "./schemas";
import {
  beCandidateListSchema,
  beLayoutListSchema,
  bePlanDetailSchema,
  bePlanRowPageSchema,
  beVehicleSummarySchema,
} from "./plan-schemas";
import { beReconciliationSchema, knownFlags } from "./reconciliation-schemas";

/** Mẫu thật của BE PR #161 (phần "Live API check"): số kiện kèm trường BigDecimal dạng số; trường null bị bỏ khỏi JSON. */
const BE_VEHICLE = {
  seq: 1,
  loadPlanVehicleId: "01a1635c-bf46-70cb-98a6-db9d64ed4cb1",
  vehicleTypeId: "db1b36b8-0720-3c71-8e32-96bdc1c018d5",
  code: "TRUCK-1T25",
  packageCount: 30,
  usedVolumeMm3: 3963960000,
  usedWeightKg: 94.5,
  volumeFillPct: 49.95,
  weightFillPct: 7.56,
};

const BE_PARCEL = {
  packageId: "01a1635c-aab3-707a-b76c-e8409c8cf0e8",
  labelCode: "PKG-SO-20261004-000001-1",
  shipmentId: "01a1635c-bd12-7032-b79e-8f5799023d2c",
  shipmentCode: "SO-20261004-000001-S1",
  partName: "LYG-ESP-4OZ 1/2",
  lengthMm: 520,
  widthMm: 420,
  heightMm: 600,
  weightKg: 3.1,
  rotatable: true,
  kitGroupId: "01a1635c-aab3-707c-9e4c-6cb63af13c68",
  kitPartNo: 1,
  kitPartCount: 2,
};

const BE_DETAIL = {
  loadPlanId: "01a1635c-bdcf-7081-ae47-598859eefe51",
  code: "LP-20261022-0001",
  warehouseId: "WH-HN-01",
  sourceType: "SHIPMENT",
  selectionMode: "SINGLE_TYPE",
  status: "PLANNED",
  vehicleTypes: [
    {
      vehicleTypeId: "db1b36b8-0720-3c71-8e32-96bdc1c018d5",
      code: "TRUCK-1T25",
      name: "Box truck 1.25 t",
      kind: "TRUCK",
      availableCount: 10,
      status: "ACTIVE",
    },
  ],
  shipments: [
    {
      shipmentId: BE_PARCEL.shipmentId,
      code: BE_PARCEL.shipmentCode,
      orderId: "735b4046-3045-3eb6-f583-8eda1c2d050f",
      orderNumber: "SO-20261004-000001",
      allowPartialShipment: false,
      packageCount: 61,
    },
  ],
  vehicles: [BE_VEHICLE],
  packages: [{ ...BE_PARCEL, vehicleSeq: 1 }],
  packageCount: 61,
  placedCount: 60,
  unplacedCount: 1,
  solverMeta: { algorithm: "GRASP_KIT", minVehicles: 2, budgetExhausted: false },
  calculatedAt: "2026-10-22T11:26:24Z",
  createdAt: "2026-10-22T11:26:23Z",
  version: 9,
};

describe("bePlanDetailSchema (BE LoadPlans.PlanDetail)", () => {
  it("parses a real response: omitted null fields become undefined, needsRecalculation defaults to false", () => {
    const plan = bePlanDetailSchema.parse(BE_DETAIL);
    expect(plan.status).toBe("PLANNED");
    expect(plan.version).toBe(9);
    expect(plan.vehicles[0]).toMatchObject({ seq: 1, needsRecalculation: false });
    expect(plan.vehicles[0].load).toBeUndefined();
    expect(plan.packages[0].vehicleSeq).toBe(1);
    expect(plan.packages[0].unplacedReason).toBeUndefined();
    expect(plan.unplacedAcknowledgement).toBeUndefined();
  });

  it("reads the unplaced reasons the BE emits, including MANUAL", () => {
    const parcel = (unplacedReason: string) => ({ ...BE_PARCEL, unplacedReason });
    for (const reason of [
      "TOO_LARGE",
      "TOO_HEAVY",
      "NO_VEHICLE_AVAILABLE",
      "NO_SPACE",
      "SEARCH_CUT_OFF",
      "MANUAL",
    ])
      expect(
        bePlanDetailSchema.parse({ ...BE_DETAIL, packages: [parcel(reason)] }).packages[0]
          .unplacedReason,
      ).toBe(reason);
  });

  it("accepts BigDecimal sent as a numeric string and rejects NaN / unknown values", () => {
    const vehicle = beVehicleSummarySchema.parse({ ...BE_VEHICLE, usedWeightKg: "94.50" });
    expect(vehicle.usedWeightKg).toBe(94.5);
    expect(() => beVehicleSummarySchema.parse({ ...BE_VEHICLE, usedWeightKg: "abc" })).toThrow();
    expect(() => bePlanDetailSchema.parse({ ...BE_DETAIL, status: "RUNNING" })).toThrow();
    expect(() => bePlanDetailSchema.parse({ ...BE_DETAIL, selectionMode: "ANY" })).toThrow();
  });

  it("keeps the vehicle's dispatch load and the recalculation flag", () => {
    const vehicle = beVehicleSummarySchema.parse({
      ...BE_VEHICLE,
      needsRecalculation: true,
      load: { loadId: "l-1", code: "LD-20261022-0001", status: "PLANNED" },
    });
    expect(vehicle.needsRecalculation).toBe(true);
    expect(vehicle.load?.code).toBe("LD-20261022-0001");
  });
});

describe("bePlanRowPageSchema and candidates", () => {
  it("parses a PageResponse of plan rows (version included for the next call)", () => {
    const page = bePlanRowPageSchema.parse({
      items: [
        {
          loadPlanId: "p-1",
          code: "LP-1",
          warehouseId: "WH-HN-01",
          status: "DRAFT",
          selectionMode: "FEWEST_VEHICLES",
          shipmentCount: 1,
          packageCount: 12,
          vehicleCount: 0,
          unplacedCount: 0,
          createdAt: "2026-10-22T00:00:00Z",
          version: 0,
        },
      ],
      page: 0,
      size: 15,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(page.items[0]).toMatchObject({ status: "DRAFT", selectionMode: "FEWEST_VEHICLES" });
  });

  it("parses a candidate shipment with its free packages", () => {
    const [candidate] = beCandidateListSchema.parse([
      {
        shipmentId: BE_PARCEL.shipmentId,
        code: BE_PARCEL.shipmentCode,
        orderId: "o-1",
        orderNumber: "SO-1",
        allowPartialShipment: false,
        readyAt: "2026-10-22T11:26:24.500355Z",
        packageCount: 61,
        packagesInOtherPlans: 0,
        weightKg: 201.0,
        volumeMm3: 8023920000,
        packages: [BE_PARCEL],
      },
    ]);
    expect(candidate.packages[0]).toMatchObject({ kitPartNo: 1, rotatable: true });
    expect(candidate.volumeMm3).toBe(8023920000);
  });
});

describe("fields the BE omits when null (non_null)", () => {
  it("a candidate / plan shipment whose order is unresolved has no orderNumber, and may have no readyAt", () => {
    const [candidate] = beCandidateListSchema.parse([
      {
        shipmentId: "s-1",
        code: "S-1",
        orderId: "o-1",
        allowPartialShipment: true,
        packageCount: 1,
        packagesInOtherPlans: 0,
        weightKg: 1,
        volumeMm3: 1,
        packages: [],
      },
    ]);
    expect(candidate.orderNumber).toBeUndefined();
    expect(candidate.readyAt).toBeUndefined();
    const plan = bePlanDetailSchema.parse({
      ...BE_DETAIL,
      shipments: [
        {
          shipmentId: "s-1",
          code: "S-1",
          orderId: "o-1",
          allowPartialShipment: true,
          packageCount: 1,
        },
      ],
    });
    expect(plan.shipments[0].orderNumber).toBeUndefined();
  });
});

describe("layouts of a plan (BE Layout from Layouts.of)", () => {
  const BE_BOX = {
    xMm: 0,
    yMm: 0,
    zMm: 0,
    wMm: 520,
    hMm: 610,
    dMm: 420,
    ref: "01a1635c-aab3-707b-902e-d1097ee5bc90",
    label: "PKG-SO-20261004-000001-2",
    partName: "LYG-ESP-4OZ 2/2",
    kitGroup: "01a1635c-aab3-707c-9e4c-6cb63af13c68",
    origMm: { l: 520, w: 420, h: 610 },
    orientation: "WLH",
    rotatable: true,
    weightKg: 3.2,
    loadSequence: 1,
  };
  const BE_LAYOUT = {
    seq: 1,
    code: "TRUCK-1T25",
    vehicleTypeId: "db1b36b8-0720-3c71-8e32-96bdc1c018d5",
    innerMm: { l: 3100, w: 1600, h: 1600 },
    maxPayloadKg: 1250.0,
    gussets: [],
    usedVolumeMm3: 3963960000,
    usedWeightKg: 94.5,
    volumeFillPct: 49.95,
    weightFillPct: 7.56,
    boxes: [BE_BOX],
  };

  it("reads the F1 contract and ignores the BE extras (vehicleTypeId, fill %, loadSequence)", () => {
    const layout = LayoutSchema.parse(BE_LAYOUT);
    expect(layout.boxes[0]).toMatchObject({ orientation: "WLH", sourceRef: null });
    expect(layout).not.toHaveProperty("volumeFillPct");
    expect(layout.boxes[0]).not.toHaveProperty("loadSequence");
  });

  it("parses the list of every vehicle in seq order", () => {
    const list = beLayoutListSchema.parse([BE_LAYOUT, { ...BE_LAYOUT, seq: 2 }]);
    expect(list.map((l) => l.seq)).toEqual([1, 2]);
  });
});

describe("beReconciliationSchema (pieceCheck + vsEstimate)", () => {
  const piece = {
    key: "k",
    code: "LP-1",
    packagesIn: 61,
    placed: 61,
    unplaced: 0,
    leftBehind: 0,
    notInPlan: 0,
    balanced: true,
  };

  it("parses a plan with no estimate yet: vsEstimate stays absent", () => {
    const result = beReconciliationSchema.parse({
      pieceCheck: piece,
      shipments: [piece],
      orders: [piece],
    });
    expect(result.pieceCheck.balanced).toBe(true);
    expect(result.vsEstimate).toBeUndefined();
  });

  it("parses the advisory comparison: orders[], notEstimated[], flags and measures", () => {
    const result = beReconciliationSchema.parse({
      pieceCheck: piece,
      shipments: [],
      orders: [],
      vsEstimate: {
        estimateIds: ["e-1"],
        notEstimated: ["o-2"],
        vehiclesCompared: false,
        vehiclesByType: [],
        orders: [
          {
            orderId: "o-1",
            estimateId: "e-1",
            vehiclesByType: [{ code: "40HC", estimated: 1, actual: 1 }],
          },
        ],
        cartonsByLine: [{ orderLineId: "l-1", sku: "SKU-1", estimated: 10, actual: 12 }],
        volumeMm3: { estimated: 100, actual: 112, deltaPct: 12 },
        weightKg: { estimated: "50.5", actual: 51 },
        flags: ["NO_ESTIMATE", "ESTIMATE_INCOMPLETE", "SOMETHING_NEW"],
      },
    });
    const vs = result.vsEstimate;
    expect(vs?.vehiclesCompared).toBe(false);
    expect(vs?.weightKg?.estimated).toBe(50.5);
    expect(vs?.weightKg?.deltaPct).toBeUndefined();
    expect(vs?.notEstimated).toEqual(["o-2"]);
  });

  it("parses the REAL BE shape when no order has an estimate: volumeMm3 / weightKg / orders omitted, only NO_ESTIMATE", () => {
    // Reproduced against the live BE (`non_null` drops the null Measure fields and the empty comparison lists stay)
    const result = beReconciliationSchema.parse({
      pieceCheck: piece,
      shipments: [{ ...piece, code: undefined }],
      orders: [],
      vsEstimate: {
        estimateIds: [],
        notEstimated: ["o-1"],
        vehiclesCompared: false,
        vehiclesByType: [],
        orders: [],
        cartonsByLine: [],
        flags: ["NO_ESTIMATE"],
      },
    });
    expect(result.vsEstimate?.volumeMm3).toBeUndefined();
    expect(result.vsEstimate?.weightKg).toBeUndefined();
    expect(result.vsEstimate?.flags).toEqual(["NO_ESTIMATE"]);
    // A piece count whose order the BE could not resolve has no code
    expect(result.shipments[0].code).toBeUndefined();
  });

  it("knownFlags keeps only the flags with a Vietnamese label, in a fixed order", () => {
    expect(knownFlags(["VOLUME_ABOVE", "SOMETHING_NEW", "NO_ESTIMATE"])).toEqual([
      "NO_ESTIMATE",
      "VOLUME_ABOVE",
    ]);
    expect(knownFlags([])).toEqual([]);
  });
});

/** Mẫu của BE PR #164: kiện / ứng viên / chi tiết của kế hoạch nguồn TRANSFER (một lệnh chuyển kho). */
const TRANSFER_ID = "01a1635c-cc00-7000-8000-000000000001";
const TRANSFER_PARCEL = {
  packageId: "01a1635c-cc00-7000-8000-0000000000a1",
  labelCode: "PKG-TO-20261022-0001-1",
  transferOrderId: TRANSFER_ID,
  partName: "SKU-001-BLK-L",
  lengthMm: 600,
  widthMm: 400,
  heightMm: 350,
  weightKg: 18.5,
  rotatable: true,
};

describe("nguồn TRANSFER (BE PR #164, LP-9)", () => {
  it("kiện của lệnh chuyển kho: shipmentId / shipmentCode vắng (BE bỏ null), chỉ có transferOrderId", () => {
    const detail = bePlanDetailSchema.parse({
      ...BE_DETAIL,
      sourceType: "TRANSFER",
      shipments: [],
      transferOrder: {
        transferOrderId: TRANSFER_ID,
        number: "TO-20261022-0001",
        fromWarehouseId: "WH-HN-01",
        toWarehouseId: "WH-HCM-01",
        status: "PICKING",
        packageCount: 2,
      },
      packages: [{ ...TRANSFER_PARCEL, vehicleSeq: 1 }],
    });
    expect(detail.sourceType).toBe("TRANSFER");
    expect(detail.shipments).toEqual([]);
    expect(detail.transferOrder).toMatchObject({ number: "TO-20261022-0001", packageCount: 2 });
    expect(detail.packages[0]).toMatchObject({ transferOrderId: TRANSFER_ID });
    expect(detail.packages[0].shipmentId).toBeUndefined();
    expect(detail.packages[0].shipmentCode).toBeUndefined();
  });

  it("kế hoạch đơn khách: transferOrder vắng, kiện vẫn có lô giao", () => {
    const detail = bePlanDetailSchema.parse({ ...BE_DETAIL, sourceType: "ORDER" });
    expect(detail.transferOrder).toBeUndefined();
    expect(detail.packages[0].shipmentId).toBe(BE_PARCEL.shipmentId);
    expect(detail.packages[0].transferOrderId).toBeUndefined();
  });

  it("transferOrder thiếu số lệnh hoặc kho → lỗi parse", () => {
    const transferOrder = {
      transferOrderId: TRANSFER_ID,
      number: "TO-1",
      fromWarehouseId: "a",
      toWarehouseId: "b",
      status: "PICKING",
      packageCount: 1,
    };
    expect(() =>
      bePlanDetailSchema.parse({
        ...BE_DETAIL,
        transferOrder: { ...transferOrder, number: undefined },
      }),
    ).toThrow();
    expect(() =>
      bePlanDetailSchema.parse({
        ...BE_DETAIL,
        transferOrder: { ...transferOrder, toWarehouseId: undefined },
      }),
    ).toThrow();
  });

  it("ứng viên TRANSFER: shipmentId / orderId / orderNumber vắng; có transferOrderId, toWarehouseId, sourceType", () => {
    const [candidate] = beCandidateListSchema.parse([
      {
        sourceType: "TRANSFER",
        code: "TO-20261022-0001",
        transferOrderId: TRANSFER_ID,
        toWarehouseId: "WH-HCM-01",
        allowPartialShipment: false,
        readyAt: "2026-10-22T04:00:00Z",
        packageCount: 2,
        packagesInOtherPlans: 0,
        weightKg: 37,
        volumeMm3: 168000000,
        packages: [TRANSFER_PARCEL],
      },
    ]);
    expect(candidate).toMatchObject({
      sourceType: "TRANSFER",
      transferOrderId: TRANSFER_ID,
      toWarehouseId: "WH-HCM-01",
    });
    expect(candidate.shipmentId).toBeUndefined();
    expect(candidate.orderId).toBeUndefined();
  });

  it("dòng danh sách kế hoạch có sourceType (BE cũ không gửi vẫn parse được)", () => {
    const row = {
      loadPlanId: "p",
      code: "LP-1",
      warehouseId: "WH-HN-01",
      status: "DRAFT",
      selectionMode: "SINGLE_TYPE",
      shipmentCount: 1,
      packageCount: 2,
      vehicleCount: 0,
      unplacedCount: 0,
      createdAt: "2026-10-22T02:00:00Z",
      version: 0,
    };
    const page = (items: unknown[]) => ({
      items,
      page: 0,
      size: 15,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
    expect(
      bePlanRowPageSchema.parse(page([{ ...row, sourceType: "TRANSFER" }])).items[0].sourceType,
    ).toBe("TRANSFER");
    expect(bePlanRowPageSchema.parse(page([row])).items[0].sourceType).toBeUndefined();
  });
});
