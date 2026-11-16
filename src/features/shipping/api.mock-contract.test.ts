/**
 * Contract mock giao nguyên chuyến cho hãng (BE sau đợt bỏ gửi kiện 2026-11-08): chạy handler mock thật qua
 * `resolveMockRoute` rồi parse bằng schema FE — đảm bảo màn demo và hợp đồng FE không lệch nhau, và mock giữ đúng mã
 * lỗi / mã quyền BE. Mọi chuyến là một xe của kế hoạch xếp xe. Mã vận đơn, nhập file, danh mục hãng: `api.mock-waybill.test.ts`.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  FULFILLMENT_CARRIER_PERMISSIONS,
  FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS,
} from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { getDispatchState, resetDispatchMockStore } from "@/lib/api/mock-dispatch-store";
import { registerDispatchMockRoutes } from "@/lib/api/mock-routes-dispatch";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import {
  beControlledCancelSchema,
  beLoadPageSchema,
  beLoadSchema,
  beManifestSchema,
} from "./load-schemas";
import { beCarrierPageSchema, beShipmentPageSchema, beShipmentSchema } from "./schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";
import type { Load } from "./types";

registerDispatchMockRoutes();

async function call(method: string, url: string, data?: unknown, params?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const config = {
    url,
    data: data === undefined || data instanceof FormData ? data : JSON.stringify(data),
    params,
    _mockParams: route.params,
  };
  return route.handler(config as AxiosRequestConfig);
}

/**
 * Bộ quyền theo seed BE (mock backend cổng theo mã quyền, lấy từ `MOCK_USER_GRANTS[userId]`): nhân viên kho đặt xe / xếp xe /
 * bàn giao / nhập file mã vận đơn, quản lý kho thêm huỷ có kiểm soát + ghi hàng hoàn, điều phối ghi kết quả giao.
 */
const IMPORT = FULFILLMENT_WAYBILL_IMPORT_PERMISSIONS;
const DISPATCH = FULFILLMENT_DISPATCH_PERMISSIONS.update;
const CONTROLLED = FULFILLMENT_CONTROLLED_CANCELLATION_PERMISSIONS.update;
const WAREHOUSE_STAFF: PermissionCode[] = [DISPATCH, IMPORT.read, IMPORT.create];
const WAREHOUSE_MANAGER: PermissionCode[] = [
  ...WAREHOUSE_STAFF,
  CONTROLLED,
  FULFILLMENT_CARRIER_PERMISSIONS.update,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.update,
];
const ORDER_COORDINATOR: PermissionCode[] = Object.values(FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS);

function actAs(grants: readonly PermissionCode[]) {
  MOCK_USER_GRANTS["u-test"] = grants;
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
  });
}

const SHIPMENTS = "/fulfillment/shipments";
const LOADS = "/fulfillment/loads";
// Seed `mock-dispatch-ftl-store.ts`
const PLANNED_CLEAN = "LD-2026-F003";
const BOOKED_NO_WAYBILL = "LD-2026-F002";
const LOADING = "LD-2026-F001";
const CANCELLED_BOOKED = "LD-2026-F004";
const PLANNED_WINDOW = "LD-2026-F005";
const DISPATCHED = "LD-2026-F006";
const MANUAL_CARRIER = "CAR-GHN";
const API_CARRIER = "carrier-api-booking";

interface ErrorBody {
  errorCode?: string;
  fieldErrors?: { field: string; message: string }[];
  details?: { orders?: Record<string, unknown>[] };
}
const errorBody = (res: { data: unknown }) => res.data as ErrorBody;
const errorCode = (res: { data: unknown }) => errorBody(res).errorCode;

const post = (id: string, path: string, data?: unknown) =>
  call("POST", `${LOADS}/${id}/${path}`, data);
const readLoad = async (id: string): Promise<Load> =>
  beLoadSchema.parse((await call("GET", `${LOADS}/${id}`)).data);
const bookBody = (extra: Record<string, unknown> = {}) => ({
  carrierId: MANUAL_CARRIER,
  vehiclePlate: "51C-1",
  ...extra,
});
const handoverBody = (version: number, extra: Record<string, unknown> = {}) => ({
  version,
  carrierRepresentative: "Anh Tài",
  vehiclePlate: "51C-1",
  signed: true,
  ...extra,
});

async function scanAll(id: string): Promise<Load> {
  let latest = await readLoad(id);
  for (const shipment of latest.shipments) {
    for (const parcel of shipment.packages.filter((p) => !p.loaded)) {
      latest = beLoadSchema.parse(
        (await post(id, "scans", { packageCode: parcel.labelCode })).data,
      );
    }
  }
  return latest;
}

/** Đặt xe thủ công (hãng GHN) → bắt đầu xếp: chuyến PLANNED sang LOADING với mã vận đơn cho sẵn. */
async function bookAndStart(id: string, waybillNo: string): Promise<Load> {
  expect((await post(id, "booking", bookBody({ waybillNo }))).status).toBe(200);
  return beLoadSchema.parse((await post(id, "loading-start")).data);
}

beforeEach(() => {
  resetDispatchMockStore();
  actAs(WAREHOUSE_MANAGER);
});

