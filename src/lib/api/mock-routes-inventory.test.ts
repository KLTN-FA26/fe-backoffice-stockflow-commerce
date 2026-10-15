/**
 * Mock routes tồn kho — chạy qua axios thật + `features/inventory/api.ts` + `transport.ts`, nên
 * kiểm luôn: đúng URL production, envelope BE, PageResponse trang 0, lỗi `errorCode` → ApiError.
 * `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên của adapter (như test đơn hàng).
 *
 * Request mà form FE đã chặn bằng zod (SCRAP dương, OTHER thiếu giải thích, lý do từ chối trống)
 * được gửi thẳng qua `inventoryRequest` để chứng minh chính mock cũng chặn, không chỉ form.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_API, INVENTORY_LIMITS } from "@/constants/inventory";
import {
  GOODS_RECEIPT_PERMISSIONS,
  INVENTORY_PERMISSIONS,
  PO_PERMISSIONS,
} from "@/constants/permissions";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { fetchMyPermissions } from "@/lib/auth/me-permissions";
import { staffUsers } from "@/lib/mock-data";

import {
  approveAdjustment,
  createAdjustment,
  getAdjustment,
  listAdjustments,
  listMovements,
  rejectAdjustment,
  withdrawAdjustment,
} from "@/features/inventory/api";
import { stockAdjustmentDto } from "@/features/inventory/schemas";
import { inventoryRequest } from "@/features/inventory/transport";

import { activateMockAdapter } from "./mock-adapter";
import { mockActorId, resetInventoryMockState } from "./mock-routes-inventory";

import type { RoleName } from "@/lib/auth/roles";
import type { CreateAdjustmentInput } from "@/features/inventory/types";

// Mỗi request mock trễ ~215ms (Math.random = 0.05).
vi.setConfig({ testTimeout: 20_000 });

const originalAdapter = api.defaults.adapter;
const ACTOR_A = "MOCK-ACTOR-A";
const ACTOR_B = "MOCK-ACTOR-B";
const UNKNOWN_ID = "00000000-0000-4000-8000-0000000000ff";

function actAs(userId: string, roles: RoleName[] = ["Warehouse Manager"]) {
  useAuthStore.setState({
    user: { userId, fullName: userId, email: `${userId}@example.test`, roles, warehouseIds: [] },
    impersonatedRole: null,
  });
}

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected request to fail");
}

const FOUND: CreateAdjustmentInput = {
  locationCode: "LOC-A",
  sku: "SKU-A",
  quantityDelta: 5,
  reason: "FOUND",
};

/** Gửi body thô qua transport production — bỏ qua zod của form, không bỏ qua mock. */
function postRaw(body: Record<string, unknown>) {
  return inventoryRequest(
    { url: INVENTORY_API.adjustments, method: "POST", data: body },
    stockAdjustmentDto,
  );
}

function rejectRaw(id: string, reason: string) {
  return inventoryRequest(
    { url: INVENTORY_API.rejection(id), method: "POST", data: { reason } },
    stockAdjustmentDto,
  );
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});

beforeEach(() => actAs(ACTOR_A));

