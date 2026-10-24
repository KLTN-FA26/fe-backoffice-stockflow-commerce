/**
 * Mock ước tính xếp xe (BE PR #160) — chạy qua axios thật + `features/load-planning/estimate-api.ts`, nên kiểm luôn
 * mock đúng hình BE (qua LoadEstimateSchema, gồm Layout của F1) và các luật chính của `LoadEstimateService`.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createLoadEstimate, getCurrentLoadEstimate } from "@/features/load-planning/estimate-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { resetLoadEstimateMockStore } from "./mock-routes-load-estimates";
import { resetOrderMockStore } from "./mock-routes-orders";
import { getVehicleTypeStore, resetVehicleTypeMockStore } from "./mock-vehicle-type-store";

const originalAdapter = api.defaults.adapter;

const orderWith = (status: string, minLines = 1) => {
  const order = orders.find((o) => o.status === status && o.lines.length >= minLines);
  if (!order) throw new Error(`mock-data không có đơn "${status}" ≥ ${minLines} dòng`);
  return order;
};

function actAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
    },
    isAuthenticated: true,
    status: "authenticated",
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

const input = (orderId: string, patch: Record<string, unknown> = {}) => ({
  orderId,
  warehouseId: null,
  vehicleTypeIds: [],
  selectionMode: "SINGLE_TYPE" as const,
  ...patch,
});

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => actAs("USER-COORD-01"));
afterEach(() => {
  resetLoadEstimateMockStore();
  resetOrderMockStore();
  resetVehicleTypeMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("POST /fulfillment/load-estimates", () => {
  it("đơn đã release → ước tính hợp lệ theo schema: một 40HC, kiện chưa xếp có lý do, cảnh báo", async () => {
    const order = orderWith("Ready to Fulfill");
    const estimate = await createLoadEstimate(input(order.orderId));
    expect(estimate.sourceId).toBe(order.orderId);
    expect(estimate.status).toBe("CURRENT");
    expect(estimate.vehicles.map((v) => v.code)).toEqual(["40HC"]);
    expect(estimate.lines.length).toBeGreaterThan(0);
    expect(estimate.unplaced.map((u) => u.reason)).toEqual(["NO_SPACE", "TOO_LARGE"]);
    expect(estimate.meta.budgetExhausted).toBe(false);
  });

  it("FEWEST_VEHICLES → hai xe, dừng do hết thời gian tính (SEARCH_CUT_OFF)", async () => {
    const estimate = await createLoadEstimate(
      input(orderWith("Ready to Fulfill").orderId, { selectionMode: "FEWEST_VEHICLES" }),
    );
    expect(estimate.vehicles.map((v) => v.seq)).toEqual([1, 2]);
    expect(estimate.meta.budgetExhausted).toBe(true);
    expect(estimate.unplaced[0]?.reason).toBe("SEARCH_CUT_OFF");
  });

  it("đơn từ hai dòng → dòng cuối thiếu dữ liệu: missing[] + incomplete (LP2-3), link tới hồ sơ hàng tồn qua inventoryItemId", async () => {
    const order = orderWith("Ready to Fulfill", 2);
    const estimate = await createLoadEstimate(input(order.orderId));
    const last = order.lines[order.lines.length - 1];
    expect(estimate.incomplete).toBe(true);
    expect(estimate.missing).toHaveLength(1);
    expect(estimate.missing[0]).toMatchObject({
      orderLineId: last?.lineId,
      sku: last?.skuId,
      missingFields: ["lengthCm", "widthCm", "heightCm", "weightKg"],
    });
    expect(estimate.missing[0]?.inventoryItemId).toMatch(/^item-/);
  });

  it("CONFIRMED: bắt buộc kho (400 NotNull); kho lạ 404; có kho hợp lệ → 201", async () => {
    const order = orderWith("Confirmed");
    const noWarehouse = await captureError(createLoadEstimate(input(order.orderId)));
    expect(noWarehouse.code).toBe("VALIDATION_FAILED");
    expect(noWarehouse.fieldCodes).toEqual({ warehouseId: "NotNull" });
    expect(
      (await captureError(createLoadEstimate(input(order.orderId, { warehouseId: "WH-NOPE" }))))
        .status,
    ).toBe(404);
    expect(
      (await createLoadEstimate(input(order.orderId, { warehouseId: "WH-HN-01" }))).warehouseId,
    ).toBe("WH-HN-01");
  });

  it("đơn đã release mà gửi kho khác → 400 WarehouseMismatch", async () => {
    const order = orderWith("Ready to Fulfill");
    const error = await captureError(
      createLoadEstimate(input(order.orderId, { warehouseId: "WH-OTHER" })),
    );
    expect(error.fieldCodes).toEqual({ warehouseId: "WarehouseMismatch" });
  });

  it("trạng thái không ước tính được (đã giao) → 409 LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE", async () => {
    const error = await captureError(createLoadEstimate(input(orderWith("Delivered").orderId)));
    expect(error.code).toBe("LOAD_ESTIMATE_SOURCE_NOT_ELIGIBLE");
  });

  it("loại xe lạ → 404 VEHICLE_TYPE_NOT_FOUND; loại xe ngừng dùng → 409 VEHICLE_TYPE_INACTIVE", async () => {
    const order = orderWith("Ready to Fulfill");
    expect(
      (
        await captureError(
          createLoadEstimate(input(order.orderId, { vehicleTypeIds: ["vt-nope"] })),
        )
      ).code,
    ).toBe("VEHICLE_TYPE_NOT_FOUND");
    const [type] = [...getVehicleTypeStore().values()];
    if (!type) throw new Error("không có loại xe mock");
    type.status = "INACTIVE";
    expect(
      (
        await captureError(
          createLoadEstimate(input(order.orderId, { vehicleTypeIds: [type.vehicleTypeId] })),
        )
      ).code,
    ).toBe("VEHICLE_TYPE_INACTIVE");
  });

  it("thiếu fulfillment-load-estimates:CREATE (nhân viên kho) → 403", async () => {
    actAs("USER-WH-01");
    const error = await captureError(
      createLoadEstimate(input(orderWith("Ready to Fulfill").orderId)),
    );
    expect(error.status).toBe(403);
  });
});

describe("GET /fulfillment/load-estimates?sourceType=ORDER&sourceId=", () => {
  it("chưa có → null (404 LOAD_ESTIMATE_NOT_FOUND được lớp api hiểu là 'chưa có'); sau POST → trả đúng bản vừa tính, bản mới thay bản cũ", async () => {
    const order = orderWith("Ready to Fulfill");
    await expect(getCurrentLoadEstimate(order.orderId)).resolves.toBeNull();
    const first = await createLoadEstimate(input(order.orderId));
    expect((await getCurrentLoadEstimate(order.orderId))?.id).toBe(first.id);
    const second = await createLoadEstimate(
      input(order.orderId, { selectionMode: "FEWEST_VEHICLES" }),
    );
    expect(second.id).not.toBe(first.id);
    expect((await getCurrentLoadEstimate(order.orderId))?.id).toBe(second.id);
  });

  it("thiếu :READ → 403", async () => {
    actAs("USER-WH-01");
    expect(
      (await captureError(getCurrentLoadEstimate(orderWith("Ready to Fulfill").orderId))).status,
    ).toBe(403);
  });
});