describe("mock giao nguyên chuyến khớp schema FE", () => {
  it("hãng, lô giao, chuyến, biên bản, chi tiết lô đều parse được và phủ đủ tình huống", async () => {
    const carriers = beCarrierPageSchema.parse((await call("GET", "/fulfillment/carriers")).data);
    expect(new Set(carriers.items.map((c) => c.connection?.connectionType))).toEqual(
      new Set(["MANUAL", "WEBHOOK_LOAD", "API_BOOKING"]),
    );
    const shipments = beShipmentPageSchema.parse(
      (await call("GET", SHIPMENTS, undefined, { size: "200" })).data,
    ).items;
    expect(new Set(shipments.map((s) => s.status))).toEqual(
      new Set(["READY_TO_DISPATCH", "HANDED_OVER", "DELIVERY_FAILED", "CANCELLED"]),
    );
    const loads = beLoadPageSchema.parse(
      (await call("GET", LOADS, undefined, { size: "50" })).data,
    ).items;
    expect(new Set(loads.map((l) => l.status))).toEqual(
      new Set(["PLANNED", "VEHICLE_BOOKED", "LOADING", "DISPATCHED", "CANCELLED"]),
    );
    // Mọi chuyến là một xe của kế hoạch xếp xe; không còn trường `mode`
    expect(loads.every((l) => l.loadPlanCode && l.vehicleSeq)).toBe(true);
    expect(new Set(loads.map((l) => l.loadPlanCode))).toEqual(
      new Set(["LP-2026-0001", "LP-2026-0002"]),
    );
    expect(loads.find((l) => l.loadId === LOADING)?.waybillNo).toBe("GHN-250001");
    expect(loads.find((l) => l.loadId === BOOKED_NO_WAYBILL)?.waybillNo).toBeUndefined();

    const manifest = beManifestSchema.parse(
      (await call("GET", `${LOADS}/${LOADING}/manifest`)).data,
    );
    expect(manifest).toMatchObject({ loadPlanCode: "LP-2026-0001", vehicleSeq: 1 });
    expect(manifest.waybillNo).toBe("GHN-250001");
    expect(manifest.shipments.length).toBeGreaterThan(0);
    // Biên bản theo xe: chỉ kiện kế hoạch xếp lên xe này, không COD
    const load = await readLoad(LOADING);
    expect(manifest.packageCount).toBe(load.expectedPackageCount);
    expect(Object.keys(manifest.shipments[0] ?? {})).not.toContain("codAmount");

    const detail = beShipmentSchema.parse(
      (await call("GET", `${SHIPMENTS}/${shipments[0]?.shipmentId}`)).data,
    );
    expect(detail.timeline.length).toBeGreaterThan(0);
  });

  it("danh sách chuyến lọc theo trạng thái / hãng / mã chuyến / biển số / mã kế hoạch; chuyến không tồn tại → 404 LOAD_NOT_FOUND", async () => {
    const list = async (params: Record<string, string>) =>
      beLoadPageSchema.parse((await call("GET", LOADS, undefined, { size: "50", ...params })).data)
        .items;
    expect((await list({ status: "LOADING" })).map((l) => l.loadId)).toEqual([LOADING]);
    expect((await list({ carrierId: MANUAL_CARRIER })).map((l) => l.loadId).sort()).toEqual([
      LOADING,
      CANCELLED_BOOKED,
      DISPATCHED,
    ]);
    expect((await list({ search: "f001" })).map((l) => l.loadId)).toEqual([LOADING]);
    expect((await list({ search: "29c-123" })).map((l) => l.loadId)).toEqual([LOADING]);
    expect((await list({ search: "LP-2026-0002" })).map((l) => l.loadId).sort()).toEqual([
      PLANNED_WINDOW,
      DISPATCHED,
    ]);
    expect(await list({ warehouseId: "wh-none" })).toEqual([]);
    const res = await call("GET", `${LOADS}/LOAD-NOPE`);
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("LOAD_NOT_FOUND");
  });
});

