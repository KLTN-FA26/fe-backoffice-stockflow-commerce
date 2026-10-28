/**
 * Contract mock giao hàng cho hãng (BE PR #137): chạy handler mock thật qua `resolveMockRoute` rồi parse
 * bằng schema FE — đảm bảo màn demo và hợp đồng FE không lệch nhau, và mock giữ đúng mã lỗi / mã quyền BE.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  FULFILLMENT_DISPATCH_PERMISSIONS,
  FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS,
} from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { getDispatchState, resetDispatchMockStore } from "@/lib/api/mock-dispatch-store";
import { registerDispatchMockRoutes } from "@/lib/api/mock-routes-dispatch";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import { beLoadPageSchema, beLoadSchema, beManifestSchema } from "./load-schemas";
import { beCarrierPageSchema, beShipmentPageSchema, beShipmentSchema } from "./schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";
import type { Load, ShipmentRow } from "./types";

registerDispatchMockRoutes();

async function call(method: string, url: string, data?: unknown, params?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const config = {
    url,
    data: data === undefined ? undefined : JSON.stringify(data),
    params,
    _mockParams: route.params,
  };
  return route.handler(config as AxiosRequestConfig);
}

/**
 * Bộ quyền theo seed BE PR #148 (mock backend cổng theo mã quyền, lấy từ `MOCK_USER_GRANTS[userId]`):
 * nhân viên kho xếp xe / bàn giao, quản lý kho thêm huỷ chuyến + ghi hàng hoàn, điều phối ghi kết quả giao.
 */
const WAREHOUSE_STAFF = [...Object.values(FULFILLMENT_DISPATCH_PERMISSIONS)];
const WAREHOUSE_MANAGER = [
  ...WAREHOUSE_STAFF,
  FULFILLMENT_LOAD_CANCELLATION_PERMISSIONS.update,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.update,
];
const ORDER_COORDINATOR = [...Object.values(FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS)];

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
const errorCode = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;

async function shipments(params: Record<string, string> = {}): Promise<ShipmentRow[]> {
  const res = await call("GET", SHIPMENTS, undefined, { size: "200", ...params });
  return beShipmentPageSchema.parse(res.data).items;
}

async function readLoad(id: string): Promise<Load> {
  return beLoadSchema.parse((await call("GET", `${LOADS}/${id}`)).data);
}

/** Lô chờ xuất không bị chặn bàn giao và chưa lên chuyến (đọc thẳng store mock để biết lô nào bị chặn). */
async function cleanReady(count = 1): Promise<ShipmentRow[]> {
  const { shipments: all } = await getDispatchState();
  const ids = new Set(
    [...all.values()]
      .filter((s) => !s.block && !s.loadId && s.status === "READY_TO_DISPATCH")
      .map((s) => s.shipmentId),
  );
  return (await shipments({ status: "READY_TO_DISPATCH" }))
    .filter((s) => ids.has(s.shipmentId))
    .slice(0, count);
}

async function blockedReady(): Promise<ShipmentRow[]> {
  const { shipments: all } = await getDispatchState();
  const ids = new Set(
    [...all.values()].filter((s) => s.block && !s.loadId).map((s) => s.shipmentId),
  );
  return (await shipments({ status: "READY_TO_DISPATCH" })).filter((s) => ids.has(s.shipmentId));
}

async function openAndScanAll(load: Load): Promise<Load> {
  let latest = load;
  for (const shipment of load.shipments) {
    for (const parcel of shipment.packages) {
      latest = beLoadSchema.parse(
        (await call("POST", `${LOADS}/${load.loadId}/scans`, { packageCode: parcel.labelCode }))
          .data,
      );
    }
  }
  return latest;
}

beforeEach(() => {
  resetDispatchMockStore();
  actAs(WAREHOUSE_MANAGER);
});

