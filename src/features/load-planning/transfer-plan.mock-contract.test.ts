/**
 * Contract mock kế hoạch xếp xe nguồn TRANSFER (BE PR #164, LP-9; docs 09 §3, §4.2 bước 1): ứng viên là lệnh chuyển kho đã
 * đóng gói, một kế hoạch chứa đúng MỘT lệnh và đi nguyên (`TRANSFER_SHIPS_WHOLE`), không trộn với lô giao
 * (`LOAD_PLAN_SOURCE_MISMATCH`). Chạy handler mock thật rồi parse bằng schema FE.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { FULFILLMENT_PACKAGE_PERMISSIONS, FULFILLMENT_PACKING_PERMISSIONS } from "@/constants";
import { resetLoadPlanMockStore } from "@/lib/api/mock-load-plan-store";
import { registerTransferOrderMockRoutes } from "@/lib/api/mock-routes-transfer-orders";
import { resetTransferMockStore } from "@/lib/api/mock-routes-transfer-orders-store";
import { registerTransferPackMockRoutes } from "@/lib/api/mock-routes-transfer-packs";
import { resetTransferPackMockStore } from "@/lib/api/mock-routes-transfer-packs-store";
import { resetVehicleTypeMockStore } from "@/lib/api/mock-vehicle-type-store";

import {
  DISPATCHER,
  PATH,
  SEED,
  actAs,
  call,
  errorCode,
  fieldsOf,
  newRequestId,
  vehicleTypeId,
} from "./__fixtures__/mock-contract";
import { beCandidateListSchema, bePlanDetailSchema, bePlanRowPageSchema } from "./plan-schemas";
import { beReconciliationSchema } from "./reconciliation-schemas";

registerTransferOrderMockRoutes();
registerTransferPackMockRoutes();

const CANDIDATES = "/fulfillment/load-plan-candidates";
const PACKED_TRANSFER = "TO-2026-0006";
const KIT_TRANSFER = "00000000-0000-4000-8000-0000000fa001";
const HN = "WH-HN-01";

beforeEach(() => {
  resetLoadPlanMockStore();
  resetVehicleTypeMockStore();
  resetTransferMockStore();
  resetTransferPackMockStore();
  actAs([
    ...DISPATCHER,
    FULFILLMENT_PACKING_PERMISSIONS.update,
    FULFILLMENT_PACKAGE_PERMISSIONS.read,
  ]);
});

const candidates = async (sourceType?: string) =>
  beCandidateListSchema.parse(
    (await call("GET", CANDIDATES, undefined, { warehouseId: HN, sourceType })).data,
  );

async function createTransferPlan(transferIds: string[], extra: Record<string, unknown> = {}) {
  return call("POST", PATH, {
    requestId: newRequestId(),
    warehouseId: HN,
    sourceType: "TRANSFER",
    transferOrderIds: transferIds,
    vehicleTypeIds: [await vehicleTypeId("PICKUP")],
    ...extra,
  });
}

describe("ứng viên nguồn TRANSFER", () => {
  it("sourceType=TRANSFER liệt kê lệnh chuyển kho đã đóng gói của kho: không có lô giao / đơn, có số lệnh và kho đích; kiện không mang lô giao", async () => {
    const list = await candidates("TRANSFER");
    expect(list).toHaveLength(1);
    const [candidate] = list;
    expect(candidate).toMatchObject({
      sourceType: "TRANSFER",
      transferOrderId: PACKED_TRANSFER,
      toWarehouseId: "WH-DN-01",
      code: PACKED_TRANSFER,
      packageCount: 2,
      packagesInOtherPlans: 0,
    });
    expect(candidate?.shipmentId).toBeUndefined();
    expect(candidate?.orderId).toBeUndefined();
    expect(candidate?.orderNumber).toBeUndefined();
    expect(candidate?.readyAt).toBeDefined();
    for (const parcel of candidate?.packages ?? []) {
      expect(parcel.transferOrderId).toBe(PACKED_TRANSFER);
      expect(parcel.shipmentId).toBeUndefined();
      expect(parcel.shipmentCode).toBeUndefined();
    }
  });

  it("không có sourceType (mặc định ORDER) không trả lệnh chuyển kho, và ngược lại; sourceType lạ → 400", async () => {
    expect((await candidates()).some((c) => c.transferOrderId)).toBe(false);
    expect((await candidates("ORDER")).some((c) => c.transferOrderId)).toBe(false);
    expect((await candidates("TRANSFER")).every((c) => c.sourceType === "TRANSFER")).toBe(true);
    expect(
      errorCode(await call("GET", CANDIDATES, undefined, { warehouseId: HN, sourceType: "DRONE" })),
    ).toBe("VALIDATION_FAILED");
  });

  it("kho khác không thấy lệnh; cần fulfillment-load-plans:READ", async () => {
    const other = beCandidateListSchema.parse(
      (
        await call("GET", CANDIDATES, undefined, {
          warehouseId: "WH-HCM-01",
          sourceType: "TRANSFER",
        })
      ).data,
    );
    expect(other).toEqual([]);
    actAs([]);
    expect(
      (await call("GET", CANDIDATES, undefined, { warehouseId: HN, sourceType: "TRANSFER" }))
        .status,
    ).toBe(403);
  });
});

describe("lập kế hoạch nguồn TRANSFER", () => {
  it("POST {sourceType, transferOrderIds:[một lệnh]} → DRAFT có transferOrder, shipments rỗng; tính → PLANNED; chốt → CONFIRMED", async () => {
    const created = await createTransferPlan([PACKED_TRANSFER]);
    expect(created.status).toBe(201);
    const draft = bePlanDetailSchema.parse(created.data);
    expect(draft).toMatchObject({ sourceType: "TRANSFER", status: "DRAFT", shipments: [] });
    expect(draft.transferOrder).toEqual({
      transferOrderId: PACKED_TRANSFER,
      number: PACKED_TRANSFER,
      fromWarehouseId: HN,
      toWarehouseId: "WH-DN-01",
      status: "PICKING",
      packageCount: 2,
    });
    expect(draft.packages).toHaveLength(2);
    expect(
      draft.packages.every((p) => p.transferOrderId === PACKED_TRANSFER && !p.shipmentId),
    ).toBe(true);

    const planned = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${draft.loadPlanId}/calculation`, {
          expectedVersion: draft.version,
        })
      ).data,
    );
    expect(planned).toMatchObject({ status: "PLANNED", placedCount: 2, unplacedCount: 0 });
    const confirmed = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${draft.loadPlanId}/confirmation`, {
          expectedVersion: planned.version,
        })
      ).data,
    );
    expect(confirmed.status).toBe("CONFIRMED");
    expect(confirmed.vehicles.every((v) => v.load?.status === "PLANNED")).toBe(true);

    // Danh sách và đối chiếu của kế hoạch nguồn TRANSFER
    const row = bePlanRowPageSchema
      .parse((await call("GET", PATH, undefined, {})).data)
      .items.find((r) => r.loadPlanId === draft.loadPlanId);
    expect(row).toMatchObject({ sourceType: "TRANSFER", shipmentCount: 1, packageCount: 2 });
    const reconciliation = beReconciliationSchema.parse(
      (await call("GET", `${PATH}/${draft.loadPlanId}/reconciliation`)).data,
    );
    expect(reconciliation.pieceCheck).toMatchObject({ packagesIn: 2, placed: 2, balanced: true });
  });

  it("lệnh đã nằm trong kế hoạch sống thì không còn là ứng viên; lập thêm → 409 LOAD_PLAN_PACKAGE_TAKEN (BR-09)", async () => {
    expect((await createTransferPlan([PACKED_TRANSFER])).status).toBe(201);
    expect(await candidates("TRANSFER")).toEqual([]);
    expect(errorCode(await createTransferPlan([PACKED_TRANSFER]))).toBe("LOAD_PLAN_PACKAGE_TAKEN");
  });

  it("không trộn nguồn: lệnh trong kế hoạch đơn khách, lô giao trong kế hoạch lệnh → 409 LOAD_PLAN_SOURCE_MISMATCH", async () => {
    const type = await vehicleTypeId("PICKUP");
    const orderPlanWithTransfer = await call("POST", PATH, {
      requestId: newRequestId(),
      warehouseId: HN,
      shipmentIds: [PACKED_TRANSFER],
      vehicleTypeIds: [type],
    });
    expect(errorCode(orderPlanWithTransfer)).toBe("LOAD_PLAN_SOURCE_MISMATCH");
    // Gửi nhầm loại id (BE `requireOneSource`)
    expect(
      errorCode(await createTransferPlan([PACKED_TRANSFER], { shipmentIds: [SEED.kitShipment] })),
    ).toBe("LOAD_PLAN_SOURCE_MISMATCH");
    expect(
      errorCode(
        await call("POST", PATH, {
          requestId: newRequestId(),
          warehouseId: HN,
          shipmentIds: [SEED.kitShipment],
          transferOrderIds: [PACKED_TRANSFER],
          vehicleTypeIds: [type],
        }),
      ),
    ).toBe("LOAD_PLAN_SOURCE_MISMATCH");
  });

  it("lệnh chưa đóng gói / không phải lệnh → TRANSFER_NOT_PACKED; hai lệnh → 400; sourceType lạ → 400 LOAD_PLAN_SOURCE_INVALID", async () => {
    expect(errorCode(await createTransferPlan([SEED.kitShipment]))).toBe("TRANSFER_NOT_PACKED");
    expect(errorCode(await createTransferPlan([KIT_TRANSFER]))).toBe("TRANSFER_NOT_PACKED");
    const two = await createTransferPlan([PACKED_TRANSFER, KIT_TRANSFER]);
    expect(errorCode(two)).toBe("VALIDATION_FAILED");
    expect(fieldsOf(two).map((f) => f.field)).toContain("transferOrderIds");
    const bad = await createTransferPlan([PACKED_TRANSFER], { sourceType: "DRONE" });
    expect(errorCode(bad)).toBe("VALIDATION_FAILED");
    expect((fieldsOf(bad)[0] as { code?: string }).code).toBe("LOAD_PLAN_SOURCE_INVALID");
  });

  it("đổi đầu vào (PUT …/inputs) của kế hoạch TRANSFER nhận transferOrderIds, từ chối shipmentIds", async () => {
    const draft = bePlanDetailSchema.parse((await createTransferPlan([PACKED_TRANSFER])).data);
    const types = [await vehicleTypeId("PICKUP")];
    const mismatch = await call("PUT", `${PATH}/${draft.loadPlanId}/inputs`, {
      expectedVersion: draft.version,
      shipmentIds: [SEED.kitShipment],
      vehicleTypeIds: types,
    });
    expect(errorCode(mismatch)).toBe("LOAD_PLAN_SOURCE_MISMATCH");
    const ok = await call("PUT", `${PATH}/${draft.loadPlanId}/inputs`, {
      expectedVersion: draft.version,
      transferOrderIds: [PACKED_TRANSFER],
      vehicleTypeIds: types,
      selectionMode: "FEWEST_VEHICLES",
    });
    expect(bePlanDetailSchema.parse(ok.data)).toMatchObject({
      sourceType: "TRANSFER",
      selectionMode: "FEWEST_VEHICLES",
    });
  });
});

describe("lệnh chuyển kho đi nguyên (TRANSFER_SHIPS_WHOLE)", () => {
  /** Đóng gói hai kiện — một vừa, một quá khổ (3 m mỗi chiều) — rồi hoàn tất một phần: kế hoạch sẽ có một kiện không xếp được. */
  async function packOneFitsOneOversized() {
    const open = await call("POST", "/fulfillment/transfer-packs", {
      transferOrderId: KIT_TRANSFER,
    });
    const packId = (open.data as { packId: string }).packId;
    for (const [lengthCm, widthCm, heightCm] of [
      [40, 30, 20],
      [300, 300, 300],
    ]) {
      const parcel = (await call("POST", `/fulfillment/transfer-packs/${packId}/packages`, {}))
        .data as { packageId: string };
      const base = `/fulfillment/transfer-packs/${packId}/packages/${parcel.packageId}`;
      await call("POST", `${base}/scans`, {
        scanId: newRequestId(),
        scannedCode: "SKU-001-BLK-L",
        quantity: 1,
        transferLineId: "tol-kit-2",
      });
      await call("POST", `${base}/seal`, { weightKg: 10, lengthCm, widthCm, heightCm });
    }
    const done = await call("POST", `/fulfillment/transfer-packs/${packId}/completion`, {
      partial: true,
      note: "Chỉ chuyển hai đơn vị",
    });
    expect(done.status).toBe(200);
  }

  it("kiện không xếp được: không có 'để lại' — xác nhận để lại và chốt đều 409 TRANSFER_SHIPS_WHOLE; kế hoạch giữ nguyên PLANNED", async () => {
    await packOneFitsOneOversized();
    const draft = bePlanDetailSchema.parse((await createTransferPlan([KIT_TRANSFER])).data);
    const planned = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${draft.loadPlanId}/calculation`, {
          expectedVersion: draft.version,
        })
      ).data,
    );
    expect(planned).toMatchObject({ status: "PLANNED", placedCount: 1, unplacedCount: 1 });
    const ack = await call("POST", `${PATH}/${draft.loadPlanId}/unplaced-acknowledgement`, {
      expectedVersion: planned.version,
    });
    expect(ack.status).toBe(409);
    expect(errorCode(ack)).toBe("TRANSFER_SHIPS_WHOLE");
    const confirm = await call("POST", `${PATH}/${draft.loadPlanId}/confirmation`, {
      expectedVersion: planned.version,
    });
    expect(errorCode(confirm)).toBe("TRANSFER_SHIPS_WHOLE");
    expect(
      bePlanDetailSchema.parse((await call("GET", `${PATH}/${draft.loadPlanId}`)).data).status,
    ).toBe("PLANNED");
  });

  it("kế hoạch đơn khách vẫn cho để lại kiện (không đổi hành vi cũ): xác nhận để lại không bị TRANSFER_SHIPS_WHOLE", async () => {
    const created = await call("POST", PATH, {
      requestId: newRequestId(),
      warehouseId: HN,
      shipmentIds: [SEED.bigShipment],
      vehicleTypeIds: [await vehicleTypeId("PICKUP")],
    });
    const draft = bePlanDetailSchema.parse(created.data);
    const planned = bePlanDetailSchema.parse(
      (
        await call("POST", `${PATH}/${draft.loadPlanId}/calculation`, {
          expectedVersion: draft.version,
        })
      ).data,
    );
    expect(planned.unplacedCount).toBeGreaterThan(0);
    const ack = await call("POST", `${PATH}/${draft.loadPlanId}/unplaced-acknowledgement`, {
      expectedVersion: planned.version,
    });
    expect(errorCode(ack)).not.toBe("TRANSFER_SHIPS_WHOLE");
  });
});
