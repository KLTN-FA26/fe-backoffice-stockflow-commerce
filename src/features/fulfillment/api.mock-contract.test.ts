/**
 * Contract test: mock adapter phải nói đúng hợp đồng + hành vi BE `FulfillmentController` /
 * `FulfillmentServiceImpl` để `api.ts` (zod parse + map status) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  FULFILLMENT_PICK_PERMISSIONS,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS,
} from "@/constants";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetFulfillmentMockStore } from "@/lib/api/mock-routes-fulfillment-store";
import { backendOrderStatusOf, resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import {
  assignFulfillmentTask,
  completePicking,
  createFulfillmentTask,
  getDesignArtifactUrl,
  getFulfillmentTask,
  listFulfillmentTasks,
  reverifyDesignIntegrity,
  startPicking,
} from "./api";
import { getFulfillmentOrder, listAssignees, listTaskCandidates } from "./reference-api";
import { designedLines } from "./selectors";

import type { RoleName } from "@/lib/auth";
import type { FulfillmentTask } from "./types";

/**
 * Tài khoản có sẵn trong seed mock (`staffUsers`). Quyền của mock backend lấy từ `MOCK_USER_GRANTS`
 * theo userId (BE PR #148), không theo vai trò; `USER-OC-TEST` là điều phối thuần (gán + giám sát task,
 * đọc task) — không có quyền lấy hàng / đóng gói như `USER-COORD-01`.
 */
const USERS = {
  manager: { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] },
  picker: { userId: "USER-WH-01", roles: ["Warehouse Staff"] },
  otherPicker: { userId: "USER-WH-02", roles: ["Warehouse Staff"] },
  qc: { userId: "USER-QC-01", roles: ["QC Staff"] },
  coordinator: { userId: "USER-OC-TEST", roles: ["Order Coordinator"] },
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
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
}

beforeAll(() => {
  MOCK_USER_GRANTS["USER-OC-TEST"] = [
    ...Object.values(FULFILLMENT_PICK_PERMISSIONS),
    ...Object.values(FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS),
    ...Object.values(FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS),
  ];
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetOrderMockStore();
  resetFulfillmentMockStore();
  activateMockAdapter();
});

afterAll(() => {
  delete MOCK_USER_GRANTS["USER-OC-TEST"];
  vi.restoreAllMocks();
});

/** Adapter mock trễ ~350ms/lần gọi (Math.random ghim 0.5). */
const FLOW_TIMEOUT_MS = 30_000;

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("expected the call to fail");
}

async function allTasks(): Promise<FulfillmentTask[]> {
  actAs(USERS.manager);
  return (await listFulfillmentTasks({ size: 200 })).items;
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`seed thiếu ${what}`);
  return value;
}