describe("mock giao hàng cho hãng khớp schema FE", () => {
  it("hãng, lô giao, chuyến, biên bản đều parse được và phủ đủ tình huống", async () => {
    const carriers = beCarrierPageSchema.parse((await call("GET", "/fulfillment/carriers")).data);
    expect(carriers.items.length).toBeGreaterThan(0);
    const all = await shipments();
    // CANCELLED: lô của đơn đã huỷ khi xe nguyên xe đang xếp (kiện cần dỡ)
    expect(new Set(all.map((s) => s.status))).toEqual(
      new Set(["READY_TO_DISPATCH", "HANDED_OVER", "DELIVERY_FAILED", "CANCELLED"]),
    );
    const loads = beLoadPageSchema.parse(
      (await call("GET", LOADS, undefined, { size: "50" })).data,
    );
    expect(new Set(loads.items.map((l) => l.status))).toEqual(
      new Set(["PLANNED", "VEHICLE_BOOKED", "LOADING", "DISPATCHED", "CANCELLED"]),
    );
    expect(new Set(loads.items.map((l) => l.mode))).toEqual(new Set(["PARCEL", "FULL_TRUCKLOAD"]));
    const loading = loads.items.find((l) => l.status === "LOADING");
    const manifest = beManifestSchema.parse(
      (await call("GET", `${LOADS}/${loading?.loadId}/manifest`)).data,
    );
    expect(manifest.shipments.length).toBeGreaterThan(0);
    const detail = beShipmentSchema.parse(
      (await call("GET", `${SHIPMENTS}/${all[0]?.shipmentId}`)).data,
    );
    expect(detail.timeline.length).toBeGreaterThan(0);
  });

  it("danh sách lô lọc theo trạng thái / kho / hãng / mã; chuyến không tồn tại → 404 LOAD_NOT_FOUND", async () => {
    const ready = await shipments({ status: "READY_TO_DISPATCH" });
    expect(ready.every((s) => s.status === "READY_TO_DISPATCH")).toBe(true);
    const byCode = await shipments({ search: ready[0]?.code.toLowerCase() ?? "" });
    expect(byCode.map((s) => s.code)).toContain(ready[0]?.code);
    expect((await shipments({ warehouseId: "wh-none" })).length).toBe(0);
    const res = await call("GET", `${LOADS}/LOAD-NOPE`);
    expect(res.status).toBe(404);
    expect(errorCode(res)).toBe("LOAD_NOT_FOUND");
  });
});

