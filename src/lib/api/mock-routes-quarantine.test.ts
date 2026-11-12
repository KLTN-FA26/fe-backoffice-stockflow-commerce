/**
 * Mock tra cứu thùng + cách ly / gỡ cách ly (docs 20 §4.8, BR-21) qua axios thật + `features/inventory/quarantine-api.ts`.
 * Cách ly chỉ đổi chỗ và trạng thái tồn của cả thùng — không qua duyệt, không đổi số lượng; ghi giảm thùng lỗi đi qua
 * điều chỉnh `DAMAGED` có duyệt bốn mắt.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { approveAdjustment, createAdjustment, listMovements } from "@/features/inventory/api";
import { getCarton, quarantineCarton, releaseCarton } from "@/features/inventory/quarantine-api";

import { seedMockCartons } from "@/test/mock-cartons";

import { activateMockAdapter } from "./mock-adapter";
import { resetReceiptMockStore } from "./mock-routes-goods-receipts-store";
import { resetInventoryMockState } from "./mock-routes-inventory";

// Mỗi request mock trễ ~215ms (Math.random = 0.05).
vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;
const LPN = "LPN-20261110-000001";
const LPN_OUT = "LPN-20261110-000002";
const QUARANTINE_AREA = "HCM-QC01";

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

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(async () => {
  actAs("MOCK-MANAGER-A");
  await seedMockCartons([
    { lpn: LPN, location: "HCM-A01-1-A" },
    { lpn: LPN_OUT, location: "HCM-A01-1-B", status: "CONSUMED" },
  ]);
});
afterEach(() => {
  resetInventoryMockState();
  resetReceiptMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("looking a carton up", () => {
  it("answers one carton by LPN (any case) with its place and the status of what it holds", async () => {
    const carton = await getCarton(LPN.toLowerCase());
    expect(carton).toMatchObject({
      lpn: LPN,
      status: "IN_STOCK",
      locationCode: "HCM-A01-1-A",
      nominalQty: 120,
      onHand: 120,
      reserved: 0,
    });
    expect(carton.contents?.[0]?.status).toBe("AVAILABLE");
  });

  it("an unknown LPN is 404 STOCK_PACKAGE_NOT_FOUND", async () => {
    expect(await captureError(getCarton("LPN-NOPE"))).toMatchObject({
      status: 404,
      code: "STOCK_PACKAGE_NOT_FOUND",
    });
  });
});

describe("quarantine and release (docs 20 §4.8)", () => {
  it("moves the whole carton into a QUARANTINE area of its warehouse; no approval, no ledger quantity change", async () => {
    const quarantined = await quarantineCarton(LPN, {
      locationCode: QUARANTINE_AREA.toLowerCase(),
      reason: "Thùng móp một bên",
    });
    expect(quarantined).toMatchObject({
      lpn: LPN,
      locationCode: QUARANTINE_AREA,
      status: "IN_STOCK",
    });
    expect(quarantined.contents?.[0]?.status).toBe("QUARANTINE");
    expect((await listMovements({ page: 0, size: 20 })).totalElements).toBe(0);
    expect(
      await captureError(quarantineCarton(LPN, { locationCode: QUARANTINE_AREA, reason: "Lại" })),
    ).toMatchObject({
      status: 409,
      code: "STOCK_PACKAGE_QUARANTINED",
    });
  });

  it("refuses a bin that is not a QUARANTINE area and a carton that is not in stock", async () => {
    expect(
      await captureError(quarantineCarton(LPN, { locationCode: "HCM-A01-1-B", reason: "Móp" })),
    ).toMatchObject({ status: 409, code: "LOCATION_AREA_MISMATCH" });
    expect(
      await captureError(
        quarantineCarton(LPN_OUT, { locationCode: QUARANTINE_AREA, reason: "Móp" }),
      ),
    ).toMatchObject({ status: 409, code: "INVALID_STOCK_PACKAGE_TRANSITION" });
  });

  it("release opens one putaway task and answers the same task when asked again; the carton stays quarantined", async () => {
    await quarantineCarton(LPN, { locationCode: QUARANTINE_AREA, reason: "Móp" });
    const first = await releaseCarton(LPN);
    expect(first).toMatchObject({ lpn: LPN, status: "OPEN", sourceLocationCode: QUARANTINE_AREA });
    expect((await releaseCarton(LPN)).id).toBe(first.id);
    expect((await getCarton(LPN)).contents?.[0]?.status).toBe("QUARANTINE");
  });

  it("only a quarantined carton is released", async () => {
    expect(await captureError(releaseCarton(LPN))).toMatchObject({
      status: 409,
      code: "STOCK_PACKAGE_NOT_QUARANTINED",
    });
  });

  it("a write-off waiting for approval blocks both quarantine and release (docs 20 §4.8 bước 3)", async () => {
    await quarantineCarton(LPN, { locationCode: QUARANTINE_AREA, reason: "Móp" });
    await createAdjustment({ lpn: LPN, direction: "WRITE_OFF", reason: "DAMAGED" });
    expect(await captureError(releaseCarton(LPN))).toMatchObject({
      status: 409,
      code: "STOCK_PACKAGE_DECISION_PENDING",
    });
  });

  it("a damaged quarantined carton is written off through the four-eyes adjustment", async () => {
    await quarantineCarton(LPN, { locationCode: QUARANTINE_AREA, reason: "Móp" });
    const asked = await createAdjustment({ lpn: LPN, direction: "WRITE_OFF", reason: "DAMAGED" });
    expect(asked).toMatchObject({
      status: "PENDING_APPROVAL",
      locationCode: QUARANTINE_AREA,
      quantityDelta: -120,
    });
    actAs("MOCK-MANAGER-B");
    await approveAdjustment(asked.adjustmentId);
    // Approval posts the write-off: the carton has left stock, so it cannot be quarantined or released again.
    expect(await getCarton(LPN)).toMatchObject({ status: "CONSUMED", onHand: 0 });
    expect(await captureError(releaseCarton(LPN))).toMatchObject({ status: 409 });
  });
});