describe("mock chuyến xe — đặt xe → bắt đầu xếp → quét đủ → bàn giao", () => {
  it("luồng vui trên xe có đơn sạch: mỗi bước đổi đúng trạng thái; lô HANDED_OVER; ký lại là vô hại", async () => {
    const planned = await readLoad(PLANNED_CLEAN);
    expect(planned.status).toBe("PLANNED");
    const booked = beLoadSchema.parse(
      (
        await post(
          PLANNED_CLEAN,
          "booking",
          bookBody({ waybillNo: "GHN-HAPPY-1", driverName: "Lê Văn Xế" }),
        )
      ).data,
    );
    expect(booked).toMatchObject({
      status: "VEHICLE_BOOKED",
      carrierId: MANUAL_CARRIER,
      vehiclePlate: "51C-1",
      driverName: "Lê Văn Xế",
      waybillNo: "GHN-HAPPY-1",
      carrierConnectionType: "MANUAL",
    });
    expect(booked.bookedAt).toBeDefined();
    // Chưa bắt đầu xếp thì chưa quét được
    const label = booked.shipments[0]?.packages[0]?.labelCode;
    expect(errorCode(await post(PLANNED_CLEAN, "scans", { packageCode: label }))).toBe(
      "INVALID_LOAD_TRANSITION",
    );

    const loading = beLoadSchema.parse((await post(PLANNED_CLEAN, "loading-start")).data);
    expect(loading.status).toBe("LOADING");
    expect(loading.loadingStartedAt).toBeDefined();
    // Đơn sạch: không có cảnh báo bàn giao
    expect(loading.handoverWarnings ?? []).toEqual([]);

    const scanId = crypto.randomUUID();
    const first = beLoadSchema.parse(
      (await post(PLANNED_CLEAN, "scans", { scanId, packageCode: label?.toLowerCase() })).data,
    );
    // Cùng scanId gửi lại → không đổi gì (version giữ nguyên)
    const replay = beLoadSchema.parse(
      (await post(PLANNED_CLEAN, "scans", { scanId, packageCode: label })).data,
    );
    expect(replay.version).toBe(first.version);
    const full = await scanAll(PLANNED_CLEAN);
    expect(full.loadedPackageCount).toBe(full.expectedPackageCount);

    const done = beLoadSchema.parse(
      (await post(PLANNED_CLEAN, "handover", handoverBody(full.version, { signatureRef: "BB-9" })))
        .data,
    );
    expect(done).toMatchObject({
      status: "DISPATCHED",
      carrierRepresentative: "Anh Tài",
      signatureRef: "BB-9",
      driverName: "Lê Văn Xế",
    });
    expect(done.shipments.every((s) => s.status === "HANDED_OVER")).toBe(true);
    const row = beShipmentPageSchema
      .parse((await call("GET", SHIPMENTS, undefined, { search: done.shipments[0]?.code })).data)
      .items.find((s) => s.shipmentId === done.shipments[0]?.shipmentId);
    expect(row).toMatchObject({ status: "HANDED_OVER", loadCode: PLANNED_CLEAN });
    // Ký lại → 200 như cũ (version cũ cũng được); thao tác khác sau đó → INVALID_LOAD_TRANSITION
    expect((await post(PLANNED_CLEAN, "handover", handoverBody(0))).status).toBe(200);
    expect(errorCode(await post(PLANNED_CLEAN, "scans", { packageCode: label }))).toBe(
      "INVALID_LOAD_TRANSITION",
    );
  });

  it("quét sai → mã lỗi BE: không có nhãn 404, kiện của xe khác 409 nêu xe đúng, scanId trùng cho kiện khác 409", async () => {
    await bookAndStart(PLANNED_CLEAN, "GHN-SCAN-1");
    expect((await post(PLANNED_CLEAN, "scans", { packageCode: "NOPE-1" })).status).toBe(404);
    expect(errorCode(await post(PLANNED_CLEAN, "scans", { packageCode: "NOPE-1" }))).toBe(
      "PACKAGE_NOT_FOUND",
    );
    expect(errorCode(await post(PLANNED_CLEAN, "scans", {}))).toBe("VALIDATION_FAILED");
    // Kiện xếp lên xe số 2 của kế hoạch (F002) → 409 PACKAGE_NOT_IN_LOAD kèm vehicleSeq + loadCode
    const other = await readLoad(BOOKED_NO_WAYBILL);
    const foreign = await post(PLANNED_CLEAN, "scans", {
      packageCode: other.shipments[0]?.packages[0]?.labelCode,
    });
    expect(foreign.status).toBe(409);
    expect(errorCode(foreign)).toBe("PACKAGE_NOT_IN_LOAD");
    expect(errorBody(foreign).fieldErrors).toEqual([
      { field: "vehicleSeq", message: "2" },
      { field: "loadCode", message: BOOKED_NO_WAYBILL },
    ]);
    // Kiện đã lên xe khác (xe 1 đã quét kiện của lô A) → 409 PACKAGE_NOT_IN_LOAD nêu xe 1 (kế hoạch xếp nó lên xe 1)
    const onFirstVehicle = (await readLoad(LOADING)).shipments
      .flatMap((s) => s.packages)
      .find((p) => p.loaded);
    expect(
      errorBody(await post(PLANNED_CLEAN, "scans", { packageCode: onFirstVehicle?.labelCode }))
        .fieldErrors?.[1]?.message,
    ).toBe(LOADING);

    const label = (await readLoad(PLANNED_CLEAN)).shipments[0]?.packages[0]?.labelCode;
    const scanId = crypto.randomUUID();
    expect((await post(PLANNED_CLEAN, "scans", { scanId, packageCode: label })).status).toBe(200);
    expect(
      errorCode(
        await post(PLANNED_CLEAN, "scans", { scanId, packageCode: onFirstVehicle?.labelCode }),
      ),
    ).toBe("LOAD_SCAN_ID_CONFLICT");
  });

  it("gỡ kiện đã quét (DELETE scans/{id}) trả chuyến mới; ngoài LOADING → INVALID_LOAD_TRANSITION", async () => {
    expect(errorCode(await call("DELETE", `${LOADS}/${PLANNED_CLEAN}/scans/x`))).toBe(
      "INVALID_LOAD_TRANSITION",
    );
    await bookAndStart(PLANNED_CLEAN, "GHN-UNSCAN-1");
    const full = await scanAll(PLANNED_CLEAN);
    const parcel = full.shipments[0]?.packages[0];
    const after = beLoadSchema.parse(
      (await call("DELETE", `${LOADS}/${PLANNED_CLEAN}/scans/${parcel?.packageId}`)).data,
    );
    expect(after.loadedPackageCount).toBe(full.loadedPackageCount - 1);
    // Thiếu kiện → bàn giao bị từ chối LOAD_NOT_FULLY_LOADED, nêu nhãn còn thiếu
    const refused = await post(PLANNED_CLEAN, "handover", handoverBody(after.version));
    expect(errorCode(refused)).toBe("LOAD_NOT_FULLY_LOADED");
  });

  it("xe huỷ sau khi đã đặt: carrierBookingToCancel; version kiểm trước trạng thái; xe đã đi ký lại vẫn 200", async () => {
    const cancelled = await readLoad(CANCELLED_BOOKED);
    expect(cancelled).toMatchObject({ status: "CANCELLED", carrierBookingToCancel: true });
    expect(cancelled.cancelReason).toBeDefined();
    const body = { carrierRepresentative: "A", vehiclePlate: "51C-1", signed: true };
    expect(
      errorCode(
        await post(CANCELLED_BOOKED, "handover", { ...body, version: cancelled.version - 1 }),
      ),
    ).toBe("OPTIMISTIC_LOCK");
    expect(
      errorCode(await post(CANCELLED_BOOKED, "handover", { ...body, version: cancelled.version })),
    ).toBe("INVALID_LOAD_TRANSITION");
    // Xe chưa xếp (PLANNED) cũng không bàn giao được
    expect(errorCode(await post(PLANNED_CLEAN, "handover", handoverBody(2)))).toBe(
      "INVALID_LOAD_TRANSITION",
    );
    const left = await readLoad(DISPATCHED);
    expect(left.status).toBe("DISPATCHED");
    expect((await post(DISPATCHED, "handover", handoverBody(0))).status).toBe(200);
  });
});