describe("mock chuyến xe — mở, quét, bàn giao", () => {
  it("mở chuyến idempotent theo requestId; quét sai → mã lỗi BE; quét đủ rồi bàn giao", async () => {
    const [shipment] = await cleanReady();
    if (!shipment) throw new Error("seed thiếu lô chờ xuất sạch");
    const body = {
      requestId: crypto.randomUUID(),
      warehouseId: shipment.warehouseId,
      carrierId: "CAR-GHN",
      shipmentIds: [shipment.shipmentId],
    };
    const first = await call("POST", LOADS, body);
    expect(first.status).toBe(201);
    const load = beLoadSchema.parse(first.data);
    expect(load.status).toBe("LOADING");
    // Gửi lại cùng requestId → đúng chuyến đã mở, không mở thêm
    expect(beLoadSchema.parse((await call("POST", LOADS, body)).data).loadId).toBe(load.loadId);
    const base = `${LOADS}/${load.loadId}`;

    expect((await call("POST", `${base}/scans`, { packageCode: "NOPE-1" })).status).toBe(404);
    // Kiện của lô chờ khác (không có trong biên bản) → PACKAGE_NOT_IN_LOAD
    const other = (await shipments({ status: "READY_TO_DISPATCH" })).find(
      (s) => s.shipmentId !== shipment.shipmentId && !s.loadId,
    );
    const otherDetail = beShipmentSchema.parse(
      (await call("GET", `${SHIPMENTS}/${other?.shipmentId}`)).data,
    );
    const foreign = await call("POST", `${base}/scans`, {
      packageCode: otherDetail.packages[0]?.labelCode,
    });
    expect(errorCode(foreign)).toBe("PACKAGE_NOT_IN_LOAD");
    // Kiện đã lên xe chuyến khác → PACKAGE_ALREADY_LOADED
    const seeded = beLoadPageSchema
      .parse((await call("GET", LOADS, undefined, { status: "LOADING" })).data)
      .items.find((l) => l.loadId !== load.loadId && l.packageCount > 0);
    const seededLoad = await readLoad(seeded?.loadId ?? "");
    const loadedElsewhere = seededLoad.shipments.flatMap((s) => s.packages).find((p) => p.loaded);
    const already = await call("POST", `${base}/scans`, {
      packageCode: loadedElsewhere?.labelCode,
    });
    expect(errorCode(already)).toBe("PACKAGE_ALREADY_LOADED");

    // Chưa đủ kiện → LOAD_NOT_FULLY_LOADED (nếu lô có nhiều kiện) hoặc đủ thì đi tiếp
    const firstParcel = load.shipments[0]?.packages[0];
    const scanId = crypto.randomUUID();
    const scanned = beLoadSchema.parse(
      (
        await call("POST", `${base}/scans`, {
          scanId,
          packageCode: firstParcel?.labelCode.toLowerCase(),
        })
      ).data,
    );
    // Cùng scanId gửi lại → 200 không đổi gì (version giữ nguyên); scanId đó cho kiện khác → 409
    const replay = beLoadSchema.parse(
      (await call("POST", `${base}/scans`, { scanId, packageCode: firstParcel?.labelCode })).data,
    );
    expect(replay.version).toBe(scanned.version);
    const secondParcel = load.shipments[0]?.packages[1];
    if (secondParcel) {
      const early = await call("POST", `${base}/handover`, {
        version: scanned.version,
        carrierRepresentative: "A",
        vehiclePlate: "51C-1",
        signed: true,
      });
      expect(errorCode(early)).toBe("LOAD_NOT_FULLY_LOADED");
      const conflict = await call("POST", `${base}/scans`, {
        scanId,
        packageCode: secondParcel.labelCode,
      });
      expect(errorCode(conflict)).toBe("LOAD_SCAN_ID_CONFLICT");
    }
    const full = await openAndScanAll(scanned);

    const stale = await call("POST", `${base}/handover`, {
      version: full.version - 1,
      carrierRepresentative: "A",
      vehiclePlate: "51C-1",
      signed: true,
    });
    expect(errorCode(stale)).toBe("OPTIMISTIC_LOCK");
    const unsigned = await call("POST", `${base}/handover`, {
      version: full.version,
      carrierRepresentative: "A",
      signed: false,
    });
    expect(unsigned.status).toBe(400);
    expect(errorCode(unsigned)).toBe("HANDOVER_NOT_SIGNED");

    const done = beLoadSchema.parse(
      (
        await call("POST", `${base}/handover`, {
          version: full.version,
          carrierRepresentative: "Anh Tài",
          vehiclePlate: "51C-1",
          signed: true,
          signatureRef: "BB-9",
        })
      ).data,
    );
    expect(done.status).toBe("DISPATCHED");
    expect(done.shipments.every((s) => s.status === "HANDED_OVER")).toBe(true);
    expect(done.carrierRepresentative).toBe("Anh Tài");
    // Ký lại → 200 như cũ; thao tác khác sau đó → INVALID_LOAD_TRANSITION
    expect(
      (
        await call("POST", `${base}/handover`, {
          version: 0,
          carrierRepresentative: "B",
          signed: true,
        })
      ).status,
    ).toBe(200);
    expect(
      errorCode(await call("POST", `${base}/scans`, { packageCode: firstParcel?.labelCode })),
    ).toBe("INVALID_LOAD_TRANSITION");
  });

  it("lô bị chặn (chưa thanh toán / đang giữ / nhãn lệch) → lỗi nêu tên lô; bỏ lô khỏi chuyến thì bàn giao được", async () => {
    const codes = new Map<string, string>();
    for (const row of await blockedReady()) {
      const loadRes = await call("POST", LOADS, {
        requestId: crypto.randomUUID(),
        warehouseId: row.warehouseId,
        carrierId: "CAR-GHN",
        shipmentIds: [row.shipmentId],
      });
      const load = beLoadSchema.parse(loadRes.data);
      const full = await openAndScanAll(load);
      const refused = await call("POST", `${LOADS}/${load.loadId}/handover`, {
        version: full.version,
        carrierRepresentative: "A",
        vehiclePlate: "51C-1",
        signed: true,
      });
      expect(refused.status).toBe(409);
      const data = refused.data as { fieldErrors: { field: string; message: string }[] };
      expect(data.fieldErrors).toContainEqual({ field: "shipmentCode", message: row.code });
      codes.set(row.code, errorCode(refused) ?? "");
      // Bỏ lô chặn → chuyến rỗng
      const removed = beLoadSchema.parse(
        (await call("DELETE", `${LOADS}/${load.loadId}/shipments/${row.shipmentId}`)).data,
      );
      expect(removed.shipments).toHaveLength(0);
      expect(
        errorCode(
          await call("POST", `${LOADS}/${load.loadId}/handover`, {
            version: removed.version,
            carrierRepresentative: "A",
            vehiclePlate: "51C-1",
            signed: true,
          }),
        ),
      ).toBe("LOAD_EMPTY");
    }
    expect([...codes.values()].sort()).toEqual([
      "LABEL_OUTDATED",
      "ORDER_BALANCE_NOT_PAID",
      "ORDER_INVALID_TRANSITION",
    ]);
  });

  it("huỷ chuyến: chỉ quản lý kho; lô về danh sách chờ xuất, kiện gỡ khỏi xe", async () => {
    const loading = beLoadPageSchema.parse(
      (await call("GET", LOADS, undefined, { status: "LOADING" })).data,
    ).items[0];
    const base = `${LOADS}/${loading?.loadId}`;
    actAs(WAREHOUSE_STAFF);
    expect((await call("POST", `${base}/cancellation`, { reason: "x" })).status).toBe(403);
    actAs(WAREHOUSE_MANAGER);
    const before = await readLoad(loading?.loadId ?? "");
    const cancelled = beLoadSchema.parse(
      (await call("POST", `${base}/cancellation`, { reason: "Hãng huỷ" })).data,
    );
    expect(cancelled.status).toBe("CANCELLED");
    const freed = await shipments({ status: "READY_TO_DISPATCH" });
    expect(
      freed
        .filter((s) => before.shipments.some((b) => b.shipmentId === s.shipmentId))
        .every((s) => !s.loadId),
    ).toBe(true);
  });
});

