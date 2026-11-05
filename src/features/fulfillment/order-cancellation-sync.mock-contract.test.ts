/**
 * Contract test: huỷ đơn ở mock đơn hàng → mock xuất kho đồng bộ như BE `OrderCancellationListener` (task, dòng
 * lấy hàng, hàng đợi trả về kệ), bất kể store xuất kho đã nạp trước hay sau khi huỷ. Seed của store xuất kho
 * (`loadStore`) KHÔNG được ghi đè trạng thái đơn đã đổi trong phiên.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetFulfillmentMockStore } from "@/lib/api/mock-routes-fulfillment-store";
import { backendOrderStatusOf, resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { mockOrderCancellations } from "@/lib/api/mock-routes-orders-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import { getFulfillmentTask, listFulfillmentTasks } from "./api";
import { listPickLines, reportShortPick } from "./pick-line-api";
import { listPutBacks } from "./put-back-api";
import { listTaskCandidates } from "./reference-api";

import type { RoleName } from "@/lib/auth";
import type { FulfillmentTask, PickLine } from "./types";

type Who = { userId: string; roles: RoleName[] };
const MANAGER: Who = { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] };
const ACCOUNTANT: Who = { userId: "USER-ACC-01", roles: ["Accountant"] };
/** On Hold, chuyển khoản → CREDIT (vượt hạn mức) — xem `mock-routes-orders-lifecycle.test.ts`. */
const CREDIT_ON_HOLD = "ORD-2026-0006";
const FLOW_TIMEOUT_MS = 30_000;

function actAs(user: Who) {
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

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("expected the call to fail");
}

/** Đơn đầu tiên của mock-data ở trạng thái này — đúng đơn mà seed xuất kho chọn (mỗi trạng thái một task). */
async function seedOrderId(status: string): Promise<string> {
  const { orders } = await import("@/lib/mock-data");
  const order = orders.find((o) => o.status === status);
  if (!order) throw new Error(`mock-data thiếu đơn ${status}`);
  return order.orderId;
}

const adminCancel = (orderId: string) => {
  actAs(MANAGER);
  return api.post(`/orders/${orderId}/admin-cancellation`, { reasonCode: "CUSTOMER_REQUEST" });
};

const rejectCredit = (orderId: string) => {
  actAs(ACCOUNTANT);
  return api.post(`/orders/${orderId}/credit-rejection`, {
    action: "CANCEL",
    note: "Vượt hạn mức",
  });
};

/** Trạng thái đơn theo cả hai nguồn: store mock và `GET /orders/{id}` (đường màn hình đọc). */
async function orderStatus(orderId: string): Promise<{ store: unknown; api: unknown }> {
  actAs(MANAGER);
  const { data } = await api.get<Record<string, unknown>>(`/orders/${orderId}`);
  const body: unknown = "data" in data && typeof data.data === "object" ? data.data : data;
  const status = body && typeof body === "object" && "status" in body ? body.status : undefined;
  return { store: await backendOrderStatusOf(orderId), api: status };
}

async function taskOf(orderId: string): Promise<FulfillmentTask | undefined> {
  actAs(MANAGER);
  return (await listFulfillmentTasks({ size: 200 })).items.find((t) => t.orderId === orderId);
}

let keySeq = 0;
const nextKey = () => `cancel-sync-${(keySeq += 1)}`;

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => {
  resetOrderMockStore();
  resetFulfillmentMockStore();
});
afterAll(() => {
  vi.restoreAllMocks();
});

