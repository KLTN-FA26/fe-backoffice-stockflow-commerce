/**
 * Contract test: mock adapter nói đúng hợp đồng BE `PutawayController` (docs 05) để `api.ts` (zod parse + ApiError)
 * chạy y hệt trên mock và BE thật — bắt buộc kho / phiếu, bin gợi ý xếp nhóm, lỗi xác nhận đúng thứ tự BE, cất xong
 * thì đổi gợi ý của thùng cùng lô và đóng phiếu khi thùng cuối được cất.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetMockCartonLedger } from "@/lib/api/mock-inventory-cartons";
import { resetPutawayMockStore } from "@/lib/api/mock-putaway-store";
import {
  getReceiptStore,
  MOCK_WAREHOUSE_ID,
  resetReceiptMockStore,
} from "@/lib/api/mock-routes-goods-receipts-store";
import { resetWarehouseMockStore } from "@/lib/api/mock-warehouse-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import { confirmPutaway, getPutawayTask, listPutawayTasks } from "../api";

import type { PutawayTask } from "../types";

vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;

/** USER-WH-01 = nhân viên kho (cất được); USER-QC-01 không có quyền cất hàng (`mock-user-grants`). */
function signIn(userId: "USER-WH-01" | "USER-QC-01") {
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

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
  throw new Error("expected the call to fail");
}

const confirm = (task: PutawayTask, lpn: string, locationCode: string) =>
  confirmPutaway({
    taskId: task.id,
    values: { lpn, locationCode },
    idempotencyKey: crypto.randomUUID(),
  });

async function pending(): Promise<PutawayTask[]> {
  return (await listPutawayTasks({ warehouseId: MOCK_WAREHOUSE_ID })).items;
}

beforeAll(() => {
  // 0.5: tránh nhánh lỗi ngẫu nhiên 5% của mock adapter, trễ cố định ~350ms
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(console, "info").mockImplementation(() => {});
  activateMockAdapter();
});

afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

beforeEach(() => {
  resetReceiptMockStore();
  resetPutawayMockStore();
  resetWarehouseMockStore();
  resetMockCartonLedger();
  signIn("USER-WH-01");
});

describe("putaway mock ↔ hợp đồng BE PutawayController", () => {
  it("danh sách bắt buộc kho hoặc phiếu nhập → 400 VALIDATION_FAILED", async () => {
    expect(await codeOf(listPutawayTasks({}))).toBe("VALIDATION_FAILED");
  });

  it("theo kho: thùng chờ cất ở khu nhận, chỉ PENDING, danh sách không kèm gợi ý", async () => {
    const rows = await pending();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.status === "PENDING" && t.sourceLocationCode === "HCM-RCV01")).toBe(
      true,
    );
    expect(rows.every((t) => t.suggestions.length === 0 && t.source === "RECEIPT")).toBe(true);
  });

  it("chi tiết: tối đa 10 bin gợi ý, kho trống → toàn bin EMPTY, hoà thì theo mã", async () => {
    const [first] = await pending();
    if (!first) throw new Error("no pending task in the mock seed");
    const detail = await getPutawayTask(first.id);
    expect(detail.suggestions.length).toBeGreaterThan(0);
    expect(detail.suggestions.length).toBeLessThanOrEqual(10);
    expect(detail.suggestions.every((s) => s.reason === "EMPTY")).toBe(true);
    const codes = detail.suggestions.map((s) => s.locationCode);
    expect(codes).toEqual([...codes].sort());
  });

  it("xác nhận: sai thùng, vị trí lạ, khu không phải bin → lỗi đúng mã BE", async () => {
    const [first, second] = await pending();
    if (!first || !second) throw new Error("need two pending tasks");
    expect(await codeOf(confirm(first, second.lpn ?? "", "HCM-A01-1-A"))).toBe(
      "PUTAWAY_LPN_MISMATCH",
    );
    expect(await codeOf(confirm(first, first.lpn ?? "", "HCM-ZZZ"))).toBe("LOCATION_NOT_FOUND");
    expect(await codeOf(confirm(first, first.lpn ?? "", "HCM-RCV01"))).toBe(
      "PUTAWAY_TARGET_NOT_BIN",
    );
  });

  it("cất xong: DONE + bin đích; thùng cùng lô được gợi ý đúng bin đó với lý do SAME_LOT (BR-05)", async () => {
    const rows = await pending();
    const first = rows[0];
    const sameLot = rows.find((t) => t.id !== first?.id && t.lotNumber === first?.lotNumber);
    if (!first || !sameLot) throw new Error("need two tasks of one lot");
    const done = await confirm(first, (first.lpn ?? "").toLowerCase(), "hcm-a02-2-b");
    expect(done).toMatchObject({ status: "DONE", targetLocationCode: "HCM-A02-2-B", left: 0 });
    expect(await codeOf(confirm(first, first.lpn ?? "", "HCM-A01-1-A"))).toBe("PUTAWAY_TASK_DONE");

    const next = await getPutawayTask(sameLot.id);
    expect(next.suggestions[0]).toMatchObject({ locationCode: "HCM-A02-2-B", reason: "SAME_LOT" });
    expect((await pending()).some((t) => t.id === first.id)).toBe(false);
    const byReceipt = await listPutawayTasks({ receiptId: first.goodsReceiptId ?? "" });
    expect(byReceipt.items.find((t) => t.id === first.id)?.status).toBe("DONE");
  });

  it("thùng cuối của phiếu được cất → phiếu In Putaway thành Closed (docs 05 §4.4 bước 9)", async () => {
    const [first] = await pending();
    const receiptId = first?.goodsReceiptId;
    if (!receiptId) throw new Error("no receipt task");
    const ofReceipt = (await listPutawayTasks({ receiptId })).items;
    for (const t of ofReceipt) {
      const best = (await getPutawayTask(t.id)).suggestions[0];
      await confirm(t, t.lpn ?? "", best?.locationCode ?? "");
    }
    expect((await getReceiptStore()).get(receiptId)?.status).toBe("CLOSED");
  });

  it("người không có quyền cất hàng → 403", async () => {
    signIn("USER-QC-01");
    expect(await codeOf(listPutawayTasks({ warehouseId: MOCK_WAREHOUSE_ID }))).toBe("FORBIDDEN");
  });
});