describe("mock bàn giao — kiểm version trước trạng thái (như BE)", () => {
  it("chuyến đã huỷ: version cũ → OPTIMISTIC_LOCK; version hiện tại → INVALID_LOAD_TRANSITION", async () => {
    const loading = beLoadPageSchema.parse(
      (await call("GET", LOADS, undefined, { status: "LOADING" })).data,
    ).items[0];
    const base = `${LOADS}/${loading?.loadId}`;
    const cancelled = beLoadSchema.parse(
      (await call("POST", `${base}/cancellation`, { reason: "x" })).data,
    );
    const body = { carrierRepresentative: "A", vehiclePlate: "51C-1", signed: true };
    expect(
      errorCode(
        await call("POST", `${base}/handover`, { ...body, version: cancelled.version - 1 }),
      ),
    ).toBe("OPTIMISTIC_LOCK");
    expect(
      errorCode(await call("POST", `${base}/handover`, { ...body, version: cancelled.version })),
    ).toBe("INVALID_LOAD_TRANSITION");
  });
});

describe("mock mã quyền BE — lên xe cần fulfillment-dispatch, kết quả giao cần fulfillment-delivery-outcomes", () => {
  it("điều phối đơn không mở chuyến / quét được (403); nhân viên kho không ghi kết quả giao (403)", async () => {
    const [shipment] = await cleanReady();
    actAs(ORDER_COORDINATOR);
    const open = await call("POST", LOADS, {
      requestId: crypto.randomUUID(),
      warehouseId: shipment?.warehouseId,
      carrierId: "CAR-GHN",
    });
    expect(open.status).toBe(403);
    const handed = (await shipments({ status: "HANDED_OVER" }))[0];
    actAs(WAREHOUSE_STAFF);
    const denied = await call("POST", `${SHIPMENTS}/${handed?.shipmentId}/delivery-outcome`, {
      outcome: "DELIVERED",
    });
    expect(denied.status).toBe(403);
  });

  it("kết quả giao: HANDED_OVER → thất bại cần lý do ('Khác' cần ghi chú) → giao lại → cuối; quản lý kho chỉ ghi hoàn hàng", async () => {
    const handed = (await shipments({ status: "HANDED_OVER" }))[0];
    const url = `${SHIPMENTS}/${handed?.shipmentId}/delivery-outcome`;
    actAs(ORDER_COORDINATOR);
    expect((await call("POST", url, { outcome: "RETURNED" })).data).toMatchObject({
      errorCode: "SHIPMENT_STATE_CONFLICT",
    });
    expect((await call("POST", url, { outcome: "DELIVERY_FAILED" })).status).toBe(400);
    expect(
      (await call("POST", url, { outcome: "DELIVERY_FAILED", failureReason: "OTHER" })).status,
    ).toBe(400);
    const failed = beShipmentSchema.parse(
      (
        await call("POST", url, {
          outcome: "DELIVERY_FAILED",
          failureReason: "OTHER",
          note: "Khách chuyển nhà",
        })
      ).data,
    );
    expect(failed.shipment.status).toBe("DELIVERY_FAILED");
    expect(failed.failureNote).toBe("Khách chuyển nhà");
    expect(failed.timeline.at(-1)?.status).toBe("DELIVERY_FAILED");
    actAs(WAREHOUSE_MANAGER);
    expect((await call("POST", url, { outcome: "DELIVERED" })).status).toBe(403);
    expect(
      beShipmentSchema.parse((await call("POST", url, { outcome: "RETURNED" })).data).shipment
        .status,
    ).toBe("RETURNED");
    actAs(ORDER_COORDINATOR);
    expect((await call("POST", url, { outcome: "DELIVERED" })).data).toMatchObject({
      errorCode: "SHIPMENT_STATE_CONFLICT",
    });
  });

  it("chọn hãng: chỉ lô chờ xuất chưa lên chuyến; bỏ hãng bằng null", async () => {
    const [shipment] = await cleanReady();
    const url = `${SHIPMENTS}/${shipment?.shipmentId}/carrier`;
    const set = beShipmentSchema.parse((await call("PUT", url, { carrierId: "CAR-VTP" })).data);
    expect(set.shipment.carrierName).toBeTruthy();
    expect(
      beShipmentSchema.parse((await call("PUT", url, { carrierId: null })).data).shipment.carrierId,
    ).toBeUndefined();
    expect((await call("PUT", url, { carrierId: "CAR-NOPE" })).status).toBe(404);
    const onLoad = (await shipments({ status: "READY_TO_DISPATCH" })).find((s) => s.loadId);
    const blocked = await call("PUT", `${SHIPMENTS}/${onLoad?.shipmentId}/carrier`, {
      carrierId: "CAR-VTP",
    });
    expect(errorCode(blocked)).toBe("SHIPMENT_ON_ANOTHER_LOAD");
  });
});