describe("mock đặt xe — hãng nhập tay", () => {
  it("lỗi theo thứ tự BE: thiếu hãng 400, trạng thái, hãng không có 404, hãng ngừng dùng 409, mã vận đơn sai 400, trùng mã 409", async () => {
    expect(errorCode(await post(PLANNED_CLEAN, "booking", {}))).toBe("VALIDATION_FAILED");
    // Xe đang xếp / đã huỷ / đã đi không đặt xe lại được
    for (const id of [LOADING, CANCELLED_BOOKED, DISPATCHED]) {
      expect(errorCode(await post(id, "booking", bookBody()))).toBe("INVALID_LOAD_TRANSITION");
    }
    expect(errorCode(await post(PLANNED_CLEAN, "booking", bookBody({ carrierId: "NOPE" })))).toBe(
      "CARRIER_NOT_FOUND",
    );
    const created = await call("POST", "/fulfillment/carriers", {
      code: "OFFCAR",
      name: "Hãng ngừng dùng",
      status: "INACTIVE",
      connection: { connectionType: "MANUAL" },
    });
    expect(created.status).toBe(201);
    expect(
      errorCode(await post(PLANNED_CLEAN, "booking", bookBody({ carrierId: "carrier-offcar" }))),
    ).toBe("CARRIER_INACTIVE");
    const spaced = await post(PLANNED_CLEAN, "booking", bookBody({ waybillNo: "GHN 1" }));
    expect(spaced.status).toBe(400);
    expect(errorBody(spaced).fieldErrors?.[0]?.field).toBe("waybillNo");
    // BR-23: GHN-250001 đang giữ bởi chuyến F001 của cùng hãng
    const dup = await post(PLANNED_CLEAN, "booking", bookBody({ waybillNo: "GHN-250001" }));
    expect(dup.status).toBe(409);
    expect(errorCode(dup)).toBe("WAYBILL_DUPLICATE");
    expect((await readLoad(PLANNED_CLEAN)).status).toBe("PLANNED");
    // Cùng số nhưng hãng khác thì được (mã vận đơn là của một hãng)
    const carriers = beCarrierPageSchema.parse((await call("GET", "/fulfillment/carriers")).data);
    const webhookCarrier = carriers.items.find(
      (c) => c.connection?.connectionType === "WEBHOOK_LOAD",
    );
    const other = await post(
      PLANNED_CLEAN,
      "booking",
      bookBody({ carrierId: webhookCarrier?.carrierId, waybillNo: "GHN-250001" }),
    );
    expect(other.status).toBe(200);
  });

  it("đặt xe không kèm mã: giữ mã khi vẫn cùng hãng, bỏ mã khi đổi hãng; lịch sử ghi từng lần", async () => {
    const carriers = beCarrierPageSchema.parse((await call("GET", "/fulfillment/carriers")).data);
    const webhookCarrier = carriers.items.find(
      (c) => c.connection?.connectionType === "WEBHOOK_LOAD",
    );
    const first = beLoadSchema.parse(
      (
        await post(
          BOOKED_NO_WAYBILL,
          "booking",
          bookBody({ carrierId: webhookCarrier?.carrierId, waybillNo: "VTP-1" }),
        )
      ).data,
    );
    expect(first.waybillNo).toBe("VTP-1");
    const same = beLoadSchema.parse(
      (
        await post(
          BOOKED_NO_WAYBILL,
          "booking",
          bookBody({ carrierId: webhookCarrier?.carrierId, vehiclePlate: "51C-2" }),
        )
      ).data,
    );
    expect(same).toMatchObject({
      waybillNo: "VTP-1",
      vehiclePlate: "51C-2",
      status: "VEHICLE_BOOKED",
    });
    const switched = beLoadSchema.parse(
      (await post(BOOKED_NO_WAYBILL, "booking", bookBody())).data,
    );
    expect(switched.carrierId).toBe(MANUAL_CARRIER);
    expect(switched.waybillNo).toBeUndefined();
    const history = (await call("GET", `${LOADS}/${BOOKED_NO_WAYBILL}/waybill-history`)).data as {
      oldWaybillNo?: string;
      newWaybillNo?: string;
      source: string;
    }[];
    expect(history).toMatchObject([
      { newWaybillNo: "VTP-1", source: "MANUAL" },
      { oldWaybillNo: "VTP-1", source: "MANUAL" },
    ]);
    expect(history[1]?.newWaybillNo).toBeUndefined();
  });

  it("huỷ đặt xe: về PLANNED, xoá hãng + mã + biển số, giữ lý do; cần lý do; không huỷ được khi đã LOADING; bắt đầu xếp cần đã đặt", async () => {
    expect(errorCode(await post(PLANNED_CLEAN, "loading-start"))).toBe("INVALID_LOAD_TRANSITION");
    // Xe chưa đặt: huỷ đặt xe là vô hại (200 như cũ)
    expect((await post(PLANNED_CLEAN, "booking-cancellation", { reason: "x" })).status).toBe(200);
    expect(errorCode(await post(BOOKED_NO_WAYBILL, "booking-cancellation", {}))).toBe(
      "VALIDATION_FAILED",
    );
    const planned = beLoadSchema.parse(
      (await post(BOOKED_NO_WAYBILL, "booking-cancellation", { reason: "Hãng báo hết xe" })).data,
    );
    expect(planned).toMatchObject({
      status: "PLANNED",
      bookingCancelReason: "Hãng báo hết xe",
    });
    expect(planned.carrierId).toBeUndefined();
    expect(planned.vehiclePlate).toBeUndefined();
    expect(planned.bookedAt).toBeUndefined();
    expect(planned.bookingCancelledAt).toBeDefined();
    expect(errorCode(await post(LOADING, "booking-cancellation", { reason: "x" }))).toBe(
      "INVALID_LOAD_TRANSITION",
    );
  });
});

