/**
 * Mock routes kiểm kê theo thùng — chạy qua axios thật + `features/inventory/cycle-count-api.ts` + `transport.ts`, nên
 * kiểm luôn: đúng URL production, envelope BE, PageResponse trang 0, lỗi `errorCode` → ApiError.
 *
 * Luồng chính của WF4-X01 ở tầng mock: lập phiếu → đếm không thấy thùng → nộp → sinh COUNT_VARIANCE chờ duyệt → quản
 * lý khác duyệt → thùng `Lost`, sổ kho có đúng một dòng ADJUSTMENT. Người đếm (nhân viên kho) không thấy sổ sách.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { CYCLE_COUNT_API } from "@/constants/cycle-count";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import {
  addCycleCountLine,
  cancelCycleCount,
  countCycleCountLine,
  getCycleCount,
  listCycleCounts,
  recountCycleCount,
  submitCycleCount,
} from "@/features/inventory/cycle-count-api";
import { cycleCountDto } from "@/features/inventory/cycle-count-schemas";

import {
  approveAdjustment,
  getAdjustment,
  listMovements,
  rejectAdjustment,
} from "@/features/inventory/api";
import { inventoryRequest } from "@/features/inventory/transport";

import { seedMockCartons } from "@/test/mock-cartons";

import { activateMockAdapter } from "./mock-adapter";
import { resetReceiptMockStore } from "./mock-routes-goods-receipts-store";
import { mockActorId, resetInventoryMockState } from "./mock-routes-inventory";

// Mỗi request mock trễ ~215ms (Math.random = 0.05).
vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;
// Demo grants (mock-user-grants.ts, mirrors the BE seeds): USER-WH-01 counts; USER-ADMIN-01 plans and decides.
const COUNTER = "USER-WH-01";
const MANAGER = "USER-ADMIN-01";
const BIN_A = "HCM-A01-1-A";
const BIN_B = "HCM-A01-1-B";
const LPN_1 = "LPN-20261110-000001";
const LPN_2 = "LPN-20261110-000002";
const LPN_LOST = "LPN-20261110-000003";
const LPN_B = "LPN-20261110-000004";

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      username: userId,
      fullName: userId,
      email: `${userId}@example.test`,
      roles: [],
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

/** `POST /inventory/cycle-counts` — lập phiếu (quản lý kho); FE chưa có màn lập phiếu nên không có hàm riêng. */
const plannedDto = z.object({
  count: cycleCountDto,
  skipped: z.array(z.object({ lpn: z.string(), countNumber: z.string() })),
});
function plan(body: Record<string, unknown>) {
  return inventoryRequest({ url: CYCLE_COUNT_API.list, method: "POST", data: body }, plannedDto);
}

function withdraw(adjustmentId: string) {
  return inventoryRequest(
    { url: `/inventory/adjustments/${adjustmentId}/withdrawal`, method: "POST" },
    z.unknown(),
  );
}

