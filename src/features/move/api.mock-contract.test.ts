/**
 * Contract test: the mock `POST /inventory/movements` speaks the BE contract (MoveStockPackagesRequest /
 * MovedStockPackageResponse, StockOperationsServiceImpl.relocatePackages: whole cartons by LPN, all or none, idempotent
 * on requestId), so `api.ts` (zod parse + ApiError) behaves the same on the mock and on the real backend.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { MOVE_API } from "@/constants/move";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetInventoryMockState } from "@/lib/api/mock-routes-inventory";
import { useAuthStore } from "@/lib/auth/auth-store";

import { createMove, getCarton, listCartons } from "./api";

// Each mock request waits ~215 ms (Math.random fixed at 0.05).
vi.setConfig({ testTimeout: 20_000 });

const originalAdapter = api.defaults.adapter;
// Thùng tồn đầu kỳ của mock (seed BE V20261111000110): 1–25 ở HCM-A01-2-B, 26–33 ở HCM-A02-1-A, 46–75 cách ly ở HCM-QC01.
const lpn = (n: number) => `LPN-20261111-${String(n).padStart(6, "0")}`;
const TO = "HCM-A02-1-A";

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
      mustChangePassword: false,
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
  it("moves whole cartons, answers MovedStockPackageResponse[] and writes one MOVE line per carton", async () => {
    const moved = await createMove(
      { lpns: [lpn(1), lpn(2).toLowerCase()], toLocation: TO.toLowerCase() },
      crypto.randomUUID(),
    );
    expect(moved).toEqual([
      expect.objectContaining({
        lpn: lpn(1),
        sku: "CUP-PP-500",
        locationCode: TO,
        status: "IN_STOCK",
      }),
      expect.objectContaining({ lpn: lpn(2), locationCode: TO }),
    ]);
    expect((await getCarton(lpn(1))).locationCode).toBe(TO);
    const lines = await ledger();
    expect(lines.totalElements).toBe(2);
    expect(lines.items[0]).toMatchObject({
      type: "MOVE",
      referenceType: "MOVE_TASK",
      fromLocation: "HCM-A01-2-B",
      toLocation: TO,
    });
  });

  it("is idempotent on requestId: a retry answers the cartons already moved, no second line", async () => {
    const requestId = crypto.randomUUID();
    const first = await createMove({ lpns: [lpn(1), lpn(2)], toLocation: TO }, requestId);
    // Cùng tập thùng, khác thứ tự → cùng lệnh
    const again = await createMove({ lpns: [lpn(2), lpn(1)], toLocation: TO }, requestId);
    expect(again.map((row) => row.lpn).sort()).toEqual(first.map((row) => row.lpn).sort());
    expect((await ledger()).totalElements).toBe(2);
  });

  it("the same requestId for other cartons or another place is 422 IDEMPOTENCY_KEY_REUSED", async () => {
    const requestId = crypto.randomUUID();
    await createMove({ lpns: [lpn(1)], toLocation: TO }, requestId);
    const otherCartons = await failureOf(
      createMove({ lpns: [lpn(1), lpn(2)], toLocation: TO }, requestId),
    );
    expect(otherCartons).toMatchObject({ status: 422, code: "IDEMPOTENCY_KEY_REUSED" });
    const otherPlace = await failureOf(
      createMove({ lpns: [lpn(1)], toLocation: "HCM-B01-1-A" }, requestId),
    );
    expect(otherPlace).toMatchObject({ status: 422, code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("all or none: one unknown LPN is 404 and no carton moves", async () => {
    const error = await failureOf(
      createMove({ lpns: [lpn(1), "LPN-NOPE"], toLocation: TO }, crypto.randomUUID()),
    );
    expect(error).toMatchObject({ status: 404, code: "STOCK_PACKAGE_NOT_FOUND" });
    expect((await getCarton(lpn(1))).locationCode).toBe("HCM-A01-2-B");
    expect((await ledger()).totalElements).toBe(0);
  });

  it("a carton already at the destination is VALIDATION_FAILED, nothing moves", async () => {
    const error = await failureOf(
      createMove({ lpns: [lpn(26), lpn(1)], toLocation: TO }, crypto.randomUUID()),
    );
    expect(error.code).toBe("VALIDATION_FAILED");
    expect((await getCarton(lpn(1))).locationCode).toBe("HCM-A01-2-B");
  });

  it("docs 11 BR-01: another warehouse is 409 MOVE_ACROSS_WAREHOUSES", async () => {
    const error = await failureOf(
      createMove({ lpns: [lpn(1)], toLocation: "HN-A01-1-A" }, crypto.randomUUID()),
    );
    expect(error).toMatchObject({ status: 409, code: "MOVE_ACROSS_WAREHOUSES" });
  });

  it("docs 11 BR-09: a staging area is 409 STAGING_MOVE_NOT_ALLOWED", async () => {
    const error = await failureOf(
      createMove({ lpns: [lpn(1)], toLocation: "HCM-STAGE-01" }, crypto.randomUUID()),
    );
    expect(error).toMatchObject({ status: 409, code: "STAGING_MOVE_NOT_ALLOWED" });
  });

  it("docs 20 BR-21: quarantined stock leaves quarantine by its release, not a hand move", async () => {
    const out = await failureOf(
      createMove({ lpns: [lpn(46)], toLocation: TO }, crypto.randomUUID()),
    );
    expect(out).toMatchObject({ status: 409, code: "STOCK_PACKAGE_QUARANTINED" });
    expect(out.details).toEqual({ lpn: lpn(46) });
    const into = await failureOf(
      createMove({ lpns: [lpn(1)], toLocation: "HCM-QC01" }, crypto.randomUUID()),
    );
    expect(into).toMatchObject({ status: 409, code: "LOCATION_AREA_MISMATCH" });
  });

  it("@Valid: required fields and bounds come back as fieldErrors", async () => {
    const error = await failureOf(postRaw({ lpns: [], toLocation: "X".repeat(65) }));
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    expect(Object.keys(error.fieldErrors ?? {}).sort()).toEqual([
      "lpns",
      "requestId",
      "toLocation",
    ]);
    const longLpn = await failureOf(
      postRaw({ requestId: crypto.randomUUID(), lpns: [lpn(1), "L".repeat(31)], toLocation: TO }),
    );
    expect(longLpn.fieldErrors).toHaveProperty("lpns[1]");
  });

  it("a body Jackson cannot read is 400 MALFORMED_REQUEST", async () => {
    const notUuid = await failureOf(
      postRaw({ requestId: "not-a-uuid", lpns: [lpn(1)], toLocation: TO }),
    );
    expect(notUuid).toMatchObject({ status: 400, code: "MALFORMED_REQUEST" });
    const notList = await failureOf(
      postRaw({ requestId: crypto.randomUUID(), lpns: lpn(1), toLocation: TO }),
    );
    expect(notList).toMatchObject({ status: 400, code: "MALFORMED_REQUEST" });
  });

  it("needs a session", async () => {
    useAuthStore.setState({ user: null, status: "unauthenticated", isAuthenticated: false });
    const error = await failureOf(
      createMove({ lpns: [lpn(1)], toLocation: TO }, crypto.randomUUID()),
    );
    expect(error.status).toBe(401);
  });
});

describe("carton lookup (mock GET /inventory/stock-packages)", () => {
  it("one carton by LPN: SKU, count and where it is", async () => {
    expect(await getCarton(lpn(1))).toMatchObject({
      lpn: lpn(1),
      sku: "CUP-PP-500",
      onHand: 1,
      reserved: 0,
      status: "IN_STOCK",
      locationCode: "HCM-A01-2-B",
    });
    expect(await failureOf(getCarton("LPN-NOPE"))).toMatchObject({
      status: 404,
      code: "STOCK_PACKAGE_NOT_FOUND",
    });
  });

  it("IN_STOCK cartons of a location or of a SKU, one page", async () => {
    const byLocation = await listCartons({ location: "HCM-A02-1-A" });
    expect(byLocation.items).toHaveLength(8);
    expect(byLocation.hasNext).toBe(false);
    const bySku = await listCartons({ sku: "BAG-CUP-2" });
    expect(bySku.items.every((row) => row.sku === "BAG-CUP-2" && row.status === "IN_STOCK")).toBe(
      true,
    );
  });
});