afterEach(() => resetInventoryMockState());

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("adjustment flow through the real client", () => {
  it("A requests, B approves, the ledger gets exactly one ADJUSTMENT line", async () => {
    const created = await createAdjustment(FOUND);
    expect(created).toMatchObject({
      status: "PENDING_APPROVAL",
      requestedBy: mockActorId(ACTOR_A),
      sku: "SKU-A",
      locationCode: "LOC-A",
      quantityDelta: 5,
      version: 0,
    });
    expect(created.number).toMatch(/^ADJ-\d{8}-0001$/);
    expect(await listMovements({ page: 0, size: 20 })).toMatchObject({ totalElements: 0 });

    actAs(ACTOR_B);
    const posted = await approveAdjustment(created.adjustmentId);
    expect(posted).toMatchObject({
      status: "POSTED",
      decidedBy: mockActorId(ACTOR_B),
      version: 1,
    });
    expect(posted.postedAt).toBeTruthy();
    expect(posted.decidedAt).toBe(posted.postedAt);

    const ledger = await listMovements({ page: 0, size: 20 });
    expect(ledger.items).toHaveLength(1);
    expect(ledger.items[0]).toMatchObject({
      type: "ADJUSTMENT",
      referenceType: "STOCK_ADJUSTMENT",
      referenceId: created.adjustmentId,
      sku: "SKU-A",
      toLocation: "LOC-A",
      quantity: 5,
      reason: "FOUND",
      actorId: mockActorId(ACTOR_B),
    });
    expect(ledger.items[0]?.fromLocation).toBeUndefined();

    expect(await getAdjustment(created.adjustmentId)).toMatchObject({ status: "POSTED" });
    const queue = await listAdjustments({ page: 0, size: 20, status: "POSTED" });
    expect(queue.items.map((item) => item.adjustmentId)).toEqual([created.adjustmentId]);
  });

  it("a write-down posts from the location with the absolute quantity and note", async () => {
    const created = await createAdjustment({
      locationCode: "loc-b",
      sku: "sku-b",
      quantityDelta: -3,
      reason: "OTHER",
      note: "Kiểm kê thực tế lệch dữ liệu",
    });
    actAs(ACTOR_B);
    await approveAdjustment(created.adjustmentId);
    const [line] = (await listMovements({ page: 0, size: 20 })).items;
    expect(line).toMatchObject({
      sku: "SKU-B",
      fromLocation: "LOC-B",
      quantity: 3,
      reason: "OTHER: Kiểm kê thực tế lệch dữ liệu",
    });
    expect(line?.toLocation).toBeUndefined();
  });
});

describe("four eyes", () => {
  it("the requester cannot approve: 409, still pending, no ledger line", async () => {
    const created = await createAdjustment(FOUND);
    const error = await captureError(approveAdjustment(created.adjustmentId));
    expect(error).toMatchObject({ status: 409, code: "ADJUSTMENT_SELF_APPROVAL" });
    expect(await getAdjustment(created.adjustmentId)).toMatchObject({ status: "PENDING_APPROVAL" });
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(0);
  });

  it("the requester cannot reject either", async () => {
    const created = await createAdjustment(FOUND);
    const error = await captureError(
      rejectAdjustment(created.adjustmentId, { reason: "Không hợp lệ" }),
    );
    expect(error).toMatchObject({ status: 409, code: "ADJUSTMENT_SELF_APPROVAL" });
    expect(await getAdjustment(created.adjustmentId)).toMatchObject({ status: "PENDING_APPROVAL" });
  });
});

describe("request rules enforced by the mock itself", () => {
  it.each(["SCRAP", "SAMPLE"])(
    "%s with a positive delta is refused and not stored",
    async (reason) => {
      const error = await captureError(
        postRaw({ locationCode: "LOC-A", sku: "SKU-A", quantityDelta: 1, reason }),
      );
      expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
      expect((await listAdjustments({ page: 0, size: 20 })).totalElements).toBe(0);
      expect(
        await postRaw({ locationCode: "LOC-A", sku: "SKU-A", quantityDelta: -1, reason }),
      ).toMatchObject({ status: "PENDING_APPROVAL", quantityDelta: -1, reason });
    },
  );

  it("OTHER needs an explanation; a blank note is refused", async () => {
    const base = { locationCode: "LOC-A", sku: "SKU-A", quantityDelta: -2, reason: "OTHER" };
    expect(await captureError(postRaw({ ...base, note: "   " }))).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
    });
    expect(await postRaw({ ...base, note: "  Kiểm kê thực tế lệch dữ liệu  " })).toMatchObject({
      reason: "OTHER",
      note: "Kiểm kê thực tế lệch dữ liệu",
    });
  });

  it("bean validation answers with per-field errors", async () => {
    const error = await captureError(
      postRaw({ locationCode: "", sku: "x", quantityDelta: 2_000_000, reason: "FOUND" }),
    );
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(error.fieldErrors ?? {}).sort()).toEqual([
      "locationCode",
      "quantityDelta",
      "sku",
    ]);
    expect(
      await captureError(
        postRaw({ locationCode: "LOC-A", sku: "SKU-A", quantityDelta: 0, reason: "FOUND" }),
      ),
    ).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(
      await captureError(
        postRaw({
          locationCode: "LOC-A",
          sku: "SKU-A",
          quantityDelta: -1,
          reason: "COUNT_VARIANCE",
        }),
      ),
    ).toMatchObject({ status: 400, code: "MALFORMED_REQUEST" });
  });

  it("a rejection reason is required and at most the backend length", async () => {
    const created = await createAdjustment(FOUND);
    actAs(ACTOR_B);
    const blank = await captureError(rejectRaw(created.adjustmentId, "  "));
    expect(blank).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(blank.fieldErrors).toHaveProperty("reason");
    const tooLong = await captureError(
      rejectRaw(created.adjustmentId, "x".repeat(INVENTORY_LIMITS.rejectionLength + 1)),
    );
    expect(tooLong).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(await getAdjustment(created.adjustmentId)).toMatchObject({ status: "PENDING_APPROVAL" });
  });
});