/* ── Chuyến nguyên xe (BE PR #162): seed một kế hoạch bốn xe ─────────────────────────────────── */

const FTL_PLANNED = "LD-2026-F003";
const FTL_BOOKED = "LD-2026-F002";
const FTL_LOADING = "LD-2026-F001";
const FTL_CANCELLED = "LD-2026-F004";
const body = (extra: Record<string, unknown> = {}) => ({
  carrierId: "CAR-GHN",
  vehiclePlate: "51C-1",
  ...extra,
});
const post = (id: string, path: string, data?: unknown) =>
  call("POST", `${LOADS}/${id}/${path}`, data);

describe("mock chuyến nguyên xe — đặt xe, bắt đầu xếp, dỡ kiện, bàn giao theo xe", () => {
  it("danh sách có mã kế hoạch + số xe cho chuyến nguyên xe, chuyến gửi kiện thì không", async () => {
    const page = beLoadPageSchema.parse((await call("GET", LOADS, undefined, { size: "50" })).data);
    const ftl = page.items.filter((l) => l.mode === "FULL_TRUCKLOAD");
    // Bốn xe của kế hoạch đơn khách + một xe của kế hoạch nguồn TRANSFER (BE PR #164)
    expect(ftl.map((l) => l.vehicleSeq).sort()).toEqual([1, 1, 2, 3, 4]);
    expect(new Set(ftl.map((l) => l.loadPlanCode))).toEqual(
      new Set(["LP-2026-0001", "LP-2026-0005"]),
    );
    expect(page.items.filter((l) => l.mode === "PARCEL").every((l) => !l.loadPlanCode)).toBe(true);
  });

  it("lọc theo hình thức ở máy chủ: mode=FULL_TRUCKLOAD / PARCEL; giá trị khác → 400 UNSUPPORTED_PARAMETER; tìm theo mã kế hoạch", async () => {
    const list = async (params: Record<string, string>) =>
      beLoadPageSchema.parse((await call("GET", LOADS, undefined, { size: "50", ...params })).data)
        .items;
    const ftl = await list({ mode: "FULL_TRUCKLOAD" });
    expect(ftl).toHaveLength(5);
    expect(ftl.every((l) => l.mode === "FULL_TRUCKLOAD")).toBe(true);
    const parcel = await list({ mode: "PARCEL" });
    expect(parcel.length).toBeGreaterThan(0);
    expect(parcel.every((l) => l.mode === "PARCEL")).toBe(true);
    const bad = await call("GET", LOADS, undefined, { mode: "DRONE" });
    expect(bad.status).toBe(400);
    expect(errorCode(bad)).toBe("UNSUPPORTED_PARAMETER");
    expect((await list({ search: "lp-2026-0001" })).map((l) => l.mode)).toEqual(
      Array(4).fill("FULL_TRUCKLOAD"),
    );
  });

  it("cờ nhãn cũ: chuyến, biên bản và chi tiết lô gửi labelOutdated (+ labelOutdatedAt khi cũ)", async () => {
    const booked = await readLoad(FTL_BOOKED);
    const parcels = booked.shipments.flatMap((s) => s.packages);
    const outdated = parcels.filter((p) => p.labelOutdated);
    expect(outdated).toHaveLength(1);
    expect(outdated[0]?.labelOutdatedAt).toBeDefined();
    expect(
      parcels.filter((p) => !p.labelOutdated).every((p) => p.labelOutdatedAt === undefined),
    ).toBe(true);
    const manifest = beManifestSchema.parse(
      (await call("GET", `${LOADS}/${FTL_BOOKED}/manifest`)).data,
    );
    expect(
      manifest.shipments.flatMap((s) => s.packages).filter((p) => p.labelOutdated),
    ).toHaveLength(1);
    const detail = beShipmentSchema.parse(
      (
        await call(
          "GET",
          `${SHIPMENTS}/${booked.shipments.find((s) => s.packages.some((p) => p.labelOutdated))?.shipmentId}`,
        )
      ).data,
    );
    expect(detail.packages.some((p) => p.labelOutdated)).toBe(true);
  });

  it("chi tiết xe: kiện của riêng xe, thuộc bộ, nhãn cũ, COD 0; biên bản theo xe", async () => {
    const booked = await readLoad(FTL_BOOKED);
    expect(booked).toMatchObject({ mode: "FULL_TRUCKLOAD", vehicleSeq: 2, codTotal: 0 });
    const parcels = booked.shipments.flatMap((s) => s.packages);
    expect(parcels.some((p) => p.labelOutdated)).toBe(true);
    const loading = await readLoad(FTL_LOADING);
    expect(loading.shipments.flatMap((s) => s.packages).some((p) => p.kit)).toBe(true);
    // Lô chở trên hai xe: mỗi xe chỉ liệt kê kiện của mình
    const shared = loading.shipments.find((s) =>
      booked.shipments.some((other) => other.code === s.code),
    );
    const sharedOnBooked = booked.shipments.find((s) => s.code === shared?.code);
    expect(shared?.packages.map((p) => p.labelCode)).not.toEqual(
      sharedOnBooked?.packages.map((p) => p.labelCode),
    );
    const manifest = beManifestSchema.parse(
      (await call("GET", `${LOADS}/${FTL_LOADING}/manifest`)).data,
    );
    expect(manifest).toMatchObject({ mode: "FULL_TRUCKLOAD", vehicleSeq: 1, codTotal: 0 });
    expect(manifest.packageCount).toBe(loading.expectedPackageCount);
  });

  it("đặt xe: PLANNED → VEHICLE_BOOKED; chỉ fulfillment-dispatch:UPDATE; hãng không tồn tại / ngừng dùng; chuyến gửi kiện không đặt xe được", async () => {
    actAs(ORDER_COORDINATOR);
    expect((await post(FTL_PLANNED, "booking", body())).status).toBe(403);
    actAs(WAREHOUSE_STAFF);
    expect(errorCode(await post(FTL_PLANNED, "booking", body({ carrierId: "NOPE" })))).toBe(
      "CARRIER_NOT_FOUND",
    );
    const res = await post(FTL_PLANNED, "booking", body({ driverName: "Lê Văn Xế" }));
    const load = beLoadSchema.parse(res.data);
    expect(load).toMatchObject({
      status: "VEHICLE_BOOKED",
      carrierId: "CAR-GHN",
      vehiclePlate: "51C-1",
      driverName: "Lê Văn Xế",
    });
    expect(load.bookedAt).toBeDefined();
    // Đặt lại khi còn VEHICLE_BOOKED = thay thông tin
    const again = beLoadSchema.parse(
      (await post(FTL_PLANNED, "booking", body({ vehiclePlate: "51C-2" }))).data,
    );
    expect(again).toMatchObject({ status: "VEHICLE_BOOKED", vehiclePlate: "51C-2" });
    // Đang xếp: không đặt lại
    expect(errorCode(await post(FTL_LOADING, "booking", body()))).toBe("INVALID_LOAD_TRANSITION");
    const parcelLoad = beLoadPageSchema
      .parse((await call("GET", LOADS, undefined, { status: "LOADING" })).data)
      .items.find((l) => l.mode === "PARCEL");
    expect(errorCode(await post(parcelLoad?.loadId ?? "", "booking", body()))).toBe(
      "INVALID_LOAD_TRANSITION",
    );
  });

  it("huỷ đặt xe: về PLANNED, xoá hãng, giữ lý do; không huỷ được khi đã LOADING; bắt đầu xếp cần đã đặt", async () => {
    expect(errorCode(await post(FTL_PLANNED, "loading-start"))).toBe("INVALID_LOAD_TRANSITION");
    expect((await post(FTL_BOOKED, "booking-cancellation", { reason: " " })).status).toBe(400);
    const cancelled = beLoadSchema.parse(
      (await post(FTL_BOOKED, "booking-cancellation", { reason: "Hãng hết xe" })).data,
    );
    expect(cancelled).toMatchObject({ status: "PLANNED", bookingCancelReason: "Hãng hết xe" });
    expect(cancelled.carrierId).toBeUndefined();
    expect(errorCode(await post(FTL_LOADING, "booking-cancellation", { reason: "x" }))).toBe(
      "INVALID_LOAD_TRANSITION",
    );
    await post(FTL_PLANNED, "booking", body());
    const started = beLoadSchema.parse((await post(FTL_PLANNED, "loading-start")).data);
    expect(started.status).toBe("LOADING");
    expect(started.loadingStartedAt).toBeDefined();
  });

  it("lô của kế hoạch không thêm / bỏ tay, không huỷ chuyến: 409 LOAD_MANAGED_BY_PLAN", async () => {
    const load = await readLoad(FTL_LOADING);
    expect(errorCode(await post(FTL_LOADING, "shipments", { shipmentIds: ["x"] }))).toBe(
      "LOAD_MANAGED_BY_PLAN",
    );
    expect(
      errorCode(
        await call("DELETE", `${LOADS}/${FTL_LOADING}/shipments/${load.shipments[0]?.shipmentId}`),
      ),
    ).toBe("LOAD_MANAGED_BY_PLAN");
    expect(errorCode(await post(FTL_LOADING, "cancellation", { reason: "x" }))).toBe(
      "LOAD_MANAGED_BY_PLAN",
    );
  });

  it("quét kiện của xe khác → 409 PACKAGE_NOT_IN_LOAD kèm vehicleSeq + loadCode; nhãn cũ → LABEL_OUTDATED; chuyến gửi kiện không nhận kiện của kế hoạch", async () => {
    const loading = await readLoad(FTL_LOADING);
    const booked = await readLoad(FTL_BOOKED);
    const onBooked = booked.shipments.flatMap((s) => s.packages).find((p) => !p.labelOutdated);
    const wrong = await post(FTL_LOADING, "scans", { packageCode: onBooked?.labelCode });
    expect(wrong.status).toBe(409);
    expect(errorCode(wrong)).toBe("PACKAGE_NOT_IN_LOAD");
    expect((wrong.data as { fieldErrors: unknown }).fieldErrors).toEqual([
      { field: "vehicleSeq", message: "2" },
      { field: "loadCode", message: FTL_BOOKED },
    ]);
    const outdated = booked.shipments.flatMap((s) => s.packages).find((p) => p.labelOutdated);
    await post(FTL_BOOKED, "loading-start");
    expect(errorCode(await post(FTL_BOOKED, "scans", { packageCode: outdated?.labelCode }))).toBe(
      "LABEL_OUTDATED",
    );
    const parcelLoad = beLoadPageSchema
      .parse((await call("GET", LOADS, undefined, { status: "LOADING" })).data)
      .items.find((l) => l.mode === "PARCEL");
    const own = loading.shipments.flatMap((s) => s.packages).find((p) => !p.loaded);
    expect(
      errorCode(await post(parcelLoad?.loadId ?? "", "scans", { packageCode: own?.labelCode })),
    ).toBe("PACKAGE_REQUIRES_LOAD_PLAN");
  });

  it("kiện cần dỡ: bàn giao 409 LOAD_UNLOAD_PENDING; dỡ sai kiện → PACKAGE_NOT_IN_LOAD; dỡ hết rồi bàn giao; lô còn kiện trên xe khác chưa HANDED_OVER", async () => {
    const before = await readLoad(FTL_LOADING);
    expect(before.pendingUnloads).toHaveLength(1);
    const handoverBody = (version: number) => ({
      version,
      carrierRepresentative: "Anh Tài",
      vehiclePlate: "29C-123.45",
      signed: true,
    });
    expect(errorCode(await post(FTL_LOADING, "handover", handoverBody(before.version)))).toBe(
      "LOAD_UNLOAD_PENDING",
    );
    const other = before.shipments.flatMap((s) => s.packages)[0];
    expect(errorCode(await post(FTL_LOADING, "unloads", { packageCode: other?.labelCode }))).toBe(
      "PACKAGE_NOT_IN_LOAD",
    );
    expect(errorCode(await post(FTL_LOADING, "unloads", { packageCode: "NOPE-1" }))).toBe(
      "PACKAGE_NOT_FOUND",
    );
    const pending = before.pendingUnloads?.[0];
    const unloaded = beLoadSchema.parse(
      (await post(FTL_LOADING, "unloads", { packageCode: pending?.labelCode.toLowerCase() })).data,
    );
    expect(unloaded.pendingUnloads).toEqual([]);
    // Còn kiện chưa quét → chưa bàn giao
    expect(errorCode(await post(FTL_LOADING, "handover", handoverBody(unloaded.version)))).toBe(
      "LOAD_NOT_FULLY_LOADED",
    );
    let latest = unloaded;
    for (const parcel of unloaded.shipments.flatMap((s) => s.packages).filter((p) => !p.loaded)) {
      latest = beLoadSchema.parse(
        (await post(FTL_LOADING, "scans", { packageCode: parcel.labelCode })).data,
      );
    }
    const done = beLoadSchema.parse(
      (await post(FTL_LOADING, "handover", handoverBody(latest.version))).data,
    );
    expect(done).toMatchObject({ status: "DISPATCHED", codTotal: 0 });
    // Cả hai lô còn kiện trên xe số 2 chưa đi → chỉ HANDED_OVER ở xe cuối cùng (LP-3), lúc này vẫn chờ xuất
    const states = (await shipments()).filter((s) => done.shipments.some((m) => m.code === s.code));
    expect(states).toHaveLength(2);
    expect(states.every((s) => s.status === "READY_TO_DISPATCH")).toBe(true);
  });

  it("xe chỉ chở lô của riêng nó: đặt xe → bắt đầu xếp → quét đủ → ký → lô HANDED_OVER với COD 0", async () => {
    await post(FTL_PLANNED, "booking", body());
    await post(FTL_PLANNED, "loading-start");
    const load = await readLoad(FTL_PLANNED);
    let latest = load;
    for (const parcel of load.shipments.flatMap((s) => s.packages)) {
      latest = beLoadSchema.parse(
        (await post(FTL_PLANNED, "scans", { packageCode: parcel.labelCode })).data,
      );
    }
    const done = beLoadSchema.parse(
      (
        await post(FTL_PLANNED, "handover", {
          version: latest.version,
          carrierRepresentative: "Anh Tài",
          signed: true,
        })
      ).data,
    );
    expect(done.status).toBe("DISPATCHED");
    const [shipment] = done.shipments;
    const row = (await shipments()).find((s) => s.code === shipment?.code);
    expect(row).toMatchObject({ status: "HANDED_OVER", deliveryMode: "FULL_TRUCKLOAD" });
  });

  it("xe huỷ sau khi đã đặt: carrierBookingToCancel và lý do tự huỷ", async () => {
    const cancelled = await readLoad(FTL_CANCELLED);
    expect(cancelled).toMatchObject({ status: "CANCELLED", carrierBookingToCancel: true });
    expect(cancelled.cancelReason).toMatch(/^auto-cancelled/);
  });
});