let sku = "";
beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(async () => {
  actAs(MANAGER);
  ({ sku } = await seedMockCartons([
    { lpn: LPN_1, location: BIN_A },
    { lpn: LPN_2, location: BIN_A },
    { lpn: LPN_LOST, location: BIN_B, status: "LOST" },
    { lpn: LPN_B, location: BIN_B },
  ]));
});
afterEach(() => {
  resetInventoryMockState();
  resetReceiptMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

const planBinA = (extra: Record<string, unknown> = {}) =>
  plan({ scope: { locationCodes: [BIN_A] }, ...extra });

describe("planning a blind count over cartons (docs 20 §4.2 a)", () => {
  it("makes one Planned line per carton in stock, blind by default, and skips none", async () => {
    const { count, skipped } = await planBinA({ note: "Kiểm kệ A" });
    expect(count).toMatchObject({ status: "PLANNED", blind: true, triggerType: "MANUAL" });
    expect(count.lines.map((line) => line.lpn).sort()).toEqual([LPN_1, LPN_2]);
    expect(count.lines.every((line) => line.found == null && line.booked === true)).toBe(true);
    expect(count.countNumber).toMatch(/^CC-\d{8}-0001$/);
    expect(skipped).toEqual([]);
  });

  it("a carton lives on one count at a time: a second plan skips it and names the first (BR-10)", async () => {
    const first = await planBinA();
    // Every carton of the SKU: the two already counted are left out and listed back for the planner.
    const second = await plan({ scope: { skus: [sku] } });
    expect(second.count.lines.map((line) => line.lpn)).toEqual([LPN_B]);
    expect(second.skipped.map((slot) => slot.lpn).sort()).toEqual([LPN_1, LPN_2]);
    expect(second.skipped.every((slot) => slot.countNumber === first.count.countNumber)).toBe(true);
    // Nothing is left to plan once every carton of the bin is on a count.
    expect(await captureError(planBinA())).toMatchObject({
      status: 422,
      code: "CYCLE_COUNT_EMPTY_SCOPE",
    });
  });

  it("refuses an empty scope and a plan by someone without CREATE", async () => {
    expect(await captureError(plan({ scope: {} }))).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
    });
    expect(await captureError(plan({ scope: { locationCodes: ["HCM-NOWHERE"] } }))).toMatchObject({
      status: 422,
      code: "CYCLE_COUNT_EMPTY_SCOPE",
    });
    actAs(COUNTER);
    expect(await captureError(planBinA())).toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});

describe("blind (docs 20 BR-07)", () => {
  it("the counter never receives the books, the note, the adjustments or a variance count", async () => {
    const { count } = await planBinA({ note: "Ghi chú của quản lý" });
    actAs(COUNTER);
    const seen = await getCycleCount(count.id);
    expect(seen.note).toBeUndefined();
    expect(seen.lines.every((line) => line.booked == null)).toBe(true);
    const [summary] = (await listCycleCounts({ page: 0, size: 20 })).items;
    expect(summary).toMatchObject({ lineCount: 2, countedCount: 0 });
    expect(summary?.varianceCount).toBeUndefined();
    expect(summary?.note).toBeUndefined();

    actAs(MANAGER);
    const manager = await getCycleCount(count.id);
    expect(manager.note).toBe("Ghi chú của quản lý");
    expect(manager.lines.every((line) => line.booked === true)).toBe(true);
    expect((await listCycleCounts({ page: 0, size: 20 })).items[0]?.varianceCount).toBe(0);
  });
});

describe("WF4-X01: the carton is not on the shelf (docs 20 §4.2, §4.3)", () => {
  it("count → submit → COUNT_VARIANCE for the whole carton → another person approves → Lost + one ledger line", async () => {
    const { count } = await planBinA();
    const [found, missing] = count.lines;
    if (!found || !missing) throw new Error("expected two lines");
    actAs(COUNTER);
    // A line is stated present or not found, never in units.
    expect((await countCycleCountLine(count.id, found.id, { found: true })).status).toBe(
      "IN_PROGRESS",
    );
    // Submitting before every carton is counted is refused and the sheet stays open.
    expect(await captureError(submitCycleCount(count.id))).toMatchObject({
      status: 409,
      code: "CYCLE_COUNT_LINE_NOT_COUNTED",
    });
    await countCycleCountLine(count.id, missing.id, { found: false });
    const submitted = await submitCycleCount(count.id);
    expect(submitted.status).toBe("COMPLETED");
    // The counter's own copy shows no adjustment (blind) — and nothing moved in stock yet (BR-08).
    expect(submitted.lines.every((line) => !line.adjustments?.length)).toBe(true);
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(0);

    actAs(MANAGER);
    const reviewed = await getCycleCount(count.id);
    const variance = reviewed.lines.find((line) => line.id === missing.id)?.adjustments;
    expect(variance).toHaveLength(1);
    expect(variance?.[0]).toMatchObject({ quantityDelta: -120, status: "PENDING_APPROVAL" });
    expect(reviewed.lines.find((line) => line.id === found.id)?.adjustments).toEqual([]);
    const adjustmentId = variance?.[0]?.id ?? "";
    expect(await getAdjustment(adjustmentId)).toMatchObject({
      reason: "COUNT_VARIANCE",
      sku,
      quantityDelta: -120,
      requestedBy: mockActorId(COUNTER),
      cycleCountLineId: missing.id,
    });

    // The counter cannot decide the variance of the line they counted, whoever asked (docs 20 BR-05).
    actAs(COUNTER);
    expect(await captureError(approveAdjustment(adjustmentId))).toMatchObject({
      status: 409,
      code: "ADJUSTMENT_SELF_APPROVAL",
    });

    actAs(MANAGER);
    expect(await approveAdjustment(adjustmentId)).toMatchObject({ status: "POSTED" });
    const ledger = (await listMovements({ page: 0, size: 20 })).items;
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ type: "ADJUSTMENT", quantity: 120, fromLocation: BIN_A });
    // The carton is Lost now: it cannot be written off again, only restocked.
    expect(
      (await getCycleCount(count.id)).lines.find((line) => line.id === missing.id)
        ?.adjustments?.[0],
    ).toMatchObject({ status: "POSTED" });
  });

  it("a COUNT_VARIANCE cannot be withdrawn by whoever submitted it (docs 20 BR-06)", async () => {
    const { count } = await planBinA();
    actAs(COUNTER);
    for (const line of count.lines) await countCycleCountLine(count.id, line.id, { found: false });
    await submitCycleCount(count.id);
    actAs(MANAGER);
    const id = (await getCycleCount(count.id)).lines[0]?.adjustments?.[0]?.id ?? "";
    actAs(COUNTER);
    const error = await captureError(withdraw(id));
    expect(error).toMatchObject({ status: 409, code: "COUNT_VARIANCE_NOT_WITHDRAWABLE" });
  });

  it("a rejected variance can be recounted: a new blind sheet, the old line marked sent", async () => {
    const { count } = await planBinA();
    actAs(COUNTER);
    for (const line of count.lines) await countCycleCountLine(count.id, line.id, { found: false });
    await submitCycleCount(count.id);
    actAs(MANAGER);
    const [first, second] = (await getCycleCount(count.id)).lines;
    if (!first || !second) throw new Error("expected two lines");
    await rejectAdjustment(first.adjustments?.[0]?.id ?? "", { reason: "Nghi đếm sai" });
    // The other variance still waits: it cannot be recounted, nor can a line without a rejected variance.
    expect(await captureError(recountCycleCount(count.id, { lineIds: [second.id] }))).toMatchObject(
      {
        status: 409,
      },
    );
    const recount = await recountCycleCount(count.id, {
      lineIds: [first.id],
      note: "Đếm lại kệ A",
    });
    expect(recount).toMatchObject({ status: "PLANNED", blind: true });
    expect(recount.note).toContain(count.countNumber);
    expect(recount.lines.map((line) => line.lpn)).toEqual([first.lpn]);
    const old = await getCycleCount(count.id);
    expect(old.status).toBe("COMPLETED");
    expect(old.lines.find((line) => line.id === first.id)?.recountRequired).toBe(true);
    // The old line cannot be sent twice.
    expect(await captureError(recountCycleCount(count.id, { lineIds: [first.id] }))).toMatchObject({
      status: 409,
    });
  });
});

