/**
 * Contract test: mock trả hàng về kệ phải như BE (SCRUM-275) — huỷ đơn kéo theo task
 * (OrderCancellationListener), hàng đợi, thứ tự kiểm tra của `PickList.putBack`, quyền theo mã, gửi lại
 * idempotent.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetFulfillmentMockStore } from "@/lib/api/mock-routes-fulfillment-store";
import { resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import { getFulfillmentTask, listFulfillmentTasks, startPicking } from "./api";
import { confirmPickLine, listPickLines, reportShortPick } from "./pick-line-api";
import { listPutBacks, putBackLine } from "./put-back-api";

import type { RoleName } from "@/lib/auth";
import type { FulfillmentTask, PickLine } from "./types";

type Who = { userId: string; roles: RoleName[] };
const ADMIN: Who = { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] };
const HN_STAFF: Who = { userId: "USER-WH-01", roles: ["Warehouse Staff"] };
/** Điều phối thuần: gán / giám sát task, đọc task — không có fulfillment-picking (seed BE PR #148). */
const COORDINATOR: Who = { userId: "USER-OC-TEST", roles: ["Order Coordinator"] };
const STAFF_IDS = ["USER-WH-01", "USER-WH-02", "USER-WH-03"];
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

/** Lấy một task Pending của NV kho: bắt đầu, lấy dòng đầu; trả về task + dòng đã lấy + người được gán. */
async function pickFirstLine(): Promise<{ task: FulfillmentTask; line: PickLine; picker: Who }> {
  actAs(ADMIN);
  const task = (await listFulfillmentTasks({ size: 200 })).items.find(
    (t) => t.pickStatus === "Pending" && STAFF_IDS.includes(t.assignedUserId ?? ""),
  );
  if (!task?.assignedUserId) throw new Error("seed thiếu task Pending");
  const picker: Who = { userId: task.assignedUserId, roles: ["Warehouse Staff"] };
  actAs(picker);
  await startPicking(task.taskId);
  const line = (await listPickLines(task.taskId))[0] as PickLine;
  await confirmPickLine({
    taskId: task.taskId,
    lineId: line.lineId,
    values: { locationCode: line.locationCode, scannedCode: line.sku, quantity: line.allocatedQty },
    idempotencyKey: `pick-${line.lineId}`,
  });
  return { task, line, picker };
}

async function cancelOrder(orderId: string) {
  actAs(ADMIN);
  await api.post(`/orders/${orderId}/admin-cancellation`, { reason: "Khách huỷ" });
}

beforeAll(() => {
  MOCK_USER_GRANTS["USER-OC-TEST"] = [
    ...Object.values(FULFILLMENT_PICK_PERMISSIONS),
    ...Object.values(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS),
    ...Object.values(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS),
  ];
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => {
  resetOrderMockStore();
  resetFulfillmentMockStore();
});
afterAll(() => {
  delete MOCK_USER_GRANTS["USER-OC-TEST"];
  vi.restoreAllMocks();
});

describe("mock trả hàng về kệ ↔ BE PickListService#putBack", () => {
  it(
    "lấy 1 dòng → huỷ đơn → dòng vào hàng đợi → trả về kệ 200 → gửi lại 200 → rời hàng đợi",
    async () => {
      const { task, line } = await pickFirstLine();
      await cancelOrder(task.orderId);

      // Ai có fulfillment-picking của kho đó cũng trả được — không cần là người đã lấy
      actAs(ADMIN);
      expect((await getFulfillmentTask(task.taskId)).pickStatus).toBe("Cancelled");
      const row = (await listPutBacks({})).items.find((r) => r.lineId === line.lineId);
      expect(row).toMatchObject({
        taskId: task.taskId,
        pickedQty: line.allocatedQty,
        fromLocationCode: line.locationCode,
      });

      const input = {
        taskId: task.taskId,
        lineId: line.lineId,
        locationCode: line.locationCode,
        idempotencyKey: "put-1",
      };
      expect(await putBackLine(input)).toMatchObject({
        status: "Put Back",
        putBackQty: line.allocatedQty,
        putBackLocationCode: line.locationCode,
      });
      expect((await putBackLine({ ...input, idempotencyKey: "put-2" })).status).toBe("Put Back");
      expect((await listPutBacks({})).items.some((r) => r.lineId === line.lineId)).toBe(false);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "huỷ đơn: dòng còn mở thành Cancelled, không vào hàng đợi",
    async () => {
      const { task, picker } = await pickFirstLine();
      await cancelOrder(task.orderId);
      actAs(picker);
      const lines = await listPickLines(task.taskId);
      expect(
        lines.filter((l) => l.status !== "Picked").every((l) => l.status === "Cancelled"),
      ).toBe(true);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "huỷ đơn: dòng Thiếu giữ nguyên Short (BE cancelOpenLines chỉ huỷ dòng Open)",
    async () => {
      actAs(ADMIN);
      const task = (await listFulfillmentTasks({ size: 200 })).items.find(
        (t) => t.pickStatus === "Pending" && STAFF_IDS.includes(t.assignedUserId ?? ""),
      );
      if (!task?.assignedUserId) throw new Error("seed thiếu task Pending");
      const picker: Who = { userId: task.assignedUserId, roles: ["Warehouse Staff"] };
      actAs(picker);
      await startPicking(task.taskId);
      const line = (await listPickLines(task.taskId))[0] as PickLine;
      await reportShortPick({
        taskId: task.taskId,
        lineId: line.lineId,
        values: { locationCode: line.locationCode, foundQuantity: 0 },
        idempotencyKey: `short-${line.lineId}`,
      });
      await cancelOrder(task.orderId);
      actAs(picker);
      const after = await listPickLines(task.taskId);
      expect(after.find((l) => l.lineId === line.lineId)?.status).toBe("Short");
      expect(after.filter((l) => l.status === "Open")).toEqual([]);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "dòng của task chưa huỷ → PUT_BACK_NOT_REQUIRED; vị trí không phải bin dùng được của kho → PUT_BACK_LOCATION_INVALID",
    async () => {
      const { task, line } = await pickFirstLine();
      const put = (locationCode: string, idempotencyKey: string) =>
        putBackLine({ taskId: task.taskId, lineId: line.lineId, locationCode, idempotencyKey });
      actAs(ADMIN);
      expect(await codeOf(put(line.locationCode, "a"))).toBe("PUT_BACK_NOT_REQUIRED");
      await cancelOrder(task.orderId);
      expect(await codeOf(put("KHONG-CO-VI-TRI", "b"))).toBe("PUT_BACK_LOCATION_INVALID");
    },
    FLOW_TIMEOUT_MS,
  );

  it("lọc kho ngoài phạm vi → 403 OUT_OF_DATA_SCOPE", async () => {
    actAs(HN_STAFF);
    expect(await codeOf(listPutBacks({ warehouseId: "WH-HCM-01" }))).toBe("OUT_OF_DATA_SCOPE");
  });

  it("điều phối (không có fulfillment-picking:READ) → 403", async () => {
    actAs(COORDINATOR);
    expect(await codeOf(listPutBacks({}))).toBe("FORBIDDEN");
  });

  it("seed: task huỷ sau khi đã lấy có sẵn dòng chờ trả về kệ", async () => {
    actAs(ADMIN);
    expect((await listPutBacks({})).items.length).toBeGreaterThan(0);
  });
});
