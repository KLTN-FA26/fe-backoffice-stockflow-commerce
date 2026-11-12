/**
 * Mock routes tồn kho — chạy qua axios thật + `features/inventory/api.ts` + `transport.ts`, nên
 * kiểm luôn: đúng URL production, envelope BE, PageResponse trang 0, lỗi `errorCode` → ApiError.
 * `Math.random` cố định 0.05 → không dính lỗi 500 ngẫu nhiên của adapter (như test đơn hàng).
 *
 * Điều chỉnh là theo THÙNG (docs 20 §4.3, BR-14): LPN + chiều + lý do, không có số lượng. Thùng lấy từ sổ thùng
 * mock (`seedMockCartons`). Request mà form FE đã chặn bằng zod (OTHER thiếu giải thích, lý do từ chối trống, lý do
 * COUNT_VARIANCE) được gửi thẳng qua `inventoryRequest` để chứng minh chính mock cũng chặn, không chỉ form.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_API, INVENTORY_LIMITS } from "@/constants/inventory";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

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

import { activateMockAdapter, getMockStaffUsers } from "./mock-adapter";
import { resetReceiptMockStore } from "./mock-routes-goods-receipts-store";
import { mockActorId, resetInventoryMockState } from "./mock-routes-inventory";

import { seedMockCartons } from "@/test/mock-cartons";

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
    user: {
      userId,
      username: userId,
      fullName: userId,
      email: `${userId}@example.test`,
      roles,
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
    isAuthenticated: true,
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

const CARTON_A = "LPN-20261110-000001";
const CARTON_B = "LPN-20261110-000002";
const CARTON_LOST = "LPN-20261110-000003";

// Mỗi test bắt đầu với ba thùng: hai thùng trong kho, một thùng đã thất lạc.
let seeded: Awaited<ReturnType<typeof seedMockCartons>>;
async function seed() {
  seeded = await seedMockCartons([
    { lpn: CARTON_A, location: "HCM-A01-1-A" },
    { lpn: CARTON_B, location: "HCM-A01-1-B" },
    { lpn: CARTON_LOST, location: "HCM-A01-1-C", status: "LOST" },
  ]);
}

const DAMAGED: CreateAdjustmentInput = {
  lpn: CARTON_A,
  direction: "WRITE_OFF",
  reason: "DAMAGED",
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

beforeEach(async () => {
  actAs(ACTOR_A);
  await seed();
});

afterEach(() => {
  resetInventoryMockState();
  resetReceiptMockStore();
});

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("adjustment flow through the real client", () => {
  it("A asks to write a whole carton off, B approves, the ledger gets exactly one ADJUSTMENT line", async () => {
    const created = await createAdjustment(DAMAGED);
    expect(created).toMatchObject({
      status: "PENDING_APPROVAL",
      requestedBy: mockActorId(ACTOR_A),
      sku: seeded.sku,
      locationCode: "HCM-A01-1-A",
      // BR-14: the whole carton (its standard count), never a number the person typed
      quantityDelta: -120,
      reason: "DAMAGED",
      version: 0,
    });
    expect(created.stockPackageId).toBeTruthy();
    expect(created.cycleCountLineId).toBeUndefined();
    expect(created.number).toMatch(/^ADJ-\d{8}-0001$/);
    // Stock does not change until someone else approves (docs 20 §4.3 step 2).
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
      sku: seeded.sku,
      fromLocation: "HCM-A01-1-A",
      quantity: 120,
      reason: "DAMAGED",
      actorId: mockActorId(ACTOR_B),
    });
    expect(ledger.items[0]?.toLocation).toBeUndefined();

    expect(await getAdjustment(created.adjustmentId)).toMatchObject({ status: "POSTED" });
    const queue = await listAdjustments({ page: 0, size: 20, status: "POSTED" });
    expect(queue.items.map((item) => item.adjustmentId)).toEqual([created.adjustmentId]);
  });

  it("a written-off carton is Consumed: it cannot be written off twice", async () => {
    const created = await createAdjustment(DAMAGED);
    actAs(ACTOR_B);
    await approveAdjustment(created.adjustmentId);
    expect(await captureError(createAdjustment(DAMAGED))).toMatchObject({
      status: 409,
      code: "INVALID_STOCK_PACKAGE_TRANSITION",
    });
  });

  it("restocking a LOST carton posts a whole carton back, with the note", async () => {
    const created = await createAdjustment({
      lpn: CARTON_LOST.toLowerCase(),
      direction: "RESTOCK",
      reason: "OTHER",
      note: "Tìm thấy sau khi kiểm kê",
    });
    expect(created).toMatchObject({ quantityDelta: 120, locationCode: "HCM-A01-1-C" });
    actAs(ACTOR_B);
    await approveAdjustment(created.adjustmentId);
    const [line] = (await listMovements({ page: 0, size: 20 })).items;
    expect(line).toMatchObject({
      toLocation: "HCM-A01-1-C",
      quantity: 120,
      reason: "OTHER: Tìm thấy sau khi kiểm kê",
    });
    expect(line?.fromLocation).toBeUndefined();
    // The carton is In Stock again, so it can be written off but no longer restocked.
    expect(
      await captureError(
        createAdjustment({ lpn: CARTON_LOST, direction: "RESTOCK", reason: "FOUND" }),
      ),
    ).toMatchObject({ code: "INVALID_STOCK_PACKAGE_TRANSITION" });
  });
});

describe("four eyes", () => {
  it("the requester cannot approve: 409, still pending, no ledger line", async () => {
    const created = await createAdjustment(DAMAGED);
    const error = await captureError(approveAdjustment(created.adjustmentId));
    expect(error).toMatchObject({ status: 409, code: "ADJUSTMENT_SELF_APPROVAL" });
    expect(await getAdjustment(created.adjustmentId)).toMatchObject({ status: "PENDING_APPROVAL" });
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(0);
  });

  it("the requester cannot reject either", async () => {
    const created = await createAdjustment(DAMAGED);
    const error = await captureError(
      rejectAdjustment(created.adjustmentId, { reason: "Không hợp lệ" }),
    );
    expect(error).toMatchObject({ status: 409, code: "ADJUSTMENT_SELF_APPROVAL" });
    expect(await getAdjustment(created.adjustmentId)).toMatchObject({ status: "PENDING_APPROVAL" });
  });
});

describe("request rules enforced by the mock itself", () => {
  it.each(["COUNT_VARIANCE", "EXPIRED", "SCRAP", "SAMPLE", "SUBCONTRACT_LOSS"])(
    "reason %s is refused and nothing is stored",
    async (reason) => {
      // COUNT_VARIANCE only a cycle count asks for; the others are legacy (docs 20 BR-04).
      const error = await captureError(postRaw({ lpn: CARTON_A, direction: "WRITE_OFF", reason }));
      expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
      expect((await listAdjustments({ page: 0, size: 20 })).totalElements).toBe(0);
    },
  );

  it("OTHER needs an explanation; a blank note is refused", async () => {
    const base = { lpn: CARTON_A, direction: "WRITE_OFF", reason: "OTHER" };
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
    const error = await captureError(postRaw({}));
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(Object.keys(error.fieldErrors ?? {}).sort()).toEqual(["direction", "lpn", "reason"]);
    expect(
      await captureError(postRaw({ lpn: "L".repeat(31), direction: "WRITE_OFF", reason: "LOST" })),
    ).toMatchObject({ status: 400, fieldErrors: { lpn: "lpn is at most 30 characters" } });
    // A quantity is not part of the request any more: an unknown direction is an unreadable body.
    expect(
      await captureError(postRaw({ lpn: CARTON_A, direction: "ADD", reason: "LOST" })),
    ).toMatchObject({ status: 400, code: "MALFORMED_REQUEST" });
  });

  it("an unknown carton is 404; a carton in the wrong state is 409", async () => {
    expect(await captureError(createAdjustment({ ...DAMAGED, lpn: "LPN-NOPE" }))).toMatchObject({
      status: 404,
      code: "STOCK_PACKAGE_NOT_FOUND",
    });
    // A write-off needs a carton in stock; a restock needs one that is lost.
    expect(await captureError(createAdjustment({ ...DAMAGED, lpn: CARTON_LOST }))).toMatchObject({
      status: 409,
      code: "INVALID_STOCK_PACKAGE_TRANSITION",
    });
    expect(
      await captureError(createAdjustment({ ...DAMAGED, direction: "RESTOCK" })),
    ).toMatchObject({ status: 409, code: "INVALID_STOCK_PACKAGE_TRANSITION" });
  });

  it("one adjustment of a carton waits at a time", async () => {
    await createAdjustment(DAMAGED);
    expect(await captureError(createAdjustment({ ...DAMAGED, reason: "LOST" }))).toMatchObject({
      status: 409,
      code: "STOCK_PACKAGE_ADJUSTMENT_PENDING",
    });
  });

  it("a rejection reason is required and at most the backend length", async () => {
    const created = await createAdjustment(DAMAGED);
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
    const created = await createAdjustment(DAMAGED);
    actAs(ACTOR_B);
    await approveAdjustment(created.adjustmentId);
    expect(await captureError(approveAdjustment(created.adjustmentId))).toMatchObject({
      status: 409,
      code: "INVALID_ADJUSTMENT_TRANSITION",
    });
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(1);
  });

  it("reject fills the decision fields; a rejected adjustment is closed and frees the carton", async () => {
    const created = await createAdjustment(DAMAGED);
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
    // Nothing waits on the carton any more: it can be asked for again.
    expect(await createAdjustment({ ...DAMAGED, reason: "LOST" })).toMatchObject({
      status: "PENDING_APPROVAL",
    });
  });

  it("only the requester withdraws; a withdrawn adjustment is closed and posts nothing", async () => {
    const created = await createAdjustment(DAMAGED);
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
    const first = await createAdjustment(DAMAGED);
    const second = await createAdjustment({
      lpn: CARTON_LOST,
      direction: "RESTOCK",
      reason: "FOUND",
    });
    const other = await createAdjustment({ ...DAMAGED, lpn: CARTON_B });
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
    // Cartons of the seeded receipt line share its SKU; the filter is exact and case-insensitive.
    expect(
      (await listAdjustments({ page: 0, size: 20, sku: seeded.sku.toLowerCase() })).totalElements,
    ).toBe(3);
    expect((await listAdjustments({ page: 0, size: 20, sku: "NO-SUCH-SKU" })).totalElements).toBe(
      0,
    );
    expect(
      (await listAdjustments({ page: 0, size: 20, location: "HCM-A01-1-B" })).items.map(
        (item) => item.adjustmentId,
      ),
    ).toEqual([other.adjustmentId]);
  });

  it("movements filter by type, sku and either side of a location", async () => {
    const down = await createAdjustment(DAMAGED);
    const up = await createAdjustment({ lpn: CARTON_LOST, direction: "RESTOCK", reason: "FOUND" });
    actAs(ACTOR_B);
    await approveAdjustment(down.adjustmentId);
    await approveAdjustment(up.adjustmentId);

    expect(await listMovements({ page: 0, size: 1, type: "ADJUSTMENT" })).toMatchObject({
      page: 0,
      size: 1,
      totalElements: 2,
      totalPages: 2,
      hasNext: true,
    });
    expect((await listMovements({ page: 1, size: 1 })).items[0]?.referenceId).toBe(
      down.adjustmentId,
    );
    expect((await listMovements({ page: 0, size: 20, type: "MOVE" })).totalElements).toBe(0);
    expect(
      (await listMovements({ page: 0, size: 20, sku: seeded.sku.toLowerCase() })).totalElements,
    ).toBe(2);
    expect(
      (await listMovements({ page: 0, size: 20, location: "HCM-A01-1-A" })).items.map(
        (item) => item.fromLocation,
      ),
    ).toEqual(["HCM-A01-1-A"]);
  });
});

describe("Inventory uses the authenticated mock session identity", () => {
  it("uses the session user ID despite frontend role impersonation", async () => {
    const [user] = await getMockStaffUsers();
    if (!user) throw new Error("Missing mock staff");
    useAuthStore.getState().login(
      {
        userId: user.userId,
        username: user.email,
        fullName: user.fullName,
        email: user.email,
        roles: user.roles,
        status: "ACTIVE",
        lastLoginAt: null,
        mustChangePassword: false,
      },
      false,
    );
    useAuthStore.getState().setImpersonatedRole("QC Staff");
    const created = await createAdjustment(DAMAGED);
    expect(created.requestedBy).toBe(mockActorId(user.userId));
    expect(await withdrawAdjustment(created.adjustmentId)).toMatchObject({ status: "WITHDRAWN" });
  });
});
