/**
 * Contract test: mock adapter phải nói đúng hợp đồng + hành vi BE `PackingController` (PR #136) để
 * `packing-api.ts` (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetFulfillmentMockStore } from "@/lib/api/mock-routes-fulfillment-store";
import { backendOrderStatusOf, resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { useAuthStore } from "@/lib/auth/auth-store";

import { pickAllOpenLines } from "./__fixtures__/pick-all-lines";
import {
  completePicking,
  getFulfillmentTask,
  listFulfillmentTasks,
  reverifyDesignIntegrity,
} from "./api";
import {
  completePacking,
  getPackageLabel,
  getPackingSession,
  listPackingQueue,
  openPackage,
  removeUnits,
  reopenPackage,
  scanIntoPackage,
  sealPackage,
  startPacking,
  voidPackage,
} from "./packing-api";

import type { RoleName } from "@/lib/auth";
import type { PackageType, PackingSession } from "./packing-types";

const USERS = {
  manager: { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] },
  picker: { userId: "USER-WH-02", roles: ["Warehouse Staff"] },
  otherPacker: { userId: "USER-WH-01", roles: ["Warehouse Staff"] },
  otherWarehouse: { userId: "USER-WH-03", roles: ["Warehouse Staff"] },
  qc: { userId: "USER-QC-01", roles: ["QC Staff"] },
} satisfies Record<string, { userId: string; roles: RoleName[] }>;

function actAs(user: { userId: string; roles: RoleName[] }) {
  useAuthStore.setState({
    user: {
      ...user,
      username: "t@t.vn",
      fullName: "Test",
      email: "t@t.vn",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetOrderMockStore();
  resetFulfillmentMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

/** Adapter mock trễ ~350ms/lần gọi (Math.random ghim 0.5). */
const FLOW_TIMEOUT_MS = 90_000;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("expected the call to fail");
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`seed thiếu ${what}`);
  return value;
}

async function taskOfOrder(orderId: string) {
  actAs(USERS.manager);
  const { items } = await listFulfillmentTasks({ size: 200 });
  return required(
    items.find((t) => t.orderId === orderId),
    `task của ${orderId}`,
  );
}

const line = (session: PackingSession, sku: string) =>
  required(
    session.lines.find((l) => l.sku === sku),
    `dòng ${sku}`,
  );

