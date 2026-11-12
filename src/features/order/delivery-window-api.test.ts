/**
 * API dời cửa sổ giao (BE `DeliveryBatchController#changeWindow`, docs 17 BR-28).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";

import { changeDeliveryWindow } from "./delivery-window-api";

afterEach(() => vi.restoreAllMocks());

const schedule = {
  orderId: "o-1",
  orderNumber: "SO-1",
  contractNumber: "HD-1",
  batches: [
    {
      batchId: "b-1",
      seq: 1,
      contractWindowStart: "2026-12-01",
      contractWindowEnd: "2026-12-05",
      windowStart: "2026-12-10",
      windowEnd: "2026-12-12",
      state: "READY",
      lines: [{ orderLineId: "l-1", sku: "TEE", cartons: 4, heldCartons: 4 }],
      windowChanges: [
        {
          id: "w-1",
          oldStart: "2026-12-01",
          oldEnd: "2026-12-05",
          newStart: "2026-12-10",
          newEnd: "2026-12-12",
          reason: "SELLER_DELAY",
          note: "Sản xuất trễ",
          evidenceMessageId: "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c10",
        },
      ],
    },
  ],
};

describe("changeDeliveryWindow — POST /orders/{id}/delivery-batches/{batchId}/window-change", () => {
  const input = {
    orderId: "o-1",
    batchId: "b-1",
    windowStart: "2026-12-10",
    windowEnd: "2026-12-12",
    reasonCode: "SELLER_DELAY" as const,
    note: "Sản xuất trễ",
    evidenceMessageId: "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c10",
  };

  it("body đúng WindowChangeRequest (chỉ evidenceMessageId, không evidenceUploadId); id không lọt vào body", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: schedule });
    await changeDeliveryWindow(input);
    expect(post).toHaveBeenCalledWith(
      "/orders/o-1/delivery-batches/b-1/window-change",
      {
        windowStart: "2026-12-10",
        windowEnd: "2026-12-12",
        reasonCode: "SELLER_DELAY",
        note: "Sản xuất trễ",
        evidenceMessageId: "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c10",
      },
      undefined,
    );
    expect(post.mock.calls[0]?.[1]).not.toHaveProperty("evidenceUploadId");
  });

  it("id được mã hoá trong path; Idempotency-Key đi trong header", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: schedule });
    await changeDeliveryWindow({ ...input, orderId: "a/b", batchId: "c d", idempotencyKey: "k-9" });
    expect(post.mock.calls[0]?.[0]).toBe("/orders/a%2Fb/delivery-batches/c%20d/window-change");
    expect(post.mock.calls[0]?.[2]).toEqual({ headers: { "Idempotency-Key": "k-9" } });
  });

  it("trả lịch giao hiệu lực mới kèm lịch sử dời", async () => {
    vi.spyOn(api, "post").mockResolvedValue({ data: schedule });
    const result = await changeDeliveryWindow(input);
    const batch = result.batches[0];
    expect(batch?.windowStart).toBe("2026-12-10");
    expect(batch?.contractWindowStart).toBe("2026-12-01");
    expect(batch?.windowChanges[0]).toMatchObject({
      reason: "SELLER_DELAY",
      newStart: "2026-12-10",
    });
  });
});