describe("lifecycle", () => {
  it("a posted adjustment cannot be approved again", async () => {
    const created = await createAdjustment(FOUND);
    actAs(ACTOR_B);
    await approveAdjustment(created.adjustmentId);
    expect(await captureError(approveAdjustment(created.adjustmentId))).toMatchObject({
      status: 409,
      code: "INVALID_ADJUSTMENT_TRANSITION",
    });
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(1);
  });

  it("reject fills the decision fields; a rejected adjustment is closed", async () => {
    const created = await createAdjustment(FOUND);
    actAs(ACTOR_B);
    const rejected = await rejectAdjustment(created.adjustmentId, { reason: " Thiếu chứng từ " });
    expect(rejected).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Thiếu chứng từ",
      decidedBy: mockActorId(ACTOR_B),
      version: 1,
    });
    expect(rejected.decidedAt).toBeTruthy();
    expect(rejected.postedAt).toBeUndefined();
    expect(
      await captureError(rejectAdjustment(created.adjustmentId, { reason: "Lần nữa" })),
    ).toMatchObject({ status: 409, code: "INVALID_ADJUSTMENT_TRANSITION" });
    expect(await captureError(approveAdjustment(created.adjustmentId))).toMatchObject({
      code: "INVALID_ADJUSTMENT_TRANSITION",
    });
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(0);
  });

  it("only the requester withdraws; a withdrawn adjustment is closed and posts nothing", async () => {
    const created = await createAdjustment(FOUND);
    actAs(ACTOR_B);
    expect(await captureError(withdrawAdjustment(created.adjustmentId))).toMatchObject({
      status: 403,
      code: "ADJUSTMENT_NOT_REQUESTER",
    });
    actAs(ACTOR_A);
    const withdrawn = await withdrawAdjustment(created.adjustmentId);
    expect(withdrawn).toMatchObject({ status: "WITHDRAWN", version: 1 });
    expect(withdrawn.withdrawnAt).toBeTruthy();
    expect(withdrawn.decidedBy).toBeUndefined();
    expect(await captureError(withdrawAdjustment(created.adjustmentId))).toMatchObject({
      code: "INVALID_ADJUSTMENT_TRANSITION",
    });
    actAs(ACTOR_B);
    expect(await captureError(approveAdjustment(created.adjustmentId))).toMatchObject({
      status: 409,
      code: "INVALID_ADJUSTMENT_TRANSITION",
    });
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(0);
  });

  it("an unknown adjustment is 404 STOCK_ADJUSTMENT_NOT_FOUND everywhere", async () => {
    actAs(ACTOR_B);
    for (const call of [
      getAdjustment(UNKNOWN_ID),
      approveAdjustment(UNKNOWN_ID),
      rejectAdjustment(UNKNOWN_ID, { reason: "Không có" }),
      withdrawAdjustment(UNKNOWN_ID),
    ]) {
      expect(await captureError(call)).toMatchObject({
        status: 404,
        code: "STOCK_ADJUSTMENT_NOT_FOUND",
      });
    }
  });
});

