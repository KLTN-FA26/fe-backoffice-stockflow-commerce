/**
 * WF-05 Q-12 (BE 6bbfa15b): `OrderResponse.version` → `Order.version`, gửi lại làm `version` khi đóng phần thất lạc;
 * 409 OPTIMISTIC_LOCK (BE `LostShipmentClosures.closeLocked`) → câu tiếng Việt bảo tải lại.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";

import { apiOrder } from "./__fixtures__/order";
import { toOrder } from "./api";
import { isOrderConcurrencyError } from "./errors";
import { deliveryFailureErrorView, LOST_CLOSURE_STALE_CODES } from "./delivery-failure-errors";
import { closeLostShipment } from "./lost-closure-api";
import { orderDtoSchema } from "./schemas";

afterEach(() => vi.restoreAllMocks());

describe("Order.version (BE OrderResponse.version)", () => {
  it("map nguyên số BE; vắng / null → null", () => {
    expect(toOrder(orderDtoSchema.parse({ ...apiOrder, version: 7 })).version).toBe(7);
    expect(toOrder(orderDtoSchema.parse({ ...apiOrder, version: null })).version).toBeNull();
    const { version: _omitted, ...withoutVersion } = { ...apiOrder, version: 1 };
    expect(toOrder(orderDtoSchema.parse(withoutVersion)).version).toBeNull();
  });
});

describe("closeLostShipment — gửi version của đơn", () => {
  const input = {
    orderId: "o-1",
    shipmentId: "s-1",
    note: "GHN xác nhận mất kiện",
    evidenceUploadId: "u-1",
  };

  it("có version → body mang `version`", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await closeLostShipment({ ...input, version: 4 });
    expect(post.mock.calls[0]?.[0]).toMatch(/\/orders\/o-1\/shipments\/s-1\/lost-closure$/);
    expect(post.mock.calls[0]?.[1]).toEqual({
      note: input.note,
      evidenceUploadId: "u-1",
      version: 4,
    });
  });

  it("BE không trả version (null) → không gửi, BE không kiểm", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue({ data: apiOrder });
    await closeLostShipment({ ...input, version: null });
    expect(post.mock.calls[0]?.[1]).toEqual({ note: input.note, evidenceUploadId: "u-1" });
  });
});

describe("409 OPTIMISTIC_LOCK khi đóng phần thất lạc", () => {
  const stale = new ApiError(409, "OPTIMISTIC_LOCK", "Order SO-1 changed since it was read");

  it("câu tiếng Việt: đơn đã đổi, đã tải lại, kiểm tra rồi bấm lại", () => {
    const view = deliveryFailureErrorView(stale, "lost-closure");
    expect(view.title).toBe("Không đóng được phần thất lạc");
    expect(view.detail).toMatch(/vừa được người khác cập nhật/);
    expect(view.detail).toMatch(/tải lại/);
  });

  it("giữ hộp thoại và dữ liệu đã nhập, tải lại đơn (useOrderActionErrors: nhánh tranh chấp)", () => {
    expect(LOST_CLOSURE_STALE_CODES).not.toContain("OPTIMISTIC_LOCK");
    expect(isOrderConcurrencyError(stale)).toBe(true);
  });
});
