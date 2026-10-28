import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiEstimate, apiVehicleTypePage, ORDER_ID, WAREHOUSE_ID } from "./__fixtures__/estimate";
import {
  createLoadEstimate,
  getCurrentLoadEstimate,
  listEstimateVehicleTypes,
  toEstimateBody,
} from "./estimate-api";

afterEach(() => vi.restoreAllMocks());

const input = {
  orderId: ORDER_ID,
  warehouseId: null,
  vehicleTypeIds: ["vt-40hc"],
  selectionMode: "FEWEST_VEHICLES" as const,
};

describe("toEstimateBody", () => {
  it("đơn đã release: không gửi warehouseId (BE từ chối kho khác)", () => {
    expect(toEstimateBody(input)).toEqual({
      sources: [{ type: "ORDER", id: ORDER_ID }],
      vehicleTypeIds: ["vt-40hc"],
      selectionMode: "FEWEST_VEHICLES",
    });
  });

  it("đơn CONFIRMED (hộp thoại release): gửi kho đã chọn", () => {
    expect(toEstimateBody({ ...input, warehouseId: WAREHOUSE_ID })).toMatchObject({
      warehouseId: WAREHOUSE_ID,
    });
  });
});

describe("estimate API", () => {
  it("POST /fulfillment/load-estimates → parse tại biên", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiEstimate() });
    const estimate = await createLoadEstimate({ ...input, warehouseId: WAREHOUSE_ID });
    expect(post).toHaveBeenCalledWith("/fulfillment/load-estimates", {
      sources: [{ type: "ORDER", id: ORDER_ID }],
      warehouseId: WAREHOUSE_ID,
      vehicleTypeIds: ["vt-40hc"],
      selectionMode: "FEWEST_VEHICLES",
    });
    expect(estimate.vehicles[0]?.code).toBe("40HC");
  });

  it("phản hồi sai hợp đồng → ném ZodError, không đưa dữ liệu hỏng vào cache", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: { ...apiEstimate(), vehicles: "nope" } });
    await expect(createLoadEstimate(input)).rejects.toThrow();
  });

  it("GET hiện hành truyền sourceType + sourceId", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: apiEstimate() });
    expect((await getCurrentLoadEstimate(ORDER_ID))?.id).toBe(apiEstimate().id);
    expect(get).toHaveBeenCalledWith("/fulfillment/load-estimates", {
      params: { sourceType: "ORDER", sourceId: ORDER_ID },
      signal: undefined,
    });
  });

  it("404 LOAD_ESTIMATE_NOT_FOUND = chưa có ước tính (null), các lỗi khác vẫn ném", async () => {
    const get = vi.spyOn(api, "get");
    get.mockRejectedValueOnce(new ApiError(404, "LOAD_ESTIMATE_NOT_FOUND", "x"));
    await expect(getCurrentLoadEstimate(ORDER_ID)).resolves.toBeNull();
    get.mockRejectedValueOnce(new ApiError(403, "FORBIDDEN", "x"));
    await expect(getCurrentLoadEstimate(ORDER_ID)).rejects.toMatchObject({ status: 403 });
  });

  it("loại xe: chỉ đang dùng (status=ACTIVE), một trang tối đa", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ data: apiVehicleTypePage });
    const types = await listEstimateVehicleTypes();
    expect(types).toHaveLength(2);
    expect(get).toHaveBeenCalledWith("/fulfillment/vehicle-types", {
      params: { status: "ACTIVE", page: 0, size: 200 },
      signal: undefined,
    });
  });
});