describe("fulfillment mock ↔ hợp đồng BE", () => {
  it(
    "phạm vi danh sách theo mã quyền: task-oversight:READ thấy hết, design-reverification:READ chỉ kiện giữ, còn lại chỉ task của mình",
    async () => {
      const all = await allTasks();
      expect(all.length).toBeGreaterThan(0);
      // Seed phủ đủ trạng thái để demo badge + action-gating
      expect(new Set(all.map((t) => t.pickStatus))).toEqual(
        new Set(["Pending", "Picking", "Picked", "Cancelled"]),
      );
      expect(new Set(all.map((t) => t.packStatus))).toEqual(
        new Set(["Pending", "On Hold", "Packed", "Cancelled"]),
      );

      actAs(USERS.qc);
      const held = (await listFulfillmentTasks({})).items;
      expect(held.length).toBeGreaterThan(0);
      expect(held.every((t) => t.packStatus === "On Hold")).toBe(true);

      actAs(USERS.otherPicker);
      const mine = (await listFulfillmentTasks({})).items;
      expect(mine.every((t) => t.assignedUserId === USERS.otherPicker.userId)).toBe(true);
      const notMine = required(
        all.find((t) => t.assignedUserId !== USERS.otherPicker.userId),
        "task của người khác",
      );
      // Không phải người được gán → 404, không phải 403
      expect(await codeOf(getFulfillmentTask(notMine.taskId))).toBe("NOT_FOUND");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "luồng lấy hàng: người được gán bắt đầu → hoàn tất; đóng gói do màn trạm (packing.mock-contract.test.ts) lo",
    async () => {
      const task = required(
        (await allTasks()).find((t) => t.pickStatus === "Pending" && t.packStatus === "Pending"),
        "task chờ lấy hàng",
      );
      const id = task.taskId;

      // Quản lý kho không được gán → không lấy hàng hộ (404)
      expect(await codeOf(startPicking(id))).toBe("NOT_FOUND");

      actAs(USERS.picker);
      expect(task.assignedUserId).toBe(USERS.picker.userId);
      expect(await codeOf(completePicking(id))).toBe("CONFLICT");
      const started = await startPicking(id);
      expect(started.pickStatus).toBe("Picking");
      expect(started.startedAt).toBeTruthy();

      // Đã bắt đầu → không gán lại được
      actAs(USERS.manager);
      expect(
        await codeOf(
          assignFulfillmentTask({ taskId: id, assignedUserId: USERS.otherPicker.userId }),
        ),
      ).toBe("CONFLICT");

      actAs(USERS.picker);
      const picked = await completePicking(id);
      expect(picked.pickStatus).toBe("Picked");
      // BE PR #136 trả thêm số đơn + kho trên task
      expect(picked.orderNumber).toBeTruthy();
      expect(picked.warehouseId).toBeTruthy();
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "artifact: chỉ dòng có thiết kế; lệch checksum → 409; bundle thiếu vai trò → 404",
    async () => {
      const held = required(
        (await allTasks()).find((t) => t.packStatus === "On Hold"),
        "kiện đang giữ",
      );
      // Kiểm tra lại thiết kế: design-reverification:UPDATE (QC, quản lý kho — BE PR #148)
      actAs(USERS.manager);
      const lineId = required(held.integrityEvidence[0]?.orderLineId, "evidence");
      const input = { taskId: held.taskId, lineId, role: "CUSTOMER_PREVIEW" } as const;
      // File đang lệch → BE từ chối cấp URL
      expect(await codeOf(getDesignArtifactUrl(input))).toBe("CONFLICT");

      await reverifyDesignIntegrity({ taskId: held.taskId, resolutionNote: "đã khôi phục" });
      const artifact = await getDesignArtifactUrl(input);
      expect(artifact.role).toBe("CUSTOMER_PREVIEW");
      expect(artifact.contentType.startsWith("image/")).toBe(true);
      expect(artifact.checksum).toMatch(/^[0-9a-f]{64}$/);
      expect(await codeOf(getDesignArtifactUrl({ ...input, role: "PRODUCTION_INSTRUCTION" }))).toBe(
        "NOT_FOUND",
      );
      expect(await codeOf(getDesignArtifactUrl({ ...input, lineId: "khong-co" }))).toBe(
        "NOT_FOUND",
      );
      // Điều phối đơn bị loại khỏi endpoint tải artifact
      actAs(USERS.coordinator);
      expect(await codeOf(getDesignArtifactUrl(input))).toBe("FORBIDDEN");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "tạo task: đúng mã quyền + người được gán hợp lệ; một đơn một task; đơn rời danh sách chờ",
    async () => {
      actAs(USERS.picker);
      expect(await codeOf(createFulfillmentTask({ orderId: "x", assignedUserId: "y" }))).toBe(
        "FORBIDDEN",
      );

      actAs(USERS.coordinator);
      const order = required((await listTaskCandidates()).items[0], "đơn chờ xuất kho");
      // BE PR #133: chỉ đơn READY_TO_FULFILL (đã release) mới vào xuất kho
      expect(await backendOrderStatusOf(order.orderId)).toBe("READY_TO_FULFILL");
      expect(designedLines((await getFulfillmentOrder(order.orderId)).lines)).toEqual([]);
      // Đơn chưa release → 409 PICK_TASK_STATE_CONFLICT (mã thật của BE), không tạo task
      const { orders } = await import("@/lib/mock-data");
      const inProduction = required(
        orders.find((o) => o.status === "In Production"),
        "đơn đang sản xuất",
      );
      expect(
        await codeOf(
          createFulfillmentTask({
            orderId: inProduction.orderId,
            assignedUserId: USERS.picker.userId,
          }),
        ),
      ).toBe("PICK_TASK_STATE_CONFLICT");
      const input = { orderId: order.orderId, assignedUserId: USERS.picker.userId };
      // QC không phải nhân viên kho
      expect(
        await codeOf(createFulfillmentTask({ ...input, assignedUserId: USERS.qc.userId })),
      ).toBe("VALIDATION_FAILED");
      expect(await codeOf(createFulfillmentTask({ ...input, orderId: "khong-co" }))).toBe(
        "NOT_FOUND",
      );

      const created = await createFulfillmentTask(input);
      expect(created).toMatchObject({
        orderId: order.orderId,
        assignedUserId: USERS.picker.userId,
        pickStatus: "Pending",
        packStatus: "Pending",
      });
      // Tạo task chuyển đơn READY_TO_FULFILL → PICKING (BE `orders.startPicking`)
      expect(await backendOrderStatusOf(order.orderId)).toBe("PICKING");
      // Gọi lại → trả task cũ, bỏ qua người được gán mới
      const again = await createFulfillmentTask({
        ...input,
        assignedUserId: USERS.otherPicker.userId,
      });
      expect(again.taskId).toBe(created.taskId);
      expect(again.assignedUserId).toBe(USERS.picker.userId);
      expect((await listTaskCandidates()).items.map((o) => o.orderId)).not.toContain(order.orderId);

      // Còn Pending → gán lại được
      const reassigned = await assignFulfillmentTask({
        taskId: created.taskId,
        assignedUserId: USERS.otherPicker.userId,
      });
      expect(reassigned.assignedUserId).toBe(USERS.otherPicker.userId);
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "task của đơn đã huỷ: mọi thao tác trả CONFLICT (task đã đóng)",
    async () => {
      const cancelled = required(
        (await allTasks()).find((t) => t.pickStatus === "Cancelled"),
        "task đã huỷ",
      );
      actAs({
        userId: required(cancelled.assignedUserId ?? undefined, "người được gán"),
        roles: ["Warehouse Staff"],
      });
      expect(await codeOf(startPicking(cancelled.taskId))).toBe("CONFLICT");
    },
    FLOW_TIMEOUT_MS,
  );

  it("người nhận task theo kho: chỉ NV kho / quản lý kho của kho đó; cần task-assignment:UPDATE; kho bắt buộc và phải tồn tại", async () => {
    actAs(USERS.manager);
    const task = required((await allTasks())[0], "task");
    const warehouseId = required(task.warehouseId ?? undefined, "kho của task");
    // BE trả tên người được gán ngay trên task — màn danh sách không phải tra riêng
    expect(task.assignedUserName).toBeTruthy();
    const users = await listAssignees(warehouseId);
    expect(users.length).toBeGreaterThan(0);
    expect(
      users.every((u) =>
        u.roles.some((role) => role === "WAREHOUSE_STAFF" || role === "WAREHOUSE_MANAGER"),
      ),
    ).toBe(true);
    // BE `AssigneeResponse`: chỉ userId + displayName + roles (không email / điện thoại / trạng thái)
    expect(Object.keys(users[0] ?? {}).sort()).toEqual(["displayName", "roles", "userId"]);

    // NV kho không có task-assignment:UPDATE
    actAs(USERS.picker);
    expect(await codeOf(listAssignees(warehouseId))).toBe("FORBIDDEN");

    actAs(USERS.manager);
    expect(await codeOf(listAssignees(""))).toBe("VALIDATION_FAILED");
    expect(await codeOf(listAssignees("khong-co-kho"))).toBe("WAREHOUSE_NOT_FOUND");
  });

  it("đơn chờ xuất kho: cần task-assignment:CREATE, cũ nhất trước, lọc theo kho, kho lạ → 404, size > 200 → 400", async () => {
    // Các ca trước đã tạo task cho đơn chờ → dựng lại seed
    resetOrderMockStore();
    resetFulfillmentMockStore();
    actAs(USERS.manager);
    const { items } = await listTaskCandidates();
    expect(items.length).toBeGreaterThan(0);
    for (const candidate of items) {
      expect(await backendOrderStatusOf(candidate.orderId)).toBe("READY_TO_FULFILL");
      expect(candidate.lineCount).toBe(candidate.lines.length);
      expect(candidate.totalQuantity).toBe(candidate.lines.reduce((sum, l) => sum + l.quantity, 0));
    }
    const released = items.map((c) => c.releasedAt ?? "");
    expect(released).toEqual([...released].sort());

    const warehouseId = required(items[0]?.warehouseId, "kho của đơn");
    const inWarehouse = await listTaskCandidates({ warehouseId });
    expect(inWarehouse.items.every((c) => c.warehouseId === warehouseId)).toBe(true);
    expect(await codeOf(listTaskCandidates({ warehouseId: "khong-co-kho" }))).toBe(
      "WAREHOUSE_NOT_FOUND",
    );

    // NV kho không có task-assignment:CREATE
    actAs(USERS.picker);
    expect(await codeOf(listTaskCandidates())).toBe("FORBIDDEN");
  });

  it("task không tồn tại → 404 NOT_FOUND; trang ngoài khoảng → 400", async () => {
    actAs(USERS.manager);
    expect(await codeOf(getFulfillmentTask("missing"))).toBe("NOT_FOUND");
    expect(await codeOf(listFulfillmentTasks({ size: 500 }))).toBe("UNSUPPORTED_PARAMETER");
  });
});
