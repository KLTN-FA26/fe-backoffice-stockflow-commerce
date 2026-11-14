/**
 * Contract test: mock task đích STAGING phải như BE (docs 07 §3, §4.1–§4.3, BR-11) — tạo task kèm đích + khu chờ xuất
 * (422 STAGING_AREA_INVALID), quét vị trí + LPN đưa thùng về khu chờ xuất (STAGED, chưa trừ tồn), hoàn tất → task
 * Staged, `dispatch-transfer` của quản lý kho (task-assignment:UPDATE): chỉ task Staged, đơn treo thì 409
 * PICK_ORDER_ON_HOLD, gọi lại 200; đơn huỷ khi thùng ở khu chờ xuất → hàng đợi cất lại có LPN.
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
import { backendOrderStatusOf, resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";
import { fetchWarehouseLocations } from "@/lib/references/warehouse-locations";

import {
  assignFulfillmentTask,
  completePicking,
  createFulfillmentTask,
  getFulfillmentTask,
  moveToDispatch,
  startPicking,
} from "./api";
import { confirmPickLine, listPickLines } from "./pick-line-api";
import { listPutBacks, putBackLine } from "./put-back-api";
import { listTaskCandidates } from "./reference-api";

import type { RoleName } from "@/lib/auth";

type Who = { userId: string; roles: RoleName[] };
const MANAGER: Who = { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] };
const PICKER: Who = { userId: "USER-WH-01", roles: ["Warehouse Staff"] };
/** Chỉ gán / giám sát task — không có fulfillment-task-assignment:UPDATE của quản lý kho thì không chuyển được. */
const PICK_ONLY: Who = { userId: "USER-PICK-ONLY", roles: ["Warehouse Staff"] };
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

let keySeq = 0;
const nextKey = () => `stg-${(keySeq += 1)}`;

/** Đơn chờ xuất kho đầu tiên + khu chờ xuất của kho nó. */
async function candidate() {
  actAs(MANAGER);
  const order = (await listTaskCandidates()).items[0];
  if (!order) throw new Error("mock thiếu đơn chờ xuất kho");
  const staging = (await fetchWarehouseLocations(order.warehouseId)).filter(
    (location) => location.kind === "AREA" && location.areaType === "STAGING" && location.usable,
  );
  return { order, staging };
}

/** Tạo task STAGING cho đơn đầu danh sách, gán NV kho, lấy hết các dòng về khu chờ xuất, hoàn tất lấy hàng. */
async function stagedTaskFlow() {
  const { order, staging } = await candidate();
  const area = staging[0]?.locationCode;
  if (!area) throw new Error("kho của đơn không có khu chờ xuất trong mock");
  actAs(MANAGER);
  const created = await createFulfillmentTask({
    orderId: order.orderId,
    assignedUserId: PICKER.userId,
    destination: "STAGING",
    stagingLocationCode: area,
  });
  actAs(PICKER);
  await startPicking(created.taskId);
  const lines = await listPickLines(created.taskId);
  for (const line of lines) {
    await confirmPickLine({
      taskId: created.taskId,
      lineId: line.lineId,
      values: { locationCode: line.locationCode, lpn: line.lpn ?? "" },
      idempotencyKey: nextKey(),
    });
  }
  const staged = await completePicking(created.taskId);
  return { order, area, created, lines, staged };
}