describe("counting rules", () => {
  it("a carton the plan did not list is added at the bin it is recorded at (docs 20 §4.2 b5)", async () => {
    const { count } = await planBinA();
    const added = await addCycleCountLine(count.id, { locationCode: BIN_B, lpn: LPN_B });
    expect(added.lines.find((line) => line.lpn === LPN_B)).toMatchObject({
      locationCode: BIN_B,
      found: true,
      booked: true,
    });
    // A LOST carton found again is the surplus a count restocks: found, not booked.
    const surplus = await addCycleCountLine(count.id, { locationCode: BIN_B, lpn: LPN_LOST });
    expect(surplus.lines.find((line) => line.lpn === LPN_LOST)).toMatchObject({
      found: true,
      booked: false,
    });
    // A carton recorded elsewhere is a misplacement for the manager to move, not a count line.
    expect(
      await captureError(addCycleCountLine(count.id, { locationCode: BIN_A, lpn: LPN_B })),
    ).toMatchObject({ status: 422, code: "STOCK_PACKAGE_WRONG_LOCATION" });
    expect(
      await captureError(addCycleCountLine(count.id, { locationCode: BIN_A, lpn: "LPN-NOPE" })),
    ).toMatchObject({ status: 404, code: "STOCK_PACKAGE_NOT_FOUND" });
  });

  it("a carton on another open count cannot be added (BR-10)", async () => {
    const first = await planBinA();
    const other = await plan({ scope: { locationCodes: [BIN_B] } });
    expect(first.count.lines).toHaveLength(2);
    expect(
      await captureError(addCycleCountLine(other.count.id, { locationCode: BIN_A, lpn: LPN_1 })),
    ).toMatchObject({ status: 409, code: "CYCLE_COUNT_SLOT_BUSY" });
  });

  it("found is required; an unknown line is 404; a closed sheet takes no counts", async () => {
    const { count } = await planBinA();
    const line = count.lines[0];
    if (!line) throw new Error("expected a line");
    expect(
      await captureError(
        inventoryRequest(
          {
            url: CYCLE_COUNT_API.line(count.id, line.id),
            method: "PUT",
            data: { countedQty: 3 },
          },
          cycleCountDto,
        ),
      ),
    ).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(
      await captureError(
        countCycleCountLine(count.id, "00000000-0000-4000-8000-0000000000ff", { found: true }),
      ),
    ).toMatchObject({ status: 404 });
    await cancelCycleCount(count.id, { reason: "Hết cần" });
    expect(
      await captureError(countCycleCountLine(count.id, line.id, { found: true })),
    ).toMatchObject({ status: 409, code: "CYCLE_COUNT_NOT_OPEN" });
  });

  it("cancelling needs APPROVE and a reason; the counter cannot", async () => {
    const { count } = await planBinA();
    actAs(COUNTER);
    expect(await captureError(cancelCycleCount(count.id, { reason: "x" }))).toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    actAs(MANAGER);
    const cancelled = await cancelCycleCount(count.id, { reason: "Kiểm lại sau" });
    expect(cancelled.status).toBe("CANCELLED");
    expect(await captureError(cancelCycleCount(count.id, { reason: "Lần nữa" }))).toMatchObject({
      code: "CYCLE_COUNT_NOT_OPEN",
    });
  });

  it("a count handed to someone else is theirs alone to count (docs 20 BR-12)", async () => {
    const { count } = await planBinA({ assignedUserId: mockActorId("USER-WH-02") });
    const line = count.lines[0];
    if (!line) throw new Error("expected a line");
    actAs(COUNTER);
    expect(await captureError(countFound(count.id, line.id))).toMatchObject({
      status: 403,
      code: "CYCLE_COUNT_NOT_ASSIGNEE",
    });
    actAs(MANAGER);
    expect((await countCycleCountLine(count.id, line.id, { found: true })).status).toBe(
      "IN_PROGRESS",
    );
  });

  it("filters by status and pages from zero", async () => {
    const { count } = await planBinA();
    await cancelCycleCount(count.id, { reason: "Lập lại" });
    await planBinA();
    expect((await listCycleCounts({ page: 0, size: 20, status: "CANCELLED" })).totalElements).toBe(
      1,
    );
    expect(await listCycleCounts({ page: 0, size: 1 })).toMatchObject({
      page: 0,
      size: 1,
      totalElements: 2,
      totalPages: 2,
      hasNext: true,
      hasPrevious: false,
    });
  });
});

function countFound(id: string, lineId: string) {
  return countCycleCountLine(id, lineId, { found: true });
}
