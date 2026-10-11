/**
 * Contract test: mock adapter phải nói đúng hợp đồng + hành vi BE `FulfillmentController` /
 * `FulfillmentServiceImpl` để `api.ts` (zod parse + map status) chạy y hệt trên mock và BE thật.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetFulfillmentMockStore } from "@/lib/api/mock-routes-fulfillment-store";
import { resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { useAuthStore } from "@/lib/auth/auth-store";

import {
  assignFulfillmentTask,
  completePacking,
  completePicking,
  createFulfillmentTask,
  getDesignArtifactUrl,
  getFulfillmentTask,
  listFulfillmentTasks,
  reverifyDesignIntegrity,
  startPicking,
} from "./api";
import { getFulfillmentOrder, listAssignableUsers, listFulfillableOrders } from "./reference-api";
import { designedLines } from "./selectors";

import type { RoleName } from "@/lib/auth";
import type { FulfillmentTask } from "./types";

/** Tài khoản có sẵn trong seed mock (`staffUsers`). */
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
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  resetOrderMockStore();
  resetFulfillmentMockStore();
  activateMockAdapter();
});

afterAll(() => vi.restoreAllMocks());

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
    "phạm vi danh sách theo vai trò: quản lý thấy hết, QC chỉ kiện giữ, NV kho chỉ task của mình",
    async () => {
      const all = await allTasks();
      expect(all.length).toBeGreaterThan(0);
      // Seed phủ đủ trạng thái để demo badge + action-gating
      expect(new Set(all.map((t) => t.pickStatus))).toEqual(
        new Set(["Assigned", "In Progress", "Picked", "Cancelled"]),
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
    "luồng đủ: lấy hàng → đóng gói lệch checksum (200 + On Hold) → kiểm tra lại → Packed",
    async () => {
      const task = required(
        (await allTasks()).find((t) => t.pickStatus === "Assigned" && t.packStatus === "Pending"),
        "task chờ lấy hàng",
      );
      const id = task.taskId;

      // Quản lý kho không được gán → không lấy hàng hộ (404)
      expect(await codeOf(startPicking(id))).toBe("NOT_FOUND");

      actAs(USERS.picker);
      expect(task.assignedUserId).toBe(USERS.picker.userId);
      expect(await codeOf(completePicking(id))).toBe("CONFLICT");
      const started = await startPicking(id);
      expect(started.pickStatus).toBe("In Progress");
      expect(started.startedAt).toBeTruthy();

      // Đã bắt đầu → không gán lại được
      actAs(USERS.manager);
      expect(
        await codeOf(
          assignFulfillmentTask({ taskId: id, assignedUserId: USERS.otherPicker.userId }),
        ),
      ).toBe("CONFLICT");

      actAs(USERS.picker);
      // Chưa lấy xong → chưa đóng gói
      expect(await codeOf(completePacking(id))).toBe("CONFLICT");
      expect((await completePicking(id)).pickStatus).toBe("Picked");

      // X-CHK: lệch checksum KHÔNG phải lỗi
      const held = await completePacking(id);
      expect(held.packStatus).toBe("On Hold");
      expect(held.packedAt).toBeUndefined();
      expect(held.integrityEvidence.length).toBeGreaterThan(0);
      expect(held.integrityEvidence.every((e) => !e.matching)).toBe(true);
      // Kiện đang giữ → đóng gói lại bị từ chối; NV kho không được kiểm tra lại
      expect(await codeOf(completePacking(id))).toBe("CONFLICT");
      expect(await codeOf(reverifyDesignIntegrity({ taskId: id, resolutionNote: "x" }))).toBe(
        "FORBIDDEN",
      );

      actAs(USERS.qc);
      expect(await codeOf(reverifyDesignIntegrity({ taskId: id, resolutionNote: " " }))).toBe(
        "VALIDATION_FAILED",
      );
      // File chưa được khôi phục → vẫn 200, vẫn On Hold, thêm evidence
      const still = await reverifyDesignIntegrity({ taskId: id, resolutionNote: "thử lại" });
      expect(still.packStatus).toBe("On Hold");
      expect(still.integrityEvidence.length).toBeGreaterThan(held.integrityEvidence.length);

      const packed = await reverifyDesignIntegrity({ taskId: id, resolutionNote: "đã khôi phục" });
      expect(packed.packStatus).toBe("Packed");
      expect(packed.packedAt).toBeTruthy();
      // Mới nhất trước
      expect(packed.integrityEvidence[0]?.matching).toBe(true);
      expect(await codeOf(reverifyDesignIntegrity({ taskId: id, resolutionNote: "lần nữa" }))).toBe(
        "CONFLICT",
      );
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
      actAs(USERS.qc);
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
    "tạo task: đúng vai trò + người được gán hợp lệ; một đơn một task; đơn rời danh sách chờ",
    async () => {
      actAs(USERS.picker);
      expect(await codeOf(createFulfillmentTask({ orderId: "x", assignedUserId: "y" }))).toBe(
        "FORBIDDEN",
      );

      actAs(USERS.coordinator);
      const order = required((await listFulfillableOrders())[0], "đơn chờ xuất kho");
      // BE: đơn CONFIRMED còn dòng in phải release sản xuất trước → mock chỉ để đơn không có thiết kế
      expect(designedLines((await getFulfillmentOrder(order.orderId)).lines)).toEqual([]);
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
        pickStatus: "Assigned",
        packStatus: "Pending",
      });
      // Gọi lại → trả task cũ, bỏ qua người được gán mới
      const again = await createFulfillmentTask({
        ...input,
        assignedUserId: USERS.otherPicker.userId,
      });
      expect(again.taskId).toBe(created.taskId);
      expect(again.assignedUserId).toBe(USERS.picker.userId);
      expect((await listFulfillableOrders()).map((o) => o.orderId)).not.toContain(order.orderId);

      // Còn Assigned → gán lại được
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

  it("danh sách nhân viên gán được chỉ gồm nhân viên kho / quản lý kho", async () => {
    actAs(USERS.manager);
    const users = await listAssignableUsers();
    expect(users.length).toBeGreaterThan(0);
    expect(
      users.every((u) =>
        u.roles.some((role) => role === "WAREHOUSE_STAFF" || role === "WAREHOUSE_MANAGER"),
      ),
    ).toBe(true);
  });

  it("task không tồn tại → 404 NOT_FOUND; trang ngoài khoảng → 400", async () => {
    actAs(USERS.manager);
    expect(await codeOf(getFulfillmentTask("missing"))).toBe("NOT_FOUND");
    expect(await codeOf(listFulfillmentTasks({ size: 500 }))).toBe("UNSUPPORTED_PARAMETER");
  });
});
