/**
 * Contract test: mock dòng lấy hàng phải hành xử như BE `PickListService` (SCRUM-267, báo thiếu / phân bổ lại
 * BE PR #147) — thứ tự kiểm tra, mã lỗi, gửi lại idempotent, quyền theo mã, hoàn tất chỉ khi đủ dòng.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetFulfillmentMockStore } from "@/lib/api/mock-routes-fulfillment-store";
import { backendOrderStatusOf, resetOrderMockStore } from "@/lib/api/mock-routes-orders";
import { useAuthStore } from "@/lib/auth/auth-store";
import { fetchWarehouseLocations } from "@/lib/references/warehouse-locations";

import { completePicking, listFulfillmentTasks, startPicking } from "./api";
import {
  confirmPickLine,
  listPickLines,
  reallocateShortLine,
  reportShortPick,
} from "./pick-line-api";

import type { RoleName } from "@/lib/auth";
import type { FulfillmentTask, PickLine } from "./types";

type Who = { userId: string; roles: RoleName[] };
const MANAGER: Who = { userId: "USER-ADMIN-01", roles: ["Warehouse Manager"] };
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

/** Task theo trạng thái pick + người được gán của nó (để thao tác đúng vai) + một NV kho khác. */
async function taskWith(
  pickStatus: FulfillmentTask["pickStatus"],
): Promise<[FulfillmentTask, Who, Who]> {
  actAs(MANAGER);
  const task = (await listFulfillmentTasks({ size: 200 })).items.find(
    (t) => t.pickStatus === pickStatus && STAFF_IDS.includes(t.assignedUserId ?? ""),
  );
  if (!task?.assignedUserId) throw new Error(`seed thiếu task ${pickStatus}`);
  const other = STAFF_IDS.find((id) => id !== task.assignedUserId) ?? "";
  return [
    task,
    { userId: task.assignedUserId, roles: ["Warehouse Staff"] },
    { userId: other, roles: ["Warehouse Staff"] },
  ];
}

/** Task đang lấy hàng, vừa bắt đầu: mọi dòng OPEN. */
async function startedTask(): Promise<[FulfillmentTask, Who, Who, PickLine[]]> {
  const [task, picker, other] = await taskWith("Pending");
  actAs(picker);
  await startPicking(task.taskId);
  return [task, picker, other, await listPickLines(task.taskId)];
}

const valuesOf = (line: PickLine) => ({
  locationCode: line.locationCode,
  scannedCode: line.sku,
  quantity: line.allocatedQty,
});

let keySeq = 0;
const nextKey = () => `k-${(keySeq += 1)}`;
const confirm = (
  taskId: string,
  line: PickLine,
  patch: Partial<ReturnType<typeof valuesOf>> = {},
) =>
  confirmPickLine({
    taskId,
    lineId: line.lineId,
    values: { ...valuesOf(line), ...patch },
    idempotencyKey: nextKey(),
  });
const short = (taskId: string, line: PickLine, foundQuantity = 0, locationCode?: string) =>
  reportShortPick({
    taskId,
    lineId: line.lineId,
    values: { locationCode: locationCode ?? line.locationCode, foundQuantity },
    idempotencyKey: nextKey(),
  });
const reallocate = (taskId: string, line: PickLine) =>
  reallocateShortLine({ taskId, lineId: line.lineId, idempotencyKey: nextKey() });

/** Lý do giữ đơn hiện tại (đọc như màn đơn hàng, bằng quản lý). */
async function holdReasonOf(orderId: string): Promise<unknown> {
  actAs(MANAGER);
  const { data } = await api.get<Record<string, unknown>>(`/orders/${orderId}`);
  const body: unknown = "data" in data && typeof data.data === "object" ? data.data : data;
  return body && typeof body === "object" && "holdReason" in body ? body.holdReason : undefined;
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});
beforeEach(() => {
  resetOrderMockStore();
  resetFulfillmentMockStore();
});
afterAll(() => vi.restoreAllMocks());

