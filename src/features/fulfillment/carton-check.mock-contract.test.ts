/**
 * Contract test: mock adapter phải nói đúng hợp đồng + hành vi BE `CartonCheckController` (4C-6, docs 08) để
 * `carton-check-api.ts` (zod parse) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetFulfillmentMockStore } from "@/lib/api/mock-routes-fulfillment-store";
import { setMockUnmeasuredSkus } from "@/lib/api/mock-routes-carton-check-store";
import { backendOrderStatusOf, resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { useAuthStore } from "@/lib/auth/auth-store";

import { pickAllOpenLines } from "./__fixtures__/pick-all-lines";
import { completePicking, listFulfillmentTasks } from "./api";
import {
  checkCarton,
  completeCartonCheck,
  getCartonCheckSession,
  labelCartons,
  listCartonCheckQueue,
  printShippingLabels,
  removeCarton,
  reprintCartonLabel,
  startCartonCheck,
} from "./carton-check-api";
import { putBackLine, listPutBacks } from "./put-back-api";

import type { RoleName } from "@/lib/auth";
import type { CartonCheckSession } from "./carton-check-types";

const USERS = {
  manager: { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] },
  /** Người được gán lấy hàng ORD-2026-0017 — cũng là người bắt đầu kiểm thùng trong test. */
  starter: { userId: "USER-WH-02", roles: ["Warehouse Staff"] },
  otherStaff: { userId: "USER-WH-01", roles: ["Warehouse Staff"] },
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

// Mỗi test bắt đầu từ seed nguyên vẹn (store giữ trạng thái phiên giữa các lần gọi)
beforeEach(() => {
  resetOrderMockStore();
  resetFulfillmentMockStore();
});

afterAll(() => vi.restoreAllMocks());

/** Adapter mock trễ ~350ms/lần gọi (Math.random ghim 0.5). */
const FLOW_TIMEOUT_MS = 120_000;
const ORDER_ID = "ORD-2026-0017";

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

const carton = (session: CartonCheckSession, index: number) =>
  required(session.cartons[index], `thùng #${index + 1}`);