describe("mock đặt xe qua API hãng (BR-29)", () => {
  const stops = async (id: string) => (await readLoad(id)).shipments.map((s) => s.shipmentId);

  it("không nhận biển số / tài xế / mã vận đơn (400); điểm giao phải đúng các lô trên biên bản", async () => {
    for (const extra of [
      { vehiclePlate: "51C-1" },
      { driverName: "A" },
      { driverPhone: "09" },
      { waybillNo: "X-1" },
    ]) {
      const refused = await post(PLANNED_CLEAN, "booking", {
        carrierId: API_CARRIER,
        stopShipmentIds: await stops(PLANNED_CLEAN),
        ...extra,
      });
      expect(refused.status).toBe(400);
      expect(errorCode(refused)).toBe("VALIDATION_FAILED");
    }
    for (const stopShipmentIds of [
      [],
      ["shp-khac"],
      [...(await stops(PLANNED_CLEAN)), "shp-khac"],
    ]) {
      const refused = await post(PLANNED_CLEAN, "booking", {
        carrierId: API_CARRIER,
        stopShipmentIds,
      });
      expect(errorBody(refused).fieldErrors?.[0]?.field).toBe("stopShipmentIds");
    }
    expect((await readLoad(PLANNED_CLEAN)).status).toBe("PLANNED");
  });

  it("đặt thành công: VEHICLE_BOOKED, mã vận đơn = mã đơn hãng, carrierBooking BOOKED, chưa có biển số / tài xế; đặt lại khi đang đặt → 409", async () => {
    const booked = beLoadSchema.parse(
      (
        await post(PLANNED_CLEAN, "booking", {
          carrierId: API_CARRIER,
          stopShipmentIds: await stops(PLANNED_CLEAN),
        })
      ).data,
    );
    expect(booked).toMatchObject({
      status: "VEHICLE_BOOKED",
      carrierId: API_CARRIER,
      carrierConnectionType: "API_BOOKING",
      carrierBooking: { status: "BOOKED" },
    });
    expect(booked.carrierBooking?.carrierOrderId).toBeDefined();
    expect(booked.waybillNo).toBe(booked.carrierBooking?.carrierOrderId);
    expect(booked.vehiclePlate).toBeUndefined();
    expect(booked.driverName).toBeUndefined();
    // Đặt lại (hãng API lẫn hãng tay) khi đơn ở hãng còn sống → CARRIER_BOOKING_IN_PROGRESS
    expect(
      errorCode(
        await post(PLANNED_CLEAN, "booking", {
          carrierId: API_CARRIER,
          stopShipmentIds: await stops(PLANNED_CLEAN),
        }),
      ),
    ).toBe("CARRIER_BOOKING_IN_PROGRESS");
    expect(errorCode(await post(PLANNED_CLEAN, "booking", bookBody()))).toBe(
      "CARRIER_BOOKING_IN_PROGRESS",
    );
  });

  it("huỷ đặt xe huỷ luôn đơn ở hãng (CANCELLED), xoá mã vận đơn; sau đó đặt tay hãng khác được", async () => {
    await post(PLANNED_CLEAN, "booking", {
      carrierId: API_CARRIER,
      stopShipmentIds: await stops(PLANNED_CLEAN),
    });
    const cancelled = beLoadSchema.parse(
      (await post(PLANNED_CLEAN, "booking-cancellation", { reason: "Đổi kế hoạch" })).data,
    );
    expect(cancelled).toMatchObject({ status: "PLANNED", carrierBooking: { status: "CANCELLED" } });
    expect(cancelled.waybillNo).toBeUndefined();
    expect(cancelled.carrierId).toBeUndefined();
    expect(
      (await post(PLANNED_CLEAN, "booking", bookBody({ waybillNo: "GHN-AFTER-API" }))).status,
    ).toBe(200);
  });
});

describe("mock bắt đầu xếp — cảnh báo bàn giao chỉ trong câu trả lời", () => {
  it("xe có đơn còn đợt thanh toán chưa thu: handoverWarnings trong answer của loading-start, không trong GET", async () => {
    const started = beLoadSchema.parse((await post(BOOKED_NO_WAYBILL, "loading-start")).data);
    expect(started.status).toBe("LOADING");
    expect(started.handoverWarnings).toHaveLength(1);
    expect(started.handoverWarnings?.[0]).toMatchObject({
      reasonCode: "ORDER_BALANCE_NOT_PAID",
      amountDue: 15_000_000,
      currency: "VND",
      deliveryBatchSeq: 1,
    });
    expect((await readLoad(BOOKED_NO_WAYBILL)).handoverWarnings).toBeUndefined();
    // Chỉ xe đã đặt mới bắt đầu xếp được
    expect(errorCode(await post(BOOKED_NO_WAYBILL, "loading-start"))).toBe(
      "INVALID_LOAD_TRANSITION",
    );
  });

  it("xe có đơn chưa tới cửa sổ giao: cảnh báo kèm windowStart", async () => {
    const started = await bookAndStart(PLANNED_WINDOW, "GHN-WIN-1");
    expect(started.handoverWarnings?.[0]).toMatchObject({
      reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
      windowStart: "2026-12-01",
      deliveryBatchSeq: 2,
    });
  });
});

describe("mock bàn giao — mã lỗi theo thứ tự BE", () => {
  it("OPTIMISTIC_LOCK → LOAD_HANDOVER_BLOCKED (details.orders) → LOAD_UNLOAD_PENDING → HANDOVER_NOT_SIGNED → đủ điều kiện", async () => {
    const state = await getDispatchState();
    const loading = await readLoad(LOADING);
    expect(errorCode(await post(LOADING, "handover", handoverBody(loading.version - 1)))).toBe(
      "OPTIMISTIC_LOCK",
    );

    const blocked = await post(LOADING, "handover", handoverBody(loading.version));
    expect(blocked.status).toBe(409);
    expect(errorCode(blocked)).toBe("LOAD_HANDOVER_BLOCKED");
    const orders = errorBody(blocked).details?.orders ?? [];
    expect(orders).toHaveLength(1);
    // amountDue là chuỗi trong details (BE BigDecimal), khác số trong handoverWarnings
    expect(orders[0]).toMatchObject({
      reasonCode: "ORDER_BALANCE_NOT_PAID",
      amountDue: "15000000",
      currency: "VND",
      deliveryBatchSeq: 1,
    });
    expect(orders[0]?.orderNumber).toEqual(expect.any(String));

    // Xử lý đơn bị chặn rồi mới tới lỗi tiếp theo
    for (const shipment of state.shipments.values()) shipment.block = null;
    const pending = await post(LOADING, "handover", handoverBody(loading.version));
    expect(errorCode(pending)).toBe("LOAD_UNLOAD_PENDING");
    const [item] = loading.pendingUnloads ?? [];
    expect(
      beLoadSchema.parse((await post(LOADING, "unloads", { packageCode: item?.labelCode })).data)
        .pendingUnloads,
    ).toEqual([]);
    const current = await readLoad(LOADING);
    const unsigned = await post(
      LOADING,
      "handover",
      handoverBody(current.version, { signed: false }),
    );
    expect(unsigned.status).toBe(400);
    expect(errorCode(unsigned)).toBe("HANDOVER_NOT_SIGNED");
    // Có mã vận đơn, đã ký, nhưng còn kiện chưa quét
    expect(errorCode(await post(LOADING, "handover", handoverBody(current.version)))).toBe(
      "LOAD_NOT_FULLY_LOADED",
    );
    const full = await scanAll(LOADING);
    expect(
      beLoadSchema.parse((await post(LOADING, "handover", handoverBody(full.version))).data).status,
    ).toBe("DISPATCHED");
  });

  it("xe chưa tới cửa sổ giao bị chặn kèm windowStart (BR-04, BR-18)", async () => {
    await bookAndStart(PLANNED_WINDOW, "GHN-WIN-2");
    const full = await scanAll(PLANNED_WINDOW);
    const refused = await post(PLANNED_WINDOW, "handover", handoverBody(full.version));
    expect(errorCode(refused)).toBe("LOAD_HANDOVER_BLOCKED");
    expect(errorBody(refused).details?.orders?.[0]).toMatchObject({
      reasonCode: "DELIVERY_BATCH_WINDOW_NOT_OPEN",
      amountDue: "0",
      deliveryBatchSeq: 2,
      windowStart: "2026-12-01",
    });
    expect((await readLoad(PLANNED_WINDOW)).status).toBe("LOADING");
  });

  it("xe đã đặt nhưng chưa có mã vận đơn: đã ký vẫn LOAD_WAYBILL_MISSING (BR-23), nhập mã rồi ký được", async () => {
    // Đặt tay không kèm mã
    await post(PLANNED_CLEAN, "booking", bookBody());
    await post(PLANNED_CLEAN, "loading-start");
    const full = await scanAll(PLANNED_CLEAN);
    const refused = await post(PLANNED_CLEAN, "handover", handoverBody(full.version));
    expect(refused.status).toBe(409);
    expect(errorCode(refused)).toBe("LOAD_WAYBILL_MISSING");
    const withWaybill = beLoadSchema.parse(
      (await call("PUT", `${LOADS}/${PLANNED_CLEAN}/waybill`, { waybillNo: "GHN-LATE-1" })).data,
    );
    expect(
      beLoadSchema.parse(
        (await post(PLANNED_CLEAN, "handover", handoverBody(withWaybill.version))).data,
      ).status,
    ).toBe("DISPATCHED");
  });
});