describe("mock dòng lấy hàng ↔ BE PickListService — xác nhận", () => {
  it(
    "luồng đủ: bắt đầu → sai vị trí 409 → chưa đủ dòng không hoàn tất → đúng 200 → gửi lại 200 → hoàn tất",
    async () => {
      const [task, , , lines] = await startedTask();
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((line) => line.status === "Open" && line.shortQty === 0)).toBe(true);
      const first = lines[0] as PickLine;

      expect(await codeOf(confirm(task.taskId, first, { locationCode: "HN-SAI-VI-TRI" }))).toBe(
        "PICK_LOCATION_MISMATCH",
      );
      expect(await codeOf(completePicking(task.taskId))).toBe("PICK_LINES_INCOMPLETE");

      for (const line of lines) {
        expect((await confirm(task.taskId, line)).status).toBe("Picked");
      }
      // Quét lại đúng dòng đã lấy (khác key) → 200, không đổi gì
      const again = await confirm(task.taskId, first, {
        locationCode: first.locationCode.toLowerCase(),
      });
      expect(again).toMatchObject({ status: "Picked", pickedQty: first.allocatedQty });

      await expect(completePicking(task.taskId)).resolves.toMatchObject({ pickStatus: "Picked" });
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "sai mã hàng / vượt / thiếu SL → đúng mã BE; SKU chữ thường và barcode được nhận",
    async () => {
      const [task, , , lines] = await startedTask();
      const line = lines[0] as PickLine;
      expect(await codeOf(confirm(task.taskId, line, { scannedCode: "SKU-KHONG-CO" }))).toBe(
        "PICK_ITEM_MISMATCH",
      );
      expect(await codeOf(confirm(task.taskId, line, { quantity: line.allocatedQty + 1 }))).toBe(
        "PICK_QUANTITY_EXCEEDS_ALLOCATION",
      );
      if (line.allocatedQty > 1) {
        expect(await codeOf(confirm(task.taskId, line, { quantity: line.allocatedQty - 1 }))).toBe(
          "PICK_QUANTITY_SHORT",
        );
      }
      const picked = await confirm(task.taskId, line, { scannedCode: line.sku.toLowerCase() });
      expect(picked.status).toBe("Picked");
      const withBarcode = lines.find((candidate) => candidate.barcode && candidate !== line);
      if (withBarcode?.barcode) {
        const byBarcode = await confirm(task.taskId, withBarcode, {
          scannedCode: withBarcode.barcode,
        });
        expect(byBarcode.status).toBe("Picked");
      }
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "task chưa bắt đầu → PICK_TASK_STATE_CONFLICT; NV kho khác (không được gán) → 404",
    async () => {
      const [task, picker, other] = await taskWith("Pending");
      actAs(picker);
      const line = (await listPickLines(task.taskId))[0] as PickLine;
      expect(await codeOf(confirm(task.taskId, line))).toBe("PICK_TASK_STATE_CONFLICT");
      actAs(other);
      expect(await codeOf(confirm(task.taskId, line))).toBe("NOT_FOUND");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "task seed đang lấy: có dòng đã lấy",
    async () => {
      const [task, picker] = await taskWith("Picking");
      actAs(picker);
      const statuses = (await listPickLines(task.taskId)).map((line) => line.status);
      expect(statuses).toContain("Picked");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "cùng Idempotency-Key, body khác → 422 IDEMPOTENCY_KEY_REUSED; cùng key cùng body → trả lại kết quả cũ",
    async () => {
      const [task, , , lines] = await startedTask();
      const line = lines[0] as PickLine;
      const send = (patch: object) =>
        confirmPickLine({
          taskId: task.taskId,
          lineId: line.lineId,
          values: { ...valuesOf(line), ...patch },
          idempotencyKey: "cung-mot-key",
        });
      expect((await send({})).status).toBe("Picked");
      expect((await send({})).status).toBe("Picked");
      expect(await codeOf(send({ quantity: line.allocatedQty + 5 }))).toBe(
        "IDEMPOTENCY_KEY_REUSED",
      );
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "body thiếu / sai → 400 VALIDATION_FAILED như @NotBlank / @Positive",
    async () => {
      const [task, , , lines] = await startedTask();
      const line = lines[0] as PickLine;
      const bad = api.post(
        `/fulfillment/tasks/${task.taskId}/pick-lines/${line.lineId}/confirmation`,
        { locationCode: " ", scannedCode: line.sku, quantity: 0 },
      );
      expect(await codeOf(bad)).toBe("VALIDATION_FAILED");
    },
    FLOW_TIMEOUT_MS,
  );
});

describe("mock đơn rời khâu kho ↔ BE TaskAccess.orderInFulfilment", () => {
  it(
    "đơn bị huỷ giữa lúc lấy → xác nhận / báo thiếu 409 PICK_TASK_STATE_CONFLICT",
    async () => {
      const [task, picker, , lines] = await startedTask();
      const line = lines[0] as PickLine;
      actAs(MANAGER);
      await api.post(`/orders/${task.orderId}/admin-cancellation`, { reason: "Khách huỷ" });
      actAs(picker);
      expect(await codeOf(confirm(task.taskId, line))).toBe("PICK_TASK_STATE_CONFLICT");
      expect(await codeOf(short(task.taskId, line))).toBe("PICK_TASK_STATE_CONFLICT");
    },
    FLOW_TIMEOUT_MS,
  );
});

describe("mock báo thiếu / phân bổ lại ↔ BE PickListService (X-SHORT)", () => {
  it(
    "báo thiếu → dòng SHORT, đơn ON_HOLD INVENTORY, không trừ; báo lại y hệt → 200",
    async () => {
      const [task, picker, , lines] = await startedTask();
      const line = lines[0] as PickLine;
      const reported = await short(task.taskId, line, line.allocatedQty - 1);
      expect(reported).toMatchObject({ status: "Short", shortQty: 1, pickedQty: 0 });
      expect(await backendOrderStatusOf(task.orderId)).toBe("ON_HOLD");
      expect(await holdReasonOf(task.orderId)).toBe("INVENTORY");
      actAs(picker);
      expect(await short(task.taskId, line, line.allocatedQty - 1)).toMatchObject({
        status: "Short",
      });
      // Báo thiếu khác đi trên dòng đã SHORT → dòng không còn mở (BE kiểm trạng thái dòng trước vị trí)
      expect(await codeOf(short(task.taskId, line, line.allocatedQty - 1, "HN-SAI-VI-TRI"))).toBe(
        "PICK_LINE_NOT_OPEN",
      );
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "báo thiếu: sai vị trí → PICK_LOCATION_MISMATCH; found = allocated → 400; NV khác → 404",
    async () => {
      const [task, , other, lines] = await startedTask();
      const line = lines[0] as PickLine;
      expect(await codeOf(short(task.taskId, line, 0, "HN-SAI-VI-TRI"))).toBe(
        "PICK_LOCATION_MISMATCH",
      );
      expect(await codeOf(short(task.taskId, line, line.allocatedQty))).toBe("VALIDATION_FAILED");
      actAs(other);
      expect(await codeOf(short(task.taskId, line))).toBe("NOT_FOUND");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "còn dòng SHORT → hoàn tất 409 PICK_LINES_INCOMPLETE",
    async () => {
      const [task, , , lines] = await startedTask();
      const [first, ...rest] = lines;
      if (!first) throw new Error("task không có dòng");
      await short(task.taskId, first);
      for (const line of rest) await confirm(task.taskId, line);
      expect(await codeOf(completePicking(task.taskId))).toBe("PICK_LINES_INCOMPLETE");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "phân bổ lại → dòng cũ CANCELLED giữ shortQty, dòng mới OPEN ở cuối, đơn hết giữ; lấy xong thì hoàn tất được",
    async () => {
      const [task, picker, , lines] = await startedTask();
      const first = lines[0] as PickLine;
      await short(task.taskId, first, 0);
      actAs(MANAGER);
      const added = await reallocate(task.taskId, first);
      expect(added).toHaveLength(1);
      const fresh = added[0] as PickLine;
      expect(fresh).toMatchObject({
        status: "Open",
        sku: first.sku,
        orderLineId: first.orderLineId,
        allocatedQty: first.allocatedQty,
        sequenceNo: Math.max(...lines.map((line) => line.sequenceNo)) + 1,
      });
      expect(fresh.locationCode).not.toBe(first.locationCode);
      expect(await backendOrderStatusOf(task.orderId)).toBe("PICKING");

      actAs(picker);
      const after = await listPickLines(task.taskId);
      expect(after.find((line) => line.lineId === first.lineId)).toMatchObject({
        status: "Cancelled",
        shortQty: first.allocatedQty,
      });
      for (const line of after.filter((candidate) => candidate.status === "Open")) {
        await confirm(task.taskId, line);
      }
      await expect(completePicking(task.taskId)).resolves.toMatchObject({ pickStatus: "Picked" });
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "phân bổ lại khi hết chỗ → 409 INSUFFICIENT_STOCK, dòng vẫn SHORT, đơn vẫn giữ",
    async () => {
      const [task, picker, , lines] = await startedTask();
      let line = lines[0] as PickLine;
      const bins = await fetchWarehouseLocations(task.warehouseId ?? "");
      let code = "";
      // Mỗi vòng: báo thiếu ở bin hiện tại rồi phân bổ sang bin khác — tới khi kho hết bin
      for (let round = 0; round <= bins.length && !code; round += 1) {
        actAs(picker);
        await short(task.taskId, line);
        actAs(MANAGER);
        try {
          line = (await reallocate(task.taskId, line))[0] as PickLine;
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          code = error.code;
        }
      }
      expect(code).toBe("INSUFFICIENT_STOCK");
      actAs(picker);
      const current = (await listPickLines(task.taskId)).find((l) => l.lineId === line.lineId);
      expect(current?.status).toBe("Short");
      expect(await backendOrderStatusOf(task.orderId)).toBe("ON_HOLD");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "dòng không SHORT → PICK_LINE_NOT_OPEN; NV kho gọi phân bổ lại → 403",
    async () => {
      const [task, picker, , lines] = await startedTask();
      const first = lines[0] as PickLine;
      actAs(MANAGER);
      expect(await codeOf(reallocate(task.taskId, first))).toBe("PICK_LINE_NOT_OPEN");
      actAs(picker);
      await short(task.taskId, first);
      expect(await codeOf(reallocate(task.taskId, first))).toBe("FORBIDDEN");
    },
    FLOW_TIMEOUT_MS,
  );

  it(
    "người phân việc ngoài phạm vi kho của task → 403 OUT_OF_DATA_SCOPE (BE WarehouseScope)",
    async () => {
      const [task, , , lines] = await startedTask();
      const first = lines[0] as PickLine;
      await short(task.taskId, first);
      // Điều phối chỉ phụ trách kho HN; task seed nằm ở kho khác
      actAs({ userId: "USER-COORD-01", roles: ["Order Coordinator"] });
      expect(task.warehouseId).not.toBe("WH-HN-01");
      expect(await codeOf(reallocate(task.taskId, first))).toBe("OUT_OF_DATA_SCOPE");
    },
    FLOW_TIMEOUT_MS,
  );
});

describe("mock layout kho ↔ BE LayoutController", () => {
  it("bin của đúng kho, bin bị khoá không dùng được", async () => {
    actAs(MANAGER);
    const locations = await fetchWarehouseLocations("WH-HN-01");
    expect(locations.length).toBeGreaterThan(0);
    expect(locations.every((location) => location.locationCode.startsWith("HN-"))).toBe(true);
    expect(locations.some((location) => location.kind === "BIN" && location.usable)).toBe(true);
  });
});
