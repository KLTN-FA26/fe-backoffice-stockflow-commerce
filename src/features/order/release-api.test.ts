import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { getDeliverySchedule, nextBatchToRelease } from "./delivery-batch-api";
import { releaseOrder } from "./release-api";

afterEach(() => vi.restoreAllMocks());

describe("releaseOrder — POST /orders/{id}/release (BE ReleaseOrderRequest: warehouseId, deliveryBatchId?)", () => {
  it("body chỉ có warehouseId — KHÔNG có deliveryMode (BE đã bỏ hình thức giao, docs 17 BR-16)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await releaseOrder({ id: "o-1", warehouseId: "wh-1" });
    expect(post).toHaveBeenCalledWith("/orders/o-1/release", { warehouseId: "wh-1" }, undefined);
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("deliveryMode");
  });

  it("có đợt giao → gửi deliveryBatchId (BR-29: đợt kế tiếp của lịch giao)", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await releaseOrder({ id: "o-1", warehouseId: "wh-1", deliveryBatchId: "b-1" });
    expect(post).toHaveBeenCalledWith(
      "/orders/o-1/release",
      { warehouseId: "wh-1", deliveryBatchId: "b-1" },
      undefined,
    );
  });

  it("id được mã hoá trong path; Idempotency-Key đi trong header", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: {} });
    await releaseOrder({ id: "a/b", warehouseId: "wh-1", idempotencyKey: "k-1" });
    expect(post).toHaveBeenCalledWith(
      "/orders/a%2Fb/release",
      { warehouseId: "wh-1" },
      { headers: { "Idempotency-Key": "k-1" } },
    );
  });
});

describe("getDeliverySchedule — GET /orders/{id}/delivery-batches (BE DeliveryBatchService.Schedule)", () => {
  const batch = (overrides: Record<string, unknown> = {}) => ({
    batchId: "b-1",
    seq: 1,
    windowStart: "2026-12-01",
    windowEnd: "2026-12-05",
    state: "READY",
    late: false,
    lines: [{ orderLineId: "l-1", sku: "TEE", cartons: 4, heldCartons: 4 }],
    ...overrides,
  });

  it("parse lịch giao; field null bị BE bỏ (releasedAt vắng = chưa release); trạng thái lạ → UNKNOWN", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: {
        orderId: "o-1",
        orderNumber: "SO-1",
        batches: [batch(), batch({ batchId: "b-2", seq: 2, state: "SOMETHING_NEW" })],
      },
    });
    const schedule = await getDeliverySchedule("o-1");
    expect(get.mock.calls[0]?.[0]).toBe("/orders/o-1/delivery-batches");
    expect(schedule.batches[0]?.releasedAt).toBeUndefined();
    expect(schedule.batches[1]?.state).toBe("UNKNOWN");
  });

  it("response sai hợp đồng (thiếu orderId) → từ chối, không trả dữ liệu chưa validate", async () => {
    vi.spyOn(api, "get").mockResolvedValueOnce({ data: { batches: [] } });
    await expect(getDeliverySchedule("o-1")).rejects.toThrow();
  });
});

describe("nextBatchToRelease — gợi ý đợt mặc định (BE vẫn kiểm: DELIVERY_BATCH_NOT_NEXT)", () => {
  const b = (seq: number, state: string, releasedAt?: string) => ({
    batchId: `b-${seq}`,
    seq,
    state: state as "READY",
    releasedAt,
    lines: [],
  });

  it("đợt sớm nhất chưa release và chưa đóng / giao", () => {
    expect(nextBatchToRelease([b(2, "READY"), b(1, "READY")])?.batchId).toBe("b-1");
    expect(
      nextBatchToRelease([b(1, "IN_DELIVERY", "2026-11-20T00:00:00Z"), b(2, "AWAITING_STOCK")])
        ?.batchId,
    ).toBe("b-2");
    expect(nextBatchToRelease([b(1, "CLOSED"), b(2, "DELIVERED")])).toBeUndefined();
    expect(nextBatchToRelease([])).toBeUndefined();
  });
});