describe("mock dỡ kiện của đơn đã huỷ", () => {
  it("dỡ sai kiện → PACKAGE_NOT_IN_LOAD, không có nhãn → 404; dỡ đúng bằng nhãn viết thường; dỡ lại → PACKAGE_NOT_IN_LOAD", async () => {
    const [pending] = (await readLoad(LOADING)).pendingUnloads ?? [];
    expect(pending?.labelCode).toBeDefined();
    const other = (await readLoad(LOADING)).shipments[0]?.packages[0];
    expect(errorCode(await post(LOADING, "unloads", { packageCode: other?.labelCode }))).toBe(
      "PACKAGE_NOT_IN_LOAD",
    );
    expect(errorCode(await post(LOADING, "unloads", { packageCode: "NOPE-1" }))).toBe(
      "PACKAGE_NOT_FOUND",
    );
    expect(errorCode(await post(LOADING, "unloads", {}))).toBe("VALIDATION_FAILED");
    const unloaded = beLoadSchema.parse(
      (await post(LOADING, "unloads", { packageCode: pending?.labelCode.toLowerCase() })).data,
    );
    expect(unloaded.pendingUnloads).toEqual([]);
    expect(errorCode(await post(LOADING, "unloads", { packageCode: pending?.labelCode }))).toBe(
      "PACKAGE_NOT_IN_LOAD",
    );
  });
});

describe("mock huỷ có kiểm soát một xe (SCRUM-474 UNLOAD-DESIGN)", () => {
  const cancelBody = { reasonCode: "XE_HONG", note: "Gãy trục sau" };
  const scannedLabels = async (id: string) =>
    (await readLoad(id)).shipments.flatMap((s) => s.packages).filter((p) => p.loaded);

  it("xe đang xếp huỷ ngay kèm mã + ghi chú; kiện đã quét bị khoá (pendingUnloads); chuyến thay thế PLANNED cùng kế hoạch / xe / kiện", async () => {
    const before = await readLoad(LOADING);
    const onBoard = (await scannedLabels(LOADING)).map((p) => p.labelCode);
    const result = beControlledCancelSchema.parse(
      (await post(LOADING, "controlled-cancellation", cancelBody)).data,
    );
    expect(result.cancelled).toMatchObject({
      loadId: LOADING,
      status: "CANCELLED",
      cancelReasonCode: "XE_HONG",
      cancelReason: "Gãy trục sau",
      carrierBookingToCancel: true,
    });
    // Mọi kiện đã lên xe (và kiện của đơn đã huỷ đang chờ dỡ) bị khoá tới khi quét dỡ
    const pending = result.cancelled.pendingUnloads ?? [];
    expect(pending.map((u) => u.labelCode)).toEqual(
      expect.arrayContaining([
        ...onBoard,
        ...(before.pendingUnloads ?? []).map((u) => u.labelCode),
      ]),
    );
    expect(pending.filter((u) => u.reasonCode === "XE_HONG").length).toBe(onBoard.length);
    expect(result.replacement).toMatchObject({
      status: "PLANNED",
      loadPlanId: before.loadPlanId,
      vehicleSeq: before.vehicleSeq,
    });
    expect(result.replacement?.loadedPackageCount).toBe(0);
    // Chuyến thay thế không thừa hưởng hãng / mã vận đơn của xe cũ
    expect(result.replacement?.waybillNo).toBeUndefined();
    expect(result.replacement?.carrierId).toBeUndefined();
    expect(result.cancelled.replacementLoadId).toBe(result.replacement?.loadId);
    expect(result.replacement?.shipments.map((s) => s.code)).toEqual(
      before.shipments.map((s) => s.code),
    );
    expect((await readLoad(LOADING)).status).toBe("CANCELLED");
    expect((await readLoad(result.replacement?.loadId ?? "")).status).toBe("PLANNED");
    // Gọi lại → trả như cũ, không tạo thêm chuyến thay thế
    const again = beControlledCancelSchema.parse(
      (await post(LOADING, "controlled-cancellation", cancelBody)).data,
    );
    expect(again.replacement?.loadId).toBe(result.replacement?.loadId);
  });

  it("quét dỡ trên xe đã huỷ: từng kiện; xác nhận không quét theo packageId; sau kiện cuối chuyến giữ nguyên lý do huỷ", async () => {
    const result = beControlledCancelSchema.parse(
      (await post(LOADING, "controlled-cancellation", cancelBody)).data,
    );
    const pending = result.cancelled.pendingUnloads ?? [];
    expect(pending.length).toBeGreaterThan(1);
    const [first, ...rest] = pending;
    const scanned = beLoadSchema.parse(
      (await post(LOADING, "unloads", { packageCode: first?.labelCode })).data,
    );
    expect(scanned.pendingUnloads).toHaveLength(pending.length - 1);
    let latest = scanned;
    for (const item of rest) {
      latest = beLoadSchema.parse(
        (await post(LOADING, "unload-overrides", { packageId: item.packageId, note: "Nhãn hỏng" }))
          .data,
      );
    }
    expect(latest.pendingUnloads).toEqual([]);
    expect(latest).toMatchObject({
      status: "CANCELLED",
      cancelReasonCode: "XE_HONG",
      cancelReason: "Gãy trục sau",
    });
    expect(
      errorCode(await post(LOADING, "unload-overrides", { packageId: first?.packageId })),
    ).toBe("PACKAGE_NOT_IN_LOAD");
    expect(errorCode(await post(LOADING, "unload-overrides", {}))).toBe("VALIDATION_FAILED");
  });

  it("đúng luật BE: cần mã lý do (một trong bốn) và ghi chú; chỉ xe đang xếp (INVALID_LOAD_TRANSITION)", async () => {
    for (const bad of [
      { note: "x" },
      { reasonCode: "BROKEN", note: "x" },
      { reasonCode: "KHAC" },
      { reasonCode: "KHAC", note: "  " },
    ]) {
      expect(errorCode(await post(LOADING, "controlled-cancellation", bad))).toBe(
        "VALIDATION_FAILED",
      );
    }
    for (const id of [BOOKED_NO_WAYBILL, PLANNED_CLEAN, DISPATCHED, CANCELLED_BOOKED]) {
      expect(errorCode(await post(id, "controlled-cancellation", cancelBody))).toBe(
        "INVALID_LOAD_TRANSITION",
      );
    }
    expect(errorCode(await post("LD-NOPE", "controlled-cancellation", cancelBody))).toBe(
      "LOAD_NOT_FOUND",
    );
    // Mỗi mã lý do trong bộ bốn đều được nhận (xe chỉ huỷ một lần, các lần sau trả như cũ)
    for (const reasonCode of ["XE_HONG", "SAI_XE", "KIEN_KHONG_VUA", "KHAC"]) {
      expect(
        (await post(LOADING, "controlled-cancellation", { reasonCode, note: "x" })).status,
      ).toBe(200);
    }
    expect((await readLoad(LOADING)).cancelReasonCode).toBe("XE_HONG");
  });
});