/* ── Xe của kế hoạch nguồn TRANSFER (BE PR #164) ─────────────────────────────────────────────── */

const FTL_TRANSFER = "LD-2026-F005";

describe("mock xe của kế hoạch nguồn TRANSFER — dòng là một lệnh chuyển kho", () => {
  it("chi tiết chuyến: dòng mang transferOrderId + số lệnh, không có lô giao / đơn / task; kiện chưa quét; không COD", async () => {
    const load = await readLoad(FTL_TRANSFER);
    expect(load).toMatchObject({
      mode: "FULL_TRUCKLOAD",
      status: "VEHICLE_BOOKED",
      loadPlanCode: "LP-2026-0005",
      codTotal: 0,
    });
    const [line] = load.shipments;
    expect(line).toMatchObject({
      code: "TO-2026-0006",
      transferOrderId: "TO-2026-0006",
      packageCount: 2,
      loadedCount: 0,
    });
    expect(line?.shipmentId).toBeUndefined();
    expect(line?.orderId).toBeUndefined();
    expect(line?.taskId).toBeUndefined();
  });

  it("biên bản: dòng của lệnh có transferOrderId, người nhận là kho đích, không số đơn", async () => {
    const manifest = beManifestSchema.parse(
      (await call("GET", `${LOADS}/${FTL_TRANSFER}/manifest`)).data,
    );
    const [line] = manifest.shipments;
    expect(line).toMatchObject({
      shipmentCode: "TO-2026-0006",
      transferOrderId: "TO-2026-0006",
      packageCount: 2,
    });
    expect(line?.orderNumber).toBeUndefined();
    expect(line?.recipientName).toBeTruthy();
  });

  it("lệnh chuyển kho không phải lô giao: không xuất hiện trong danh sách lô giao", async () => {
    expect((await shipments()).some((s) => s.code === "TO-2026-0006")).toBe(false);
  });
});