describe("kiểm thùng mock ↔ hợp đồng BE 4C-6", () => {
  it(
    "luồng đủ: chưa lấy xong → hàng chờ → bắt đầu → quét → dán nhãn → PDF → in lại → loại thùng → hoàn tất một phần",
    async () => {
      actAs(USERS.manager);
      const task = required(
        (await listFulfillmentTasks({ size: 200 })).items.find((t) => t.orderId === ORDER_ID),
        `task của ${ORDER_ID}`,
      );
      const id = task.taskId;

      // Chưa lấy xong → chưa bắt đầu được (BE `PACKING_NOT_READY`, docs 08 BR-01)
      actAs(USERS.starter);
      expect(await codeOf(startCartonCheck(id))).toBe("PACKING_NOT_READY");
      await pickAllOpenLines(id);
      expect((await completePicking(id)).pickStatus).toBe("Picked");

      // Hàng chờ: đơn vừa lấy xong, Pending, chưa ai bắt đầu; lọc trạng thái; trạng thái lạ → 400; kho ngoài phạm vi → 403
      const queue = await listCartonCheckQueue({});
      const row = required(
        queue.items.find((r) => r.taskId === id),
        "hàng của task",
      );
      expect(row).toMatchObject({
        status: "Pending",
        checkedCount: 0,
        labeledCount: 0,
        shipmentCount: 0,
      });
      expect(row.cartonCount).toBeGreaterThan(1);
      expect(row.startedBy).toBeUndefined();
      expect(queue.items.every((r) => ["Pending", "In Progress"].includes(r.status))).toBe(true);
      expect(await codeOf(listCartonCheckQueue({ status: "NOPE" }))).toBe("UNSUPPORTED_PARAMETER");
      expect(await codeOf(listCartonCheckQueue({ warehouseId: "WH-HCM-01" }))).toBe(
        "OUT_OF_DATA_SCOPE",
      );

      // Đọc phiên trước khi bắt đầu: mọi thùng To Check; chưa quét / dán nhãn được (PACK_STATE_CONFLICT)
      const pending = await getCartonCheckSession(id);
      expect(pending).toMatchObject({ status: "Pending", orderLocked: false });
      expect(pending.cartons.every((c) => c.status === "To Check" && c.labelVersion === 0)).toBe(
        true,
      );
      const first = carton(pending, 0);
      const second = carton(pending, 1);
      expect(await codeOf(checkCarton({ taskId: id, lpn: first.lpn }))).toBe("PACK_STATE_CONFLICT");
      expect(await codeOf(labelCartons({ taskId: id }))).toBe("PACK_STATE_CONFLICT");

      // Bắt đầu: người khác → 409 PACKING_TAKEN, quản lý kho thì không (BR-06); gọi lại → như cũ
      const started = await startCartonCheck(id);
      expect(started).toMatchObject({ status: "In Progress", startedBy: USERS.starter.userId });
      actAs(USERS.otherStaff);
      expect(await codeOf(startCartonCheck(id))).toBe("PACKING_TAKEN");
      expect(await codeOf(checkCarton({ taskId: id, lpn: first.lpn }))).toBe("PACKING_TAKEN");
      actAs(USERS.manager);
      expect((await startCartonCheck(id)).startedBy).toBe(USERS.starter.userId);
      actAs(USERS.starter);

      // Quét: LPN lạ → 409 CARTON_NOT_IN_TASK; đúng (mọi kiểu chữ) → Checked; quét lại không ghi thêm (BR-05)
      expect(await codeOf(checkCarton({ taskId: id, lpn: "LPN-CUA-DON-KHAC" }))).toBe(
        "CARTON_NOT_IN_TASK",
      );
      const scanned = await checkCarton({ taskId: id, lpn: first.lpn.toLowerCase() });
      expect(carton(scanned, 0)).toMatchObject({ status: "Checked" });
      const checkedAt = carton(scanned, 0).checkedAt;
      expect(checkedAt).toBeTruthy();
      const again = await checkCarton({ taskId: id, lpn: first.lpn });
      expect(carton(again, 0).checkedAt).toBe(checkedAt);

      // Dán nhãn: thùng chưa quét → 409 CARTON_NOT_CHECKED; thiếu quy cách thùng → 422 nêu SKU, cả loạt không dán (BR-07)
      expect(await codeOf(labelCartons({ taskId: id, lpns: [second.lpn] }))).toBe(
        "CARTON_NOT_CHECKED",
      );
      setMockUnmeasuredSkus([first.sku]);
      const unmeasured = await labelCartons({ taskId: id }).catch((error: unknown) => error);
      expect(unmeasured).toBeInstanceOf(ApiError);
      expect((unmeasured as ApiError).code).toBe("CARTON_SPEC_UNMEASURED");
      expect((unmeasured as ApiError).fieldErrorList?.map((f) => f.message)).toEqual([first.sku]);
      expect((await getCartonCheckSession(id)).skusWithoutCartonSpec).toEqual([first.sku]);
      setMockUnmeasuredSkus([]);
      const labeled = await labelCartons({ taskId: id });
      expect(carton(labeled, 0)).toMatchObject({
        status: "Labeled",
        labelVersion: 1,
        lengthCm: 40,
        widthCm: 30,
        heightCm: 25,
        weightKg: 6.5,
        dimWeightKg: 5, // D × R × C / 6000 (BR-09)
      });
      // Thùng đầu tiên dán nhãn khoá đơn (BR-04); gửi lại → không đổi gì
      expect(labeled.orderLocked).toBe(true);
      expect(carton(await labelCartons({ taskId: id }), 0).labelVersion).toBe(1);

      // PDF nhãn: thùng chưa dán nhãn → 409; thùng đã dán → PDF 100 × 150 mm mỗi thùng
      expect(await codeOf(printShippingLabels({ taskId: id, lpns: [second.lpn] }))).toBe(
        "CARTON_NOT_CHECKED",
      );
      const pdf = await printShippingLabels({ taskId: id, lpns: [first.lpn] });
      expect(pdf.blob.type).toBe("application/pdf");
      expect(pdf.fileName).toBe("shipping-labels-ORD-2026-0017.pdf");
      expect(await pdf.blob.text()).toContain("%PDF-1.4");
      expect((await printShippingLabels({ taskId: id })).blob.size).toBeGreaterThan(0);
      // Điều phối / QC chỉ đọc: in PDF cần packing:READ
      actAs(USERS.qc);
      expect(await codeOf(printShippingLabels({ taskId: id }))).toBe("FORBIDDEN");
      actAs(USERS.starter);

      // In lại: phiên bản +1; gửi lại với fromVersion cũ → giữ nguyên (không huỷ nhãn vừa in)
      const reprinted = await reprintCartonLabel({ taskId: id, lpn: first.lpn, fromVersion: 1 });
      expect(carton(reprinted, 0).labelVersion).toBe(2);
      const retried = await reprintCartonLabel({ taskId: id, lpn: first.lpn, fromVersion: 1 });
      expect(carton(retried, 0).labelVersion).toBe(2);
      expect(
        await codeOf(reprintCartonLabel({ taskId: id, lpn: second.lpn, fromVersion: 1 })),
      ).toBe("CARTON_NOT_CHECKED");
      actAs(USERS.otherStaff);
      expect(await codeOf(reprintCartonLabel({ taskId: id, lpn: first.lpn, fromVersion: 2 }))).toBe(
        "PACKING_TAKEN",
      );
      actAs(USERS.starter);

      // Hoàn tất: còn thùng chưa dán nhãn → 409 PACKING_INCOMPLETE nêu từng thùng
      const notReady = await completeCartonCheck({
        taskId: id,
        requestId: "00000000-0000-4000-8000-000000000001",
        partial: false,
      }).catch((error: unknown) => error);
      expect((notReady as ApiError).code).toBe("PACKING_INCOMPLETE");

      // Loại thùng hư hỏng (thùng thứ hai): Removed, ghi chú; gửi lại → như cũ; thùng lạ → 409
      const removed = await removeCarton({ taskId: id, lpn: second.lpn, note: "Móp góc" });
      expect(carton(removed, 1)).toMatchObject({
        status: "Removed",
        removalReason: "DAMAGED",
        removalNote: "Móp góc",
      });
      expect(carton(await removeCarton({ taskId: id, lpn: second.lpn }), 1).status).toBe("Removed");
      expect(await codeOf(removeCarton({ taskId: id, lpn: "LPN-LA" }))).toBe("CARTON_NOT_IN_TASK");
      expect(await codeOf(checkCarton({ taskId: id, lpn: second.lpn }))).toBe(
        "PACK_STATE_CONFLICT",
      );

      // Thùng bị loại vào hàng chờ cất lại, cất vào khu QUARANTINE (không về bin)
      const putBacks = await listPutBacks({});
      const queued = required(
        putBacks.items.find((r) => r.lpn === second.lpn),
        "thùng hư hỏng trong hàng chờ cất lại",
      );
      expect(queued).toMatchObject({ quarantine: true, orderNumber: removed.orderNumber });
      const putBackInput = {
        taskId: id,
        lineId: queued.lineId,
        lpn: second.lpn,
        idempotencyKey: "pb-1",
      } as const;
      expect(await codeOf(putBackLine({ ...putBackInput, locationCode: "HN-A01-01-01-A" }))).toBe(
        "PUT_BACK_LOCATION_INVALID",
      );
      // Khu cách ly HN-QTN-01 của mock-data đang Blocked → không dùng được; LPN sai được kiểm trước vị trí
      expect(await codeOf(putBackLine({ ...putBackInput, locationCode: "HN-QTN-01" }))).toBe(
        "PUT_BACK_LOCATION_INVALID",
      );
      expect(
        await codeOf(putBackLine({ ...putBackInput, lpn: "LPN-LA", locationCode: "HN-QTN-01" })),
      ).toBe("PICK_ITEM_MISMATCH");

      // Thiếu thùng so với dòng đơn: không xin giao một phần → PACKING_INCOMPLETE; Sale chưa cho → PACK_PARTIAL_NOT_ALLOWED
      expect(
        await codeOf(
          completeCartonCheck({
            taskId: id,
            requestId: "00000000-0000-4000-8000-000000000002",
            partial: false,
          }),
        ),
      ).toBe("PACKING_INCOMPLETE");
      expect(
        await codeOf(
          completeCartonCheck({
            taskId: id,
            requestId: "00000000-0000-4000-8000-000000000003",
            partial: true,
            note: "Thùng hỏng đã loại",
          }),
        ),
      ).toBe("PACK_PARTIAL_NOT_ALLOWED");

      // Sale cho phép giao một phần: thiếu ghi chú → 400 `note`; có ghi chú → shipment, phiên ở lại In Progress
      await api.put(`/orders/${ORDER_ID}/partial-shipment`, { allowed: true });
      const noNote = await completeCartonCheck({
        taskId: id,
        requestId: "00000000-0000-4000-8000-000000000004",
        partial: true,
      }).catch((error: unknown) => error);
      expect((noNote as ApiError).code).toBe("VALIDATION_FAILED");
      expect((noNote as ApiError).fieldErrors).toHaveProperty("note");
      const done = await completeCartonCheck({
        taskId: id,
        requestId: "00000000-0000-4000-8000-000000000005",
        partial: true,
        note: "Thùng hỏng đã loại",
      });
      expect(done).toMatchObject({ packStatus: "In Progress" });
      expect(done.shipmentId).toBeTruthy();
      // Đơn đã thanh toán đủ → không có cảnh báo (câu trả lời kèm `paymentDue` khi còn đợt BEFORE_DELIVERY chưa thu)
      expect(done.paymentDue).toBeUndefined();
      const after = await getCartonCheckSession(id);
      expect(after.status).toBe("In Progress");
      expect(after.shipments).toHaveLength(1);
      expect(after.shipments[0]).toMatchObject({
        partial: true,
        partialNote: "Thùng hỏng đã loại",
        status: "READY_TO_DISPATCH",
        packageCount: 1,
      });
      expect(carton(after, 0).shipmentId).toBe(after.shipments[0]?.shipmentId);
      expect(after.paymentDue).toBeUndefined();
      // Gửi lại cùng requestId → cùng shipment, không tạo thêm
      const replay = await completeCartonCheck({
        taskId: id,
        requestId: "00000000-0000-4000-8000-000000000005",
        partial: true,
        note: "Thùng hỏng đã loại",
      });
      expect(replay.shipmentId).toBe(done.shipmentId);
      expect((await getCartonCheckSession(id)).shipments).toHaveLength(1);
      // Thùng đã vào shipment không loại khỏi đơn được (409 PACKAGE_SHIPPED)
      expect(await codeOf(removeCarton({ taskId: id, lpn: first.lpn }))).toBe("PACKAGE_SHIPPED");
      // Đơn giữ nguyên Picking tới khi bàn giao (BE: một phần chỉ `recordPacked`)
      expect(await backendOrderStatusOf(ORDER_ID)).toBe("PICKING");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "seed: phiên In Progress đọc được; phiên Completed có mọi thùng đã dán nhãn trong một shipment, vẫn in lại nhãn được",
    async () => {
      actAs(USERS.manager);
      const tasks = (await listFulfillmentTasks({ size: 200 })).items;
      const inProgress = required(
        tasks.find((t) => t.packStatus === "In Progress"),
        "task đang kiểm thùng",
      );
      expect((await getCartonCheckSession(inProgress.taskId)).status).toBe("In Progress");

      const completed = required(
        tasks.find((t) => t.packStatus === "Completed"),
        "task đã kiểm xong",
      );
      const doneSession = await getCartonCheckSession(completed.taskId);
      expect(doneSession.status).toBe("Completed");
      expect(doneSession.cartons.length).toBeGreaterThan(0);
      expect(doneSession.cartons.every((c) => c.status === "Labeled" && c.shipmentId)).toBe(true);
      expect(doneSession.shipments).toHaveLength(1);
      expect(doneSession.shipments[0]).toMatchObject({
        partial: false,
        packageCount: doneSession.cartons.length,
      });
      expect(doneSession.completedAt).toBeTruthy();
      // Phiên đã Completed vẫn in lại nhãn được (người bắt đầu / quản lý kho)
      const sample = carton(doneSession, 0);
      expect(
        carton(
          await reprintCartonLabel({
            taskId: completed.taskId,
            lpn: sample.lpn,
            fromVersion: sample.labelVersion,
          }),
          0,
        ).labelVersion,
      ).toBe(sample.labelVersion + 1);
      // Nhưng không quét thêm (PACK_STATE_CONFLICT: phiên không còn In Progress)
      expect(await codeOf(checkCarton({ taskId: completed.taskId, lpn: sample.lpn }))).toBe(
        "PACK_STATE_CONFLICT",
      );
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "task huỷ: thùng bị loại vì đơn huỷ (ORDER_CANCELLED); không bắt đầu / quét được",
    async () => {
      actAs(USERS.manager);
      const cancelled = required(
        (await listFulfillmentTasks({ size: 200 })).items.find((t) => t.packStatus === "Cancelled"),
        "task đã huỷ",
      );
      const session = await getCartonCheckSession(cancelled.taskId);
      expect(session.status).toBe("Cancelled");
      expect(session.cartons.every((c) => c.status === "Removed")).toBe(true);
      expect(await codeOf(startCartonCheck(cancelled.taskId))).toBe("PICK_TASK_STATE_CONFLICT");
    },
    FLOW_TIMEOUT_MS,
  );
});