describe("huỷ đơn → đồng bộ xuất kho (OrderCancellationListener)", () => {
  it(
    "A. huỷ đơn Confirmed TRƯỚC khi store xuất kho nạp: seed không đưa đơn về READY_TO_FULFILL",
    async () => {
      const demo = await seedOrderId("Confirmed");
      const start = mockOrderCancellations();
      await adminCancel(demo);
      expect(await orderStatus(demo)).toEqual({ store: "CANCELLED", api: "CANCELLED" });

      // Lần đầu chạm xuất kho → loadStore() seed
      actAs(MANAGER);
      await listFulfillmentTasks({ size: 200 });
      expect(await orderStatus(demo)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
      expect((await listTaskCandidates()).items.map((o) => o.orderId)).not.toContain(demo);
      expect(mockOrderCancellations()).toBe(start + 1);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "A. huỷ đơn có task seed TRƯỚC khi store nạp: đơn giữ CANCELLED, task + dòng mở bị huỷ, không cần trả về kệ",
    async () => {
      const ready = await seedOrderId("Ready to Fulfill");
      await adminCancel(ready);

      const task = await taskOf(ready);
      expect(task).toMatchObject({ pickStatus: "Cancelled", packStatus: "Cancelled" });
      expect(await orderStatus(ready)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
      const lines = await listPickLines(task?.taskId ?? "");
      expect(lines.every((l) => l.status === "Cancelled")).toBe(true);
      // Chưa bắt đầu lấy → không có gì phải trả về kệ
      expect((await listPutBacks({})).items.filter((r) => r.taskId === task?.taskId)).toEqual([]);
    },
    FLOW_TIMEOUT_MS,
  );

  /** Task seed của đơn "Picking" (đã bắt đầu lấy: dòng đầu Picked, dòng sau Open) — nạp store TRƯỚC khi huỷ. */
  async function pickingTask(): Promise<{ task: FulfillmentTask; picker: Who; lines: PickLine[] }> {
    const task = await taskOf(await seedOrderId("Picking"));
    if (!task?.assignedUserId) throw new Error("seed thiếu task Picking");
    const picker: Who = { userId: task.assignedUserId, roles: ["Warehouse Staff"] };
    actAs(picker);
    const lines = await listPickLines(task.taskId);
    expect(lines.map((l) => l.status)).toEqual(["Picked", "Open"]);
    return { task, picker, lines };
  }

  async function expectCancelledTask(task: FulfillmentTask) {
    actAs(MANAGER);
    expect(await getFulfillmentTask(task.taskId)).toMatchObject({
      pickStatus: "Cancelled",
      packStatus: "Cancelled",
    });
    expect(await orderStatus(task.orderId)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
  }

  it(
    "B + F. store nạp TRƯỚC rồi huỷ: dòng Open → Cancelled, dòng Picked giữ nguyên và vào hàng đợi trả về kệ",
    async () => {
      const { task, picker, lines } = await pickingTask();
      const [picked, open] = lines as [PickLine, PickLine];
      await adminCancel(task.orderId);

      await expectCancelledTask(task);
      actAs(picker);
      const after = new Map((await listPickLines(task.taskId)).map((l) => [l.lineId, l.status]));
      expect(after.get(picked.lineId)).toBe("Picked");
      expect(after.get(open.lineId)).toBe("Cancelled");
      actAs(MANAGER);
      expect(
        (await listPutBacks({})).items.filter((r) => r.taskId === task.taskId).map((r) => r.lineId),
      ).toEqual([picked.lineId]);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "F. dòng Short giữ nguyên Short khi huỷ (BE cancelOpenLines chỉ huỷ dòng Open), không vào hàng đợi",
    async () => {
      const { task, picker, lines } = await pickingTask();
      const [picked, shortLine] = lines as [PickLine, PickLine];
      actAs(picker);
      await reportShortPick({
        taskId: task.taskId,
        lineId: shortLine.lineId,
        values: { locationCode: shortLine.locationCode, foundQuantity: 0 },
        idempotencyKey: nextKey(),
      });
      await adminCancel(task.orderId);

      await expectCancelledTask(task);
      actAs(picker);
      const after = new Map((await listPickLines(task.taskId)).map((l) => [l.lineId, l.status]));
      expect(after.get(picked.lineId)).toBe("Picked");
      expect(after.get(shortLine.lineId)).toBe("Short");
      actAs(MANAGER);
      expect(
        (await listPutBacks({})).items.filter((r) => r.taskId === task.taskId).map((r) => r.lineId),
      ).toEqual([picked.lineId]);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "C. từ chối công nợ (action CANCEL) trước và sau khi store xuất kho nạp: đơn giữ CANCELLED",
    async () => {
      const start = mockOrderCancellations();
      await rejectCredit(CREDIT_ON_HOLD);
      expect(await orderStatus(CREDIT_ON_HOLD)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
      expect(mockOrderCancellations()).toBe(start + 1);

      actAs(MANAGER);
      await listFulfillmentTasks({ size: 200 });
      expect(await orderStatus(CREDIT_ON_HOLD)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
      expect(await taskOf(CREDIT_ON_HOLD)).toBeUndefined();
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "D. đọc lặp lại / nạp lại store xuất kho không đưa đơn đã huỷ về trạng thái khác",
    async () => {
      const demo = await seedOrderId("Confirmed");
      const ready = await seedOrderId("Ready to Fulfill");
      await adminCancel(demo);
      await adminCancel(ready);
      for (let round = 0; round < 3; round += 1) {
        const task = await taskOf(ready);
        actAs(MANAGER);
        await getFulfillmentTask(task?.taskId ?? "");
        await listTaskCandidates();
        expect(await orderStatus(demo)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
        expect(await orderStatus(ready)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
        expect(task).toMatchObject({ pickStatus: "Cancelled" });
        // Nạp lại seed xuất kho (vd reset riêng store xuất kho) cũng không được hồi sinh đơn
        resetFulfillmentMockStore();
      }
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "G. bộ đếm huỷ chỉ tăng khi thật sự chuyển sang CANCELLED (giữ / release / duyệt công nợ thì không)",
    async () => {
      const demo = await seedOrderId("Confirmed");
      const start = mockOrderCancellations();
      actAs(MANAGER);
      await api.post(`/orders/${demo}/hold`, { reasonCode: "CUSTOMER", note: "" });
      actAs(ACCOUNTANT);
      await api.post(`/orders/${CREDIT_ON_HOLD}/credit-approval`, { note: "ok" });
      actAs(MANAGER);
      await listFulfillmentTasks({ size: 200 });
      expect(mockOrderCancellations()).toBe(start);
      await adminCancel(demo);
      expect(mockOrderCancellations()).toBe(start + 1);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "H. huỷ lặp lại bị từ chối: không đếm lại, không đổi task / dòng / hàng đợi trả về kệ",
    async () => {
      const ready = await seedOrderId("Ready to Fulfill");
      await adminCancel(ready);
      await rejectCredit(CREDIT_ON_HOLD);
      const task = await taskOf(ready);
      const lines = await listPickLines(task?.taskId ?? "");
      actAs(MANAGER);
      const queue = (await listPutBacks({})).items;
      const count = mockOrderCancellations();

      expect(await codeOf(adminCancel(ready))).toBe("ORDER_NOT_CANCELLABLE");
      expect(await codeOf(rejectCredit(CREDIT_ON_HOLD))).toBe("ORDER_NOT_ON_CREDIT_HOLD");

      expect(mockOrderCancellations()).toBe(count);
      expect(await taskOf(ready)).toEqual(task);
      expect(await listPickLines(task?.taskId ?? "")).toEqual(lines);
      actAs(MANAGER);
      expect((await listPutBacks({})).items).toEqual(queue);
      expect(await orderStatus(ready)).toEqual({ store: "CANCELLED", api: "CANCELLED" });
    },
    FLOW_TIMEOUT_MS,
  );
});