describe("lists: zero-based PageResponse and filters", () => {
  it("adjustments filter by status, sku and location, newest first", async () => {
    const first = await createAdjustment(FOUND);
    const second = await createAdjustment({ ...FOUND, quantityDelta: 2 });
    const other = await createAdjustment({ ...FOUND, sku: "SKU-B", locationCode: "LOC-B" });
    actAs(ACTOR_B);
    await approveAdjustment(first.adjustmentId);

    const page0 = await listAdjustments({ page: 0, size: 2 });
    expect(page0).toMatchObject({
      page: 0,
      size: 2,
      totalElements: 3,
      totalPages: 2,
      hasNext: true,
      hasPrevious: false,
    });
    expect(page0.items.map((item) => item.adjustmentId)).toEqual([
      other.adjustmentId,
      second.adjustmentId,
    ]);
    const page1 = await listAdjustments({ page: 1, size: 2 });
    expect(page1).toMatchObject({ page: 1, hasNext: false, hasPrevious: true });
    expect(page1.items.map((item) => item.adjustmentId)).toEqual([first.adjustmentId]);

    expect(
      (await listAdjustments({ page: 0, size: 20, status: "PENDING_APPROVAL" })).totalElements,
    ).toBe(2);
    expect((await listAdjustments({ page: 0, size: 20, sku: "sku-a" })).totalElements).toBe(2);
    expect(
      (await listAdjustments({ page: 0, size: 20, location: "LOC-B" })).items.map(
        (item) => item.adjustmentId,
      ),
    ).toEqual([other.adjustmentId]);
  });

  it("movements filter by type, sku and either side of a location", async () => {
    const up = await createAdjustment(FOUND);
    const down = await createAdjustment({
      locationCode: "LOC-B",
      sku: "SKU-B",
      quantityDelta: -1,
      reason: "DAMAGED",
    });
    actAs(ACTOR_B);
    await approveAdjustment(up.adjustmentId);
    await approveAdjustment(down.adjustmentId);

    expect(await listMovements({ page: 0, size: 1, type: "ADJUSTMENT" })).toMatchObject({
      page: 0,
      size: 1,
      totalElements: 2,
      totalPages: 2,
      hasNext: true,
    });
    expect((await listMovements({ page: 1, size: 1 })).items[0]?.referenceId).toBe(up.adjustmentId);
    expect((await listMovements({ page: 0, size: 20, type: "MOVE" })).totalElements).toBe(0);
    expect((await listMovements({ page: 0, size: 20, sku: "sku-b" })).items[0]).toMatchObject({
      referenceId: down.adjustmentId,
    });
    expect(
      (await listMovements({ page: 0, size: 20, location: "LOC-B" })).items.map(
        (item) => item.fromLocation,
      ),
    ).toEqual(["LOC-B"]);
  });
});

describe("mock identity grants Inventory permission codes", () => {
  const inventoryCodes = Object.values(INVENTORY_PERMISSIONS);

  it("the default mock user can use every Inventory screen; other codes stay", async () => {
    const [defaultUser] = staffUsers;
    if (!defaultUser) throw new Error("mock-data has no staff user");
    actAs(defaultUser.userId, defaultUser.roles);
    const me = await fetchMyPermissions();
    expect(Object.keys(me).sort()).toEqual(["dataScope", "permissions", "roles"]);
    expect(me.permissions).toEqual(expect.arrayContaining(inventoryCodes));
    expect(me.permissions).toEqual(
      expect.arrayContaining([PO_PERMISSIONS.approve, GOODS_RECEIPT_PERMISSIONS.update]),
    );
  });

  it("follows the backend seed: staff request and read, only the manager approves", async () => {
    actAs(ACTOR_A, ["Warehouse Staff"]);
    const staff = (await fetchMyPermissions()).permissions;
    expect(staff).toEqual(
      expect.arrayContaining([
        INVENTORY_PERMISSIONS.adjustmentRead,
        INVENTORY_PERMISSIONS.stockUpdate,
        INVENTORY_PERMISSIONS.movementRead,
      ]),
    );
    expect(staff).not.toContain(INVENTORY_PERMISSIONS.adjustmentApprove);
    actAs(ACTOR_A, ["QC Staff"]);
    const qc = (await fetchMyPermissions()).permissions;
    inventoryCodes.forEach((codeValue) => expect(qc).not.toContain(codeValue));
  });
});