describe("mock bỏ xe chưa xếp khỏi kế hoạch (SCRUM-474 UNLOAD-DROP)", () => {
  const dropBody = { reasonCode: "KHAC", note: "Không còn xe nào để chở" };

  /** Hai xe còn lại của kế hoạch 1 (đang xếp, đã đặt) đã rời kho: chỉ còn xe số 3 chưa xếp. */
  async function otherVehiclesLeft() {
    const state = await getDispatchState();
    for (const id of [LOADING, BOOKED_NO_WAYBILL]) {
      const other = state.loads.get(id);
      if (other) other.status = "DISPATCHED";
    }
  }

  it("đúng luật BE: cần mã lý do + ghi chú (400); còn xe khác chưa đi → 409 LOAD_PLAN_OTHER_VEHICLES_NOT_LEFT; xe đã đặt / đã đi → INVALID_LOAD_TRANSITION", async () => {
    for (const bad of [
      { note: "x" },
      { reasonCode: "BROKEN", note: "x" },
      { reasonCode: "KHAC" },
      { reasonCode: "KHAC", note: "  " },
    ]) {
      expect(errorCode(await post(PLANNED_CLEAN, "plan-removal", bad))).toBe("VALIDATION_FAILED");
    }
    // Xe số 1 còn đang xếp, xe số 2 mới đặt: chưa bỏ xe số 3 được
    expect(errorCode(await post(PLANNED_CLEAN, "plan-removal", dropBody))).toBe(
      "LOAD_PLAN_OTHER_VEHICLES_NOT_LEFT",
    );
    for (const id of [BOOKED_NO_WAYBILL, LOADING, DISPATCHED]) {
      expect(errorCode(await post(id, "plan-removal", dropBody))).toBe("INVALID_LOAD_TRANSITION");
    }
    expect(errorCode(await post("LD-NOPE", "plan-removal", dropBody))).toBe("LOAD_NOT_FOUND");
    expect((await readLoad(PLANNED_CLEAN)).status).toBe("PLANNED");
  });

  it("mọi xe khác đã đi: xe PLANNED huỷ ngay kèm mã + ghi chú, bỏ khỏi biên bản, không kiện nào bị khoá; làm lại → trả như cũ", async () => {
    await otherVehiclesLeft();
    const dropped = beLoadSchema.parse((await post(PLANNED_CLEAN, "plan-removal", dropBody)).data);
    expect(dropped).toMatchObject({
      loadId: PLANNED_CLEAN,
      status: "CANCELLED",
      cancelReasonCode: "KHAC",
      cancelReason: "Không còn xe nào để chở",
    });
    expect(dropped.shipments).toEqual([]);
    expect(dropped.pendingUnloads ?? []).toEqual([]);
    const again = beLoadSchema.parse((await post(PLANNED_CLEAN, "plan-removal", dropBody)).data);
    expect(again).toMatchObject({ status: "CANCELLED", cancelReasonCode: "KHAC" });
    expect(again.version).toBe(dropped.version);
  });

  it("kế hoạch thứ hai: xe duy nhất còn lại đã đi nên xe chưa xếp bỏ được ngay", async () => {
    const dropped = beLoadSchema.parse((await post(PLANNED_WINDOW, "plan-removal", dropBody)).data);
    expect(dropped.status).toBe("CANCELLED");
  });
});

