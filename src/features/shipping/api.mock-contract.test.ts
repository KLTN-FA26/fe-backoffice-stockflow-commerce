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
    expect(new Set(all.map((s) => s.status))).toEqual(
      new Set(["READY_TO_DISPATCH", "HANDED_OVER", "DELIVERY_FAILED"]),
    );
    const loads = beLoadPageSchema.parse(
      (await call("GET", LOADS, undefined, { size: "50" })).data,
    );
    expect(new Set(loads.items.map((l) => l.status))).toEqual(new Set(["LOADING", "DISPATCHED"]));
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
