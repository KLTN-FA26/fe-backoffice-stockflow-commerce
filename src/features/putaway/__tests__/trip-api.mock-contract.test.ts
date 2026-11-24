/**
 * Contract test: mock chuyến cất hàng nói đúng hợp đồng BE `PutawayTripController` (docs 05 §4.5) — một chuyến mở mỗi
 * người (BR-15), xếp / bỏ thùng chỉ khi LOADING, đi cần ≥ 1 thùng, đặt thùng ghi DONE và hoàn tất chuyến, đóng chuyến
 * trả thùng về hàng chờ, quản lý đóng hộ.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetMockCartonLedger } from "@/lib/api/mock-inventory-cartons";
import { resetPutawayMockStore } from "@/lib/api/mock-putaway-store";
import { resetPutawayTripsMockStore } from "@/lib/api/mock-putaway-trips-store";
import {
  MOCK_WAREHOUSE_ID,
  resetReceiptMockStore,
} from "@/lib/api/mock-routes-goods-receipts-store";
import { resetWarehouseMockStore } from "@/lib/api/mock-warehouse-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import { getPutawayTask, listPutawayTasks } from "../api";
import {
  closeTrip,
  departTrip,
  forceCloseTrip,
  getCurrentTrip,
  loadTripCarton,
  openTrip,
  placeTripCarton,
  reassignTripCarton,
  unloadTripCarton,
} from "../trip-api";

vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;

function signIn(userId: "USER-WH-01" | "USER-WH-02" | "USER-ADMIN-01") {
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

async function lpns(count: number): Promise<string[]> {
  const { items } = await listPutawayTasks({ warehouseId: MOCK_WAREHOUSE_ID });
  return items.slice(0, count).map((t) => t.lpn ?? "");
}

beforeAll(() => {
  // 0.5: tránh nhánh lỗi ngẫu nhiên 5% của mock adapter
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
  resetPutawayTripsMockStore();
  resetWarehouseMockStore();
  resetMockCartonLedger();
  signIn("USER-WH-01");
});

describe("putaway trip mock ↔ hợp đồng BE PutawayTripController", () => {
  it("chưa có chuyến → /current không có data → null; mở chuyến LOADING; mở lần hai → 409 (BR-15)", async () => {
    expect(await getCurrentTrip()).toBeNull();
    const trip = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    expect(trip).toMatchObject({
      status: "LOADING",
      cartons: [],
      stops: [],
      operatorId: "USER-WH-01",
    });
    expect((await getCurrentTrip())?.id).toBe(trip.id);
    expect(await codeOf(openTrip({ warehouseId: MOCK_WAREHOUSE_ID }))).toBe(
      "PUTAWAY_TRIP_ALREADY_OPEN",
    );
  });

  it("xếp thùng (quét lại không đổi), bỏ thùng; xe rỗng không đi được (422)", async () => {
    const [a, b] = await lpns(2);
    const trip = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    expect(await codeOf(departTrip({ tripId: trip.id }))).toBe("PUTAWAY_TRIP_EMPTY");
    await loadTripCarton({ tripId: trip.id, lpn: a ?? "" });
    const twice = await loadTripCarton({ tripId: trip.id, lpn: (a ?? "").toLowerCase() });
    expect(twice.cartons).toHaveLength(1);
    const two = await loadTripCarton({ tripId: trip.id, lpn: b ?? "" });
    expect(two.cartons.map((c) => c.status)).toEqual(["ON_CART", "ON_CART"]);
    expect((await unloadTripCarton({ tripId: trip.id, lpn: b ?? "" })).cartons).toHaveLength(1);
    expect(await codeOf(loadTripCarton({ tripId: trip.id, lpn: "LPN-NONE" }))).toBe(
      "STOCK_PACKAGE_NOT_FOUND",
    );
  });

  it("thùng đã trên xe người khác → 409 PUTAWAY_TASK_ON_ANOTHER_TRIP", async () => {
    const [a] = await lpns(1);
    const mine = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    await loadTripCarton({ tripId: mine.id, lpn: a ?? "" });
    signIn("USER-WH-02");
    const theirs = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    expect(await codeOf(loadTripCarton({ tripId: theirs.id, lpn: a ?? "" }))).toBe(
      "PUTAWAY_TASK_ON_ANOTHER_TRIP",
    );
    expect(await codeOf(departTrip({ tripId: mine.id }))).toBe("PUTAWAY_TRIP_NOT_YOURS");
  });

  it("đi: gán bin + giữ chỗ + lộ trình; đặt hết thùng → COMPLETED, nhiệm vụ DONE", async () => {
    const [a, b] = await lpns(2);
    const trip = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    await loadTripCarton({ tripId: trip.id, lpn: a ?? "" });
    await loadTripCarton({ tripId: trip.id, lpn: b ?? "" });
    const going = await departTrip({ tripId: trip.id });
    expect(going.status).toBe("IN_PROGRESS");
    expect(going.startLocationCode).toBe("HCM-RCV01");
    expect(going.cartons.every((c) => c.assignedLocationCode && c.holding && c.stopSequence)).toBe(
      true,
    );
    expect(going.stops.length).toBeGreaterThan(0);
    // BE #410: điểm gốc = khu nguồn khi chưa cất thùng nào; mock không tìm đường → path null (FE nối thẳng)
    expect(going.originLocationCode).toBe("HCM-RCV01");
    expect([going.originX, going.originY]).toEqual([going.startX, going.startY]);
    expect(going.stops.every((s) => s.path === null)).toBe(true);
    expect(await codeOf(loadTripCarton({ tripId: trip.id, lpn: a ?? "" }))).toBe(
      "PUTAWAY_TRIP_INVALID_STATE",
    );

    let last = going;
    for (const carton of going.cartons) {
      last = await placeTripCarton({
        tripId: trip.id,
        values: { lpn: carton.lpn, locationCode: carton.assignedLocationCode ?? "" },
      });
    }
    expect(last.status).toBe("COMPLETED");
    expect(last.stops).toEqual([]);
    const task = await getPutawayTask(going.cartons[0]?.putawayTaskId ?? "");
    expect(task.status).toBe("DONE");
    expect(await getCurrentTrip()).toBeNull();
  });

  it("đặt vào khu không phải bin → lỗi cất hàng của BE; đổi bin → bin khác", async () => {
    const [a] = await lpns(1);
    const trip = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    await loadTripCarton({ tripId: trip.id, lpn: a ?? "" });
    const going = await departTrip({ tripId: trip.id });
    const before = going.cartons[0]?.assignedLocationCode;
    expect(
      await codeOf(
        placeTripCarton({ tripId: trip.id, values: { lpn: a ?? "", locationCode: "HCM-RCV01" } }),
      ),
    ).toBe("PUTAWAY_TARGET_NOT_BIN");
    const moved = await reassignTripCarton({ tripId: trip.id, lpn: a ?? "" });
    expect(moved.cartons[0]?.assignedLocationCode).not.toBe(before);
    expect(moved.stops.flatMap((s) => s.lpns)).toEqual([a]);
  });

  it("đóng chuyến sớm → CLOSED, thùng RETURNED, nhiệm vụ lại chờ cất; quản lý đóng hộ chuyến người khác", async () => {
    const [a, b] = await lpns(2);
    const trip = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    await loadTripCarton({ tripId: trip.id, lpn: a ?? "" });
    await departTrip({ tripId: trip.id });
    const closed = await closeTrip({ tripId: trip.id });
    expect(closed).toMatchObject({ status: "CLOSED", closedBy: "USER-WH-01" });
    expect(closed.cartons[0]?.status).toBe("RETURNED");
    expect(
      (await listPutawayTasks({ warehouseId: MOCK_WAREHOUSE_ID })).items.some((t) => t.lpn === a),
    ).toBe(true);
    expect(await codeOf(closeTrip({ tripId: trip.id }))).toBe("PUTAWAY_TRIP_INVALID_STATE");

    const second = await openTrip({ warehouseId: MOCK_WAREHOUSE_ID });
    await loadTripCarton({ tripId: second.id, lpn: b ?? "" });
    expect(await codeOf(forceCloseTrip({ tripId: second.id }))).toBe("FORBIDDEN");
    signIn("USER-ADMIN-01");
    expect((await forceCloseTrip({ tripId: second.id })).closedBy).toBe("USER-ADMIN-01");
  });
});