beforeAll(() => {
  MOCK_USER_GRANTS["USER-PICK-ONLY"] = [
    ...Object.values(FULFILLMENT_PICK_PERMISSIONS),
    ...Object.values(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS),
    FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS.create,
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
  delete MOCK_USER_GRANTS["USER-PICK-ONLY"];
  vi.restoreAllMocks();
});

describe("mock tạo task kèm đích ↔ BE FulfillmentServiceImpl#createTask", () => {
  it(
    "đích mặc định DISPATCH, không có khu chờ xuất; STAGING mang khu chờ xuất của kho",
    async () => {
      const { order, staging } = await candidate();
      const area = staging[0]?.locationCode ?? "";
      expect(area).not.toBe("");
      const created = await createFulfillmentTask({
        orderId: order.orderId,
        assignedUserId: PICKER.userId,
        destination: "STAGING",
        stagingLocationCode: area.toLowerCase(),
      });
      // Mã khu được chuẩn hoá về mã của kho (không phân biệt hoa thường)
      expect(created).toMatchObject({ destination: "STAGING", stagingLocationCode: area });
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "DISPATCH bỏ qua khu chờ xuất dù form còn mang lựa chọn cũ (BE stagingAreaFor)",
    async () => {
      const { order, staging } = await candidate();
      const created = await createFulfillmentTask({
        orderId: order.orderId,
        assignedUserId: PICKER.userId,
        destination: "DISPATCH",
        stagingLocationCode: staging[0]?.locationCode,
      });
      expect(created.destination).toBe("DISPATCH");
      expect(created.stagingLocationCode).toBeUndefined();
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "khu không phải khu chờ xuất của kho → 422 STAGING_AREA_INVALID, KHÔNG tạo task, đơn vẫn chờ",
    async () => {
      const { order } = await candidate();
      expect(
        await codeOf(
          createFulfillmentTask({
            orderId: order.orderId,
            assignedUserId: PICKER.userId,
            destination: "STAGING",
            stagingLocationCode: "KHU-KHONG-CO",
          }),
        ),
      ).toBe("STAGING_AREA_INVALID");
      expect(await backendOrderStatusOf(order.orderId)).toBe("READY_TO_FULFILL");
      expect((await listTaskCandidates()).items.map((o) => o.orderId)).toContain(order.orderId);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "đích lạ → 400 VALIDATION_FAILED",
    async () => {
      const { order } = await candidate();
      expect(
        await codeOf(
          api.post("/fulfillment/tasks", {
            orderId: order.orderId,
            assignedUserId: PICKER.userId,
            destination: "ELSEWHERE",
          }),
        ),
      ).toBe("VALIDATION_FAILED");
    },
    FLOW_TIMEOUT_MS,
  );
});

describe("mock lấy hàng task STAGING ↔ BE PickList.confirm / requireAllPicked", () => {
  it(
    "quét đúng vị trí + LPN → dòng STAGED kèm khu chờ xuất; hoàn tất → task Staged (không phải Picked); quét lại → 200",
    async () => {
      const { created, lines, staged, area } = await stagedTaskFlow();
      expect(staged).toMatchObject({ pickStatus: "Staged", destination: "STAGING" });
      expect(staged.stagedAt).toBeTruthy();
      actAs(PICKER);
      const after = await listPickLines(created.taskId);
      expect(after.every((line) => line.status === "Staged")).toBe(true);
      expect(after.every((line) => line.stagedLocationCode === area && !!line.stagedAt)).toBe(true);
      const first = lines[0];
      if (!first) throw new Error("task không có dòng");
      // Quét lại đúng cùng thùng (khác key) → 200 nguyên trạng
      expect(
        await confirmPickLine({
          taskId: created.taskId,
          lineId: first.lineId,
          values: { locationCode: first.locationCode, lpn: (first.lpn ?? "").toLowerCase() },
          idempotencyKey: nextKey(),
        }),
      ).toMatchObject({ status: "Staged" });
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "còn dòng chưa quét → hoàn tất 409 PICK_LINES_INCOMPLETE",
    async () => {
      const { order, staging } = await candidate();
      actAs(MANAGER);
      const created = await createFulfillmentTask({
        orderId: order.orderId,
        assignedUserId: PICKER.userId,
        destination: "STAGING",
        stagingLocationCode: staging[0]?.locationCode,
      });
      actAs(PICKER);
      await startPicking(created.taskId);
      expect(await codeOf(completePicking(created.taskId))).toBe("PICK_LINES_INCOMPLETE");
    },
    FLOW_TIMEOUT_MS,
  );
});

describe("mock dispatch-transfer ↔ BE FulfillmentServiceImpl#moveToDispatch", () => {
  it(
    "task Staged → quản lý kho chuyển → Picked, mọi dòng Picked (trừ tồn), movedToDispatchAt; gọi lại → 200 nguyên trạng",
    async () => {
      const { created } = await stagedTaskFlow();
      actAs(MANAGER);
      const moved = await moveToDispatch(created.taskId);
      expect(moved).toMatchObject({ pickStatus: "Picked", destination: "STAGING" });
      expect(moved.movedToDispatchAt).toBeTruthy();
      expect((await listPickLines(created.taskId)).every((line) => line.status === "Picked")).toBe(
        true,
      );
      const again = await moveToDispatch(created.taskId);
      expect(again.movedToDispatchAt).toBe(moved.movedToDispatchAt);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "task chưa Staged → 409 PICK_TASK_STATE_CONFLICT; không có task-assignment:UPDATE → 403",
    async () => {
      const { order, staging } = await candidate();
      actAs(MANAGER);
      const created = await createFulfillmentTask({
        orderId: order.orderId,
        assignedUserId: PICKER.userId,
        destination: "STAGING",
        stagingLocationCode: staging[0]?.locationCode,
      });
      expect(await codeOf(moveToDispatch(created.taskId))).toBe("PICK_TASK_STATE_CONFLICT");
      actAs(PICK_ONLY);
      expect(await codeOf(moveToDispatch(created.taskId))).toBe("FORBIDDEN");
      actAs(PICKER);
      expect(await codeOf(moveToDispatch(created.taskId))).toBe("FORBIDDEN");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "đơn đang treo → 409 PICK_ORDER_ON_HOLD, task vẫn Staged; gỡ treo rồi chuyển được (không cần là người được gán)",
    async () => {
      const { order, created } = await stagedTaskFlow();
      actAs(MANAGER);
      await api.post(`/orders/${order.orderId}/hold`, { reasonCode: "ADDRESS" });
      expect(await backendOrderStatusOf(order.orderId)).toBe("ON_HOLD");
      expect(await codeOf(moveToDispatch(created.taskId))).toBe("PICK_ORDER_ON_HOLD");
      expect((await getFulfillmentTask(created.taskId)).pickStatus).toBe("Staged");
      await api.post(`/orders/${order.orderId}/hold/resolution`, { note: "đã xử lý" });
      expect((await moveToDispatch(created.taskId)).pickStatus).toBe("Picked");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "gán lại task Staged → 409 (chỉ gán khi Pending, docs 07 BR-08)",
    async () => {
      const { created } = await stagedTaskFlow();
      actAs(MANAGER);
      expect(
        await codeOf(
          assignFulfillmentTask({ taskId: created.taskId, assignedUserId: "USER-WH-02" }),
        ),
      ).toBe("CONFLICT");
    },
    FLOW_TIMEOUT_MS,
  );
});

describe("mock huỷ đơn khi thùng ở khu chờ xuất ↔ BE put-back (docs 07 §4.5 bước 13)", () => {
  it(
    "huỷ đơn → dòng Staged vào hàng đợi cất lại kèm LPN + khu chờ xuất là vị trí hiện tại; quét đúng LPN cất về bin → Put Back",
    async () => {
      const { order, created, lines, area } = await stagedTaskFlow();
      actAs(MANAGER);
      await api.post(`/orders/${order.orderId}/admin-cancellation`, { reason: "Khách huỷ" });
      expect((await getFulfillmentTask(created.taskId)).pickStatus).toBe("Cancelled");
      const first = lines[0];
      if (!first) throw new Error("task không có dòng");
      const row = (await listPutBacks({})).items.find((r) => r.lineId === first.lineId);
      expect(row).toMatchObject({ lpn: first.lpn, fromLocationCode: area, quarantine: false });

      const put = (lpn: string, key: string) =>
        putBackLine({
          taskId: created.taskId,
          lineId: first.lineId,
          locationCode: first.locationCode,
          lpn,
          idempotencyKey: key,
        });
      expect(await codeOf(put("LPN-KHAC", nextKey()))).toBe("PICK_ITEM_MISMATCH");
      expect(await put(first.lpn ?? "", nextKey())).toMatchObject({
        status: "Put Back",
        putBackLocationCode: first.locationCode,
      });
    },
    FLOW_TIMEOUT_MS,
  );
});