describe("packing mock ↔ hợp đồng BE PR #136", () => {
  it(
    "luồng đủ: hàng chờ → nhận đơn → kiện → quét (lô / serial / lỗi) → niêm phong → hoàn tất một phần rồi đủ → nhãn",
    async () => {
      const task = await taskOfOrder("ORD-2026-0017");
      const id = task.taskId;
      const hoodie = "SKU-004-BLK-L";
      const tee = "SKU-001-BLK-M";

      // Chưa lấy xong → chưa vào hàng chờ, chưa nhận đơn được (409 PACKING_NOT_READY)
      actAs(USERS.picker);
      expect(await codeOf(startPacking(id))).toBe("PACKING_NOT_READY");
      await pickAllOpenLines(id);
      expect((await completePicking(id)).pickStatus).toBe("Picked");

      // Hàng chờ: task vừa lấy xong + kiện đang giữ do lệch thiết kế; không có đơn đã đóng xong / đã huỷ
      const queue = await listPackingQueue({});
      expect(queue.items.map((row) => row.orderNumber)).toContain("ORD-2026-0017");
      expect(
        queue.items.every((row) => ["Pending", "Packing", "On Hold"].includes(row.packStatus)),
      ).toBe(true);
      const row = required(
        queue.items.find((r) => r.taskId === id),
        "hàng của task",
      );
      expect(row).toMatchObject({ packStatus: "Pending", packageCount: 0, shipmentCount: 0 });
      expect(row.packerId).toBeUndefined();
      // Lọc theo trạng thái / kho; kho ngoài phạm vi → 403
      expect(
        (await listPackingQueue({ status: "ON_HOLD" })).items.every(
          (r) => r.packStatus === "On Hold",
        ),
      ).toBe(true);
      expect(await codeOf(listPackingQueue({ warehouseId: "WH-HCM-01" }))).toBe(
        "OUT_OF_DATA_SCOPE",
      );
      expect(await codeOf(listPackingQueue({ status: "NOPE" }))).toBe("UNSUPPORTED_PARAMETER");

      // Chưa nhận đơn → chưa mở kiện (PACK_STATE_CONFLICT); nhận đơn
      expect(await codeOf(openPackage({ taskId: id, idempotencyKey: "k0" }))).toBe(
        "PACK_STATE_CONFLICT",
      );
      const started = await startPacking(id);
      expect(started).toMatchObject({ packStatus: "Packing", packerId: USERS.picker.userId });
      expect(started.packerName).toBeTruthy();
      // Gọi lại bởi chính người đó → nguyên phiên; người khác → PACKING_TAKEN; quản lý kho không bị chặn
      expect((await startPacking(id)).startedAt).toBe(started.startedAt);
      actAs(USERS.otherPacker);
      expect(await codeOf(startPacking(id))).toBe("PACKING_TAKEN");
      expect(await codeOf(openPackage({ taskId: id, idempotencyKey: "k0" }))).toBe("PACKING_TAKEN");
      actAs(USERS.manager);
      expect((await startPacking(id)).packerId).toBe(USERS.picker.userId);

      actAs(USERS.picker);
      const serialPackage = await openPackage({
        taskId: id,
        packageType: "BAG",
        idempotencyKey: "k1",
      });
      expect(serialPackage).toMatchObject({ packageNo: 1, status: "OPEN", packageType: "BAG" });
      expect(serialPackage.labelCode).toBe("PKG-ORD-2026-0017-1");
      // Loại kiện ngoài danh sách BE (cố ý sai kiểu để thử BE từ chối)
      const unknownType: string = "DRUM";
      expect(
        await codeOf(
          openPackage({ taskId: id, packageType: unknownType as PackageType, idempotencyKey: "k" }),
        ),
      ).toBe("VALIDATION_FAILED");

      const session0 = await getPackingSession(id);
      expect(line(session0, hoodie)).toMatchObject({
        wanted: 1,
        serialTracked: true,
        remaining: 1,
      });
      const scan = (
        over: Partial<Parameters<typeof scanIntoPackage>[0]["scan"]>,
        packageId = serialPackage.packageId,
      ) =>
        scanIntoPackage({
          taskId: id,
          packageId,
          scan: { scanId: crypto.randomUUID(), scannedCode: hoodie, quantity: 1, ...over },
        });

      // Lỗi quét: mã lạ, thiếu serial, serial lạ, quá số lượng
      expect(await codeOf(scan({ scannedCode: "KHONG-CO" }))).toBe("PACK_ITEM_NOT_IN_ORDER");
      expect(await codeOf(scan({}))).toBe("VALIDATION_FAILED");
      expect(await codeOf(scan({ serialNumber: "SN-LA" }))).toBe("PACK_SERIAL_MISMATCH");
      // BE kiểm số lượng trước lô / serial: hai chiếc cho dòng chỉ cần một
      expect(await codeOf(scan({ serialNumber: "SN-004-BLK-L-0001", quantity: 2 }))).toBe(
        "PACK_QUANTITY_EXCEEDS_ORDER",
      );
      expect(await codeOf(scan({ quantity: 0, serialNumber: "SN-004-BLK-L-0001" }))).toBe(
        "VALIDATION_FAILED",
      );

      // Quét đúng; gửi lại cùng scanId → 200 không đổi gì; scanId đó ở kiện khác → PACK_SCAN_ID_CONFLICT
      const scanId = crypto.randomUUID();
      const ok = await scan({ scanId, serialNumber: "sn-004-blk-l-0001" });
      expect(line(ok, hoodie)).toMatchObject({ packed: 1, remaining: 0 });
      expect(ok.packages[0]?.contents).toEqual([
        {
          orderLineId: line(ok, hoodie).orderLineId,
          sku: hoodie,
          serialNumber: "SN-004-BLK-L-0001",
          quantity: 1,
        },
      ]);
      const replay = await scan({ scanId, serialNumber: "sn-004-blk-l-0001" });
      expect(line(replay, hoodie).packed).toBe(1);
      const teePackage = await openPackage({ taskId: id, idempotencyKey: "k2" });
      expect(await codeOf(scan({ scanId, serialNumber: "x" }, teePackage.packageId))).toBe(
        "PACK_SCAN_ID_CONFLICT",
      );
      // Đã đủ số lượng đơn cần → quét thêm bị chặn
      expect(await codeOf(scan({ serialNumber: "SN-004-BLK-L-0001" }))).toBe(
        "PACK_QUANTITY_EXCEEDS_ORDER",
      );

      // Bớt hàng (có scanId, gửi lại không bớt hai lần) rồi quét lại
      const removeId = crypto.randomUUID();
      const input = {
        taskId: id,
        packageId: serialPackage.packageId,
        orderLineId: line(ok, hoodie).orderLineId,
        quantity: 1,
        scanId: removeId,
      };
      expect(line(await removeUnits(input), hoodie).packed).toBe(0);
      expect(line(await removeUnits(input), hoodie).packed).toBe(0);
      expect(await codeOf(removeUnits({ ...input, scanId: crypto.randomUUID() }))).toBe(
        "PACK_STATE_CONFLICT",
      );
      await scan({ serialNumber: "SN-004-BLK-L-0001" });

      // Niêm phong: kiện rỗng → PACKAGE_EMPTY; thiếu số đo → 400; đủ → SEALED, khối lượng quy đổi
      expect(
        await codeOf(sealPackage({ taskId: id, packageId: teePackage.packageId, values: seal() })),
      ).toBe("PACKAGE_EMPTY");
      await scan({ scannedCode: tee }, teePackage.packageId);
      expect(
        await codeOf(
          sealPackage({
            taskId: id,
            packageId: teePackage.packageId,
            values: seal({ weightKg: 0 }),
          }),
        ),
      ).toBe("VALIDATION_FAILED");
      // Chưa niêm phong kiện nào → chưa có gì để giao; kiện mở có hàng chặn hoàn tất
      expect(
        await codeOf(
          completePacking({ taskId: id, requestId: crypto.randomUUID(), partial: false }),
        ),
      ).toBe("PACKAGE_NOT_SEALED");
      expect(
        await codeOf(getPackageLabel({ taskId: id, packageId: serialPackage.packageId })),
      ).toBe("PACKAGE_NOT_SEALED");
      const sealed = await sealPackage({
        taskId: id,
        packageId: serialPackage.packageId,
        values: seal({ lengthCm: 30, widthCm: 20, heightCm: 12, fragile: true }),
      });
      expect(sealed).toMatchObject({
        status: "SEALED",
        weightKg: 1.5,
        dimWeightKg: 1.2,
        fragile: true,
        fragileOverridden: true,
      });
      expect(await codeOf(scan({ serialNumber: "SN-004-BLK-L-0001" }))).toBe("PACKAGE_SEALED");
      // Mở lại rồi niêm phong lại
      expect((await reopenPackage({ taskId: id, packageId: serialPackage.packageId })).status).toBe(
        "OPEN",
      );
      await sealPackage({ taskId: id, packageId: serialPackage.packageId, values: seal() });

      // Còn kiện mở có hàng (kiện áo) → PACKAGE_NOT_SEALED; huỷ kiện → hàng tính là chưa đóng
      expect(
        await codeOf(
          completePacking({ taskId: id, requestId: crypto.randomUUID(), partial: false }),
        ),
      ).toBe("PACKAGE_NOT_SEALED");
      const afterVoid = await voidPackage({ taskId: id, packageId: teePackage.packageId });
      expect(line(afterVoid, tee)).toMatchObject({ packed: 0, remaining: 1 });
      expect(afterVoid.packages.find((p) => p.packageId === teePackage.packageId)?.status).toBe(
        "VOIDED",
      );
      // Nhãn TẠM: kiện chưa vào lô giao
      const provisional = await getPackageLabel({ taskId: id, packageId: serialPackage.packageId });
      expect(provisional).toMatchObject({ provisional: true, packageNo: 1, packageCount: 1 });
      expect(provisional.shipmentCode).toBeUndefined();
      expect(provisional.recipient.name).toBeTruthy();
      expect(provisional.returnAddress).toBeTruthy();

      // Hoàn tất khi còn thiếu: đủ → PACKING_INCOMPLETE; một phần cần ghi chú; có ghi chú → lô S1, vẫn Packing
      const requestId = crypto.randomUUID();
      expect(await codeOf(completePacking({ taskId: id, requestId, partial: false }))).toBe(
        "PACKING_INCOMPLETE",
      );
      // BE PR #150: giao một phần do Sales bật trên đơn — chưa bật thì 409 dù có ghi chú
      expect(
        await codeOf(completePacking({ taskId: id, requestId, partial: true, note: "thiếu áo" })),
      ).toBe("PACK_PARTIAL_NOT_ALLOWED");
      await api.put(`/orders/${task.orderId}/partial-shipment`, { allowed: true });
      expect(await codeOf(completePacking({ taskId: id, requestId, partial: true }))).toBe(
        "VALIDATION_FAILED",
      );
      const first = await completePacking({
        taskId: id,
        requestId,
        partial: true,
        note: "thiếu áo",
      });
      expect(first).toMatchObject({ packStatus: "Packing" });
      const shipmentId = required(first.shipmentId, "shipmentId");
      // Gửi lại cùng requestId → trả lại đúng lô đã tạo, không tạo lô thứ hai
      expect(
        (await completePacking({ taskId: id, requestId, partial: true, note: "thiếu áo" }))
          .shipmentId,
      ).toBe(shipmentId);
      expect(await backendOrderStatusOf(task.orderId)).toBe("PICKING");
      const afterFirst = await getPackingSession(id);
      expect(afterFirst.shipments).toHaveLength(1);
      expect(afterFirst.shipments[0]).toMatchObject({
        code: "ORD-2026-0017-S1",
        status: "READY_TO_DISPATCH",
        partial: true,
        partialNote: "thiếu áo",
        packageCount: 1,
      });
      // Kiện đã vào lô: không mở lại, không huỷ, không bớt; nhãn chốt n/N của lô
      expect(await codeOf(reopenPackage({ taskId: id, packageId: serialPackage.packageId }))).toBe(
        "PACKAGE_SHIPPED",
      );
      expect(await codeOf(voidPackage({ taskId: id, packageId: serialPackage.packageId }))).toBe(
        "PACKAGE_SHIPPED",
      );
      const final = await getPackageLabel({ taskId: id, packageId: serialPackage.packageId });
      expect(final).toMatchObject({
        provisional: false,
        shipmentCode: "ORD-2026-0017-S1",
        packageNo: 1,
        packageCount: 1,
      });

      // Đóng nốt dòng còn lại → hoàn tất đủ: lô S2, phiên + đơn PACKED
      const lastPackage = await openPackage({ taskId: id, idempotencyKey: "k3" });
      await scan({ scannedCode: tee }, lastPackage.packageId);
      await sealPackage({ taskId: id, packageId: lastPackage.packageId, values: seal() });
      const done = await completePacking({
        taskId: id,
        requestId: crypto.randomUUID(),
        partial: false,
      });
      expect(done).toMatchObject({ packStatus: "Packed" });
      expect(done.packedAt).toBeTruthy();
      expect((await getPackingSession(id)).shipments.map((s) => s.code)).toEqual([
        "ORD-2026-0017-S1",
        "ORD-2026-0017-S2",
      ]);
      expect(await backendOrderStatusOf(task.orderId)).toBe("PACKED");
      // Đã xong: hoàn tất lại trả như cũ (200), thao tác kiện bị từ chối
      expect(
        (await completePacking({ taskId: id, requestId: crypto.randomUUID(), partial: false }))
          .packStatus,
      ).toBe("Packed");
      expect(await codeOf(openPackage({ taskId: id, idempotencyKey: "k4" }))).toBe(
        "PACK_STATE_CONFLICT",
      );
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "kiện bị giữ do lệch thiết kế: ai có design-reverification:UPDATE (QC, quản lý kho) kiểm tra lại → phiên về PACKING (không PACKED) → người đóng hoàn tất lại",
    async () => {
      actAs(USERS.manager);
      const id = (await taskOfOrder("ORD-2026-0009")).taskId;
      const session = await getPackingSession(id);
      expect(session.packStatus).toBe("On Hold");
      // Seed: đã có kiện niêm phong chứa mọi dòng (lần hoàn tất bị giữ)
      expect(session.packages[0]).toMatchObject({ status: "SEALED" });
      expect(session.shipments).toEqual([]);

      // Đang giữ: nhận đơn / hoàn tất bị từ chối; chờ QC
      actAs(USERS.picker);
      expect(await codeOf(startPacking(id))).toBe("PACK_STATE_CONFLICT");
      expect(
        await codeOf(
          completePacking({ taskId: id, requestId: crypto.randomUUID(), partial: false }),
        ),
      ).toBe("PACK_STATE_CONFLICT");
      // Người đóng gói (fulfillment-packing:UPDATE) không có design-reverification:UPDATE → không kiểm tra lại được
      expect(await codeOf(reverifyDesignIntegrity({ taskId: id, resolutionNote: "x" }))).toBe(
        "FORBIDDEN",
      );
      // QC (BE PR #148): có design-reverification:UPDATE nhưng không có packing:UPDATE → không nhận đơn
      actAs(USERS.qc);
      expect(await codeOf(startPacking(id))).toBe("FORBIDDEN");

      // QC kiểm tra lại thiết kế
      const verified = await reverifyDesignIntegrity({
        taskId: id,
        resolutionNote: "đã khôi phục file",
      });
      expect(verified.packStatus).toBe("Packing");
      expect(await backendOrderStatusOf("ORD-2026-0009")).not.toBe("ON_HOLD");
      expect((await getPackingSession(id)).packStatus).toBe("Packing");

      // Người đóng (người đã nhận đơn) hoàn tất lại → lô giao, phiên + đơn PACKED
      actAs(USERS.manager);
      const done = await completePacking({
        taskId: id,
        requestId: crypto.randomUUID(),
        partial: false,
      });
      expect(done).toMatchObject({ packStatus: "Packed" });
      expect(done.shipmentId).toBeTruthy();
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "phạm vi dữ liệu + mã quyền: kho khác → 403 OUT_OF_DATA_SCOPE; điều phối (không có packages:READ) → 403; task không có → 404",
    async () => {
      const id = (await taskOfOrder("ORD-2026-0005")).taskId;
      actAs(USERS.otherWarehouse);
      expect(await codeOf(getPackingSession(id))).toBe("OUT_OF_DATA_SCOPE");
      // BE #136 bản cuối: NV kho cùng kho đọc được task khi lấy hàng đã xong (người đóng ≠ người lấy)
      actAs(USERS.otherPacker);
      expect((await getFulfillmentTask(id)).pickStatus).toBe("Picked");
      actAs({ userId: "USER-OC-TEST", roles: ["Order Coordinator"] }); // điều phối: không có packages:READ
      expect(await codeOf(getPackingSession(id))).toBe("FORBIDDEN");
      expect(await codeOf(listPackingQueue({}))).toBe("FORBIDDEN");
      actAs(USERS.manager);
      expect(await codeOf(getPackingSession("khong-co"))).toBe("NOT_FOUND");
      // Task seed đã PACKED: lô S1 sẵn sàng giao, COD đơn COD chưa trả trước
      const packed = await getPackingSession(id);
      expect(packed.packStatus).toBe("Packed");
      expect(packed.shipments[0]).toMatchObject({ status: "READY_TO_DISPATCH", partial: false });
      expect(packed.shipments[0]?.codAmount).toBeGreaterThan(0);
      const label = await getPackageLabel({
        taskId: id,
        packageId: required(packed.packages[0], "kiện").packageId,
      });
      expect(label).toMatchObject({ provisional: false, shipmentCode: packed.shipments[0]?.code });
      expect(label.codAmount).toBe(packed.shipments[0]?.codAmount);
    },
    FLOW_TIMEOUT_MS,
  );
});

function seal(over: Partial<Parameters<typeof sealPackage>[0]["values"]> = {}) {
  return {
    weightKg: 1.5,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 10,
    packageType: "CARTON" as const,
    rotatable: undefined,
    fragile: undefined,
    ...over,
  };
}