describe("mock kết quả giao (fulfillment-delivery-outcomes)", () => {
  async function shipmentOn(status: string) {
    const rows = beShipmentPageSchema.parse(
      (await call("GET", SHIPMENTS, undefined, { size: "200", status })).data,
    ).items;
    return rows.find((s) => s.loadCode === DISPATCHED);
  }
  const outcome = (id: string, body: Record<string, unknown>) =>
    call("POST", `${SHIPMENTS}/${id}/delivery-outcome`, body);

  it("nhân viên kho không ghi kết quả (403); quản lý kho chỉ ghi hoàn hàng; điều phối ghi đã giao / thất bại", async () => {
    const handed = await shipmentOn("HANDED_OVER");
    const failed = await shipmentOn("DELIVERY_FAILED");
    actAs(WAREHOUSE_STAFF);
    expect((await outcome(handed?.shipmentId ?? "", { outcome: "DELIVERED" })).status).toBe(403);
    actAs(WAREHOUSE_MANAGER);
    expect((await outcome(handed?.shipmentId ?? "", { outcome: "DELIVERED" })).status).toBe(403);
    expect(
      beShipmentSchema.parse(
        (await outcome(failed?.shipmentId ?? "", { outcome: "RETURNED" })).data,
      ).shipment.status,
    ).toBe("RETURNED");
    actAs(ORDER_COORDINATOR);
    expect(errorCode(await outcome(handed?.shipmentId ?? "", { outcome: "NOPE" }))).toBe(
      "VALIDATION_FAILED",
    );
    expect(errorCode(await outcome(handed?.shipmentId ?? "", { outcome: "DELIVERY_FAILED" }))).toBe(
      "VALIDATION_FAILED",
    );
    expect(
      errorCode(
        await outcome(handed?.shipmentId ?? "", {
          outcome: "DELIVERY_FAILED",
          failureReason: "OTHER",
        }),
      ),
    ).toBe("VALIDATION_FAILED");
    expect(
      beShipmentSchema.parse(
        (await outcome(handed?.shipmentId ?? "", { outcome: "DELIVERED" })).data,
      ).shipment.status,
    ).toBe("DELIVERED");
    // Đã giao rồi không quay lại thất bại
    expect(
      errorCode(
        await outcome(handed?.shipmentId ?? "", {
          outcome: "DELIVERY_FAILED",
          failureReason: "REFUSED",
        }),
      ),
    ).toBe("SHIPMENT_STATE_CONFLICT");
  });
});

describe("mock mã quyền BE — mỗi route một mã", () => {
  const dispatchRoutes: [string, string, unknown][] = [
    ["POST", `${LOADS}/${PLANNED_CLEAN}/booking`, bookBody()],
    ["POST", `${LOADS}/${PLANNED_CLEAN}/booking-cancellation`, { reason: "x" }],
    ["POST", `${LOADS}/${PLANNED_CLEAN}/loading-start`, {}],
    ["POST", `${LOADS}/${PLANNED_CLEAN}/scans`, { packageCode: "PKG-1" }],
    ["DELETE", `${LOADS}/${PLANNED_CLEAN}/scans/x`, undefined],
    ["POST", `${LOADS}/${PLANNED_CLEAN}/handover`, handoverBody(2)],
    ["POST", `${LOADS}/${PLANNED_CLEAN}/unloads`, { packageCode: "PKG-1" }],
    ["PUT", `${LOADS}/${PLANNED_CLEAN}/waybill`, { waybillNo: "X-1" }],
  ];

  it("fulfillment-dispatch:UPDATE: điều phối đơn / người chỉ xem / chỉ có quyền file → 403 mọi route đặt xe, quét, bàn giao, nhập mã", async () => {
    for (const grants of [ORDER_COORDINATOR, [], [IMPORT.read, IMPORT.create, CONTROLLED]]) {
      actAs(grants);
      for (const [method, url, data] of dispatchRoutes) {
        expect((await call(method, url, data)).status, `${method} ${url}`).toBe(403);
      }
    }
    expect((await readLoad(PLANNED_CLEAN)).status).toBe("PLANNED");
    // Có quyền thì qua cổng (có thể bị luật nghiệp vụ từ chối nhưng không phải 403)
    actAs([DISPATCH]);
    for (const [method, url, data] of dispatchRoutes) {
      expect((await call(method, url, data)).status, `${method} ${url}`).not.toBe(403);
    }
  });

  it("fulfillment-controlled-cancellations:UPDATE: nhân viên kho / điều phối → 403 ba route; chỉ cần mã này, không cần dispatch", async () => {
    const routes: [string, unknown][] = [
      ["controlled-cancellation", { reasonCode: "XE_HONG", note: "x" }],
      ["plan-removal", { reasonCode: "KHAC", note: "x" }],
      ["unload-overrides", { packageId: "pkg-x" }],
    ];
    for (const grants of [WAREHOUSE_STAFF, ORDER_COORDINATOR, []]) {
      actAs(grants);
      for (const [path, data] of routes) {
        expect((await post(LOADING, path, data)).status, path).toBe(403);
      }
    }
    expect((await readLoad(LOADING)).status).toBe("LOADING");
    actAs([CONTROLLED]);
    for (const [path, data] of routes) {
      expect((await post(LOADING, path, data)).status, path).not.toBe(403);
    }
  });

  it("fulfillment-waybill-imports: READ cho file mẫu, CREATE cho xem trước + nhập file; hai mã độc lập", async () => {
    const form = () => {
      const data = new FormData();
      data.append("file", new File(["a\nb"], "x.csv", { type: "text/csv" }));
      return data;
    };
    const imports = "/fulfillment/waybill-imports";
    actAs([IMPORT.read]);
    expect((await call("GET", `${imports}/template`)).status).toBe(200);
    expect((await call("POST", `${imports}/preview`, form())).status).toBe(403);
    expect((await call("POST", imports, form())).status).toBe(403);
    actAs([IMPORT.create]);
    expect((await call("GET", `${imports}/template`)).status).toBe(403);
    expect((await call("POST", `${imports}/preview`, form())).status).not.toBe(403);
    expect((await call("POST", imports, form())).status).not.toBe(403);
    actAs([DISPATCH]);
    expect((await call("GET", `${imports}/template`)).status).toBe(403);
  });
});
