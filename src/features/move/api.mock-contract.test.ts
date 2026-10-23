/**
 * Contract test: the mock `POST /inventory/movements` speaks the BE contract (MoveStockRequest /
 * StockMoveResponse, StockOperationsServiceImpl.relocate order of checks, idempotent on requestId),
 * so `api.ts` (zod parse + ApiError) behaves the same on the mock and on the real backend.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MOVE_API } from "@/constants/move";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetInventoryMockState } from "@/lib/api/mock-routes-inventory";
import { useAuthStore } from "@/lib/auth/auth-store";

import { createMove, listStockRows } from "./api";

import type { MoveCreateInput } from "./types";

// Each mock request waits ~215 ms (Math.random fixed at 0.05).
vi.setConfig({ testTimeout: 20_000 });

const originalAdapter = api.defaults.adapter;
const MOVE: MoveCreateInput = {
  sku: "cup-pp-500",
  fromLocation: "hcm-a01-1-a",
  toLocation: "HCM-PACK01",
  quantity: 5,
};

function signIn() {
  useAuthStore.setState({
    user: {
      userId: "MOCK-MOVER",
      username: "mover",
      fullName: "Mover",
      email: "mover@example.test",
      roles: ["Warehouse Staff"],
      status: "ACTIVE",
      lastLoginAt: null,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
}

async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error: unknown) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error("Expected the request to fail");
}

/** Raw body through the production client: bypasses the form's zod, not the mock. */
async function postRaw(body: Record<string, unknown>) {
  const { data } = await api.post<unknown>(MOVE_API.move, body);
  return data;
}

async function ledger() {
  const { data } = await api.get<{ items: Array<Record<string, unknown>>; totalElements: number }>(
    MOVE_API.move,
    { params: { type: "MOVE", page: 0, size: 20 } },
  );
  return data;
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(signIn);
afterEach(() => resetInventoryMockState());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("POST /inventory/movements (mock)", () => {
  it("returns a StockMoveResponse with codes upper-cased and writes one MOVE ledger line", async () => {
    const move = await createMove(MOVE, crypto.randomUUID());
    expect(move).toMatchObject({
      sku: "CUP-PP-500",
      fromLocation: "HCM-A01-1-A",
      toLocation: "HCM-PACK01",
      quantity: 5,
    });
    expect(move.lotNumber).toBeUndefined();
    const lines = await ledger();
    expect(lines.totalElements).toBe(1);
    expect(lines.items[0]).toMatchObject({
      type: "MOVE",
      referenceType: "MOVE_TASK",
      movementId: move.movementId,
    });
    // StockMovementResponse.reason is null for a plain move → omitted.
    expect(lines.items[0]).not.toHaveProperty("reason");
  });

  it("is idempotent on requestId: a retry returns the move already made, no second line", async () => {
    const requestId = crypto.randomUUID();
    const first = await createMove(MOVE, requestId);
    const again = await createMove(MOVE, requestId);
    expect(again.movementId).toBe(first.movementId);
    expect((await ledger()).totalElements).toBe(1);
    const other = await createMove(MOVE, crypto.randomUUID());
    expect(other.movementId).not.toBe(first.movementId);
    expect((await ledger()).totalElements).toBe(2);
  });

  it("two different locations (400 VALIDATION_FAILED)", async () => {
    const error = await failureOf(
      postRaw({ ...MOVE, requestId: crypto.randomUUID(), toLocation: " HCM-A01-1-A" }),
    );
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
  });

  it("docs 11 BR-01: another warehouse is 409 MOVE_ACROSS_WAREHOUSES", async () => {
    const error = await failureOf(
      postRaw({ ...MOVE, requestId: crypto.randomUUID(), toLocation: "HN-PACK01" }),
    );
    expect(error).toMatchObject({ status: 409, code: "MOVE_ACROSS_WAREHOUSES" });
  });

  it("@Valid: required fields and bounds come back as fieldErrors", async () => {
    const error = await failureOf(
      postRaw({ sku: "", fromLocation: "", toLocation: "X".repeat(65), quantity: 0 }),
    );
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(Object.keys(error.fieldErrors ?? {}).sort()).toEqual([
      "fromLocation",
      "quantity",
      "requestId",
      "sku",
      "toLocation",
    ]);
    const tooMany = await failureOf(
      postRaw({ ...MOVE, requestId: crypto.randomUUID(), quantity: 1_000_001 }),
    );
    expect(tooMany.fieldErrors).toHaveProperty("quantity");
  });

  it("a body Jackson cannot read is 400 MALFORMED_REQUEST", async () => {
    const notUuid = await failureOf(postRaw({ ...MOVE, requestId: "not-a-uuid" }));
    expect(notUuid).toMatchObject({ status: 400, code: "MALFORMED_REQUEST" });
    const fractional = await failureOf(
      postRaw({ ...MOVE, requestId: crypto.randomUUID(), quantity: 1.5 }),
    );
    expect(fractional).toMatchObject({ status: 400, code: "MALFORMED_REQUEST" });
  });

  it("needs a session", async () => {
    useAuthStore.setState({ user: null, status: "unauthenticated", isAuthenticated: false });
    const error = await failureOf(createMove(MOVE, crypto.randomUUID()));
    expect(error.status).toBe(401);
  });

  it("GET /inventory/stock-items is an empty list: the mock holds no stock", async () => {
    expect(await listStockRows("CUP-PP-500")).toEqual([]);
  });
});
