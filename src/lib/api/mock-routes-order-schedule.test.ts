/**
 * Mock lịch giao + dời cửa sổ giao (BE `DeliveryBatchController`, docs 17 §4.5, §5.5, BR-28) — chạy qua axios thật +
 * `features/order/*-api.ts`: lịch hiệu lực với cửa sổ hợp đồng, trạng thái từng đợt, quyền `sales-contracts:READ` /
 * `:UPDATE`, các điều kiện BR-28 (không quá khứ, giữ thứ tự, đúng bằng chứng khách, đợt đã bàn giao khoá).
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getDeliverySchedule } from "@/features/order/delivery-batch-api";
import { changeDeliveryWindow } from "@/features/order/delivery-window-api";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { toLocalIsoDate } from "@/lib/format/date";
import { orders } from "@/lib/mock-data";

import { activateMockAdapter } from "./mock-adapter";
import { MOCK_STAFF_MESSAGE_ID } from "./mock-order-delivery-schedule";
import { resetOrderMockStore, seedLifecycle } from "./mock-routes-orders";

const originalAdapter = api.defaults.adapter;
const CONSENT = "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c10";

const orderWith = (status: string) => {
  const order = orders.find((o) => o.status === status);
  if (!order) throw new Error(`mock-data không có đơn "${status}"`);
  return order;
};

/** `YYYY-MM-DD` cách hôm nay `days` ngày (Asia/Ho_Chi_Minh, như BE `BusinessCalendar`). */
const inDays = (days: number) =>
  toLocalIsoDate(new Date(Date.now() + days * 86_400_000).toISOString());

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
      mustChangePassword: false,
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

/** Bàn giao một lô cho dòng đầu của đơn (đợt 1) — như kho ký bàn giao vận chuyển. */
function shipFirstLine(order: (typeof orders)[number]) {
  const first = order.lines[0];
  if (!first) throw new Error("Đơn không có dòng");
  seedLifecycle(order).shipments.push({
    shipmentId: `${order.orderId}-SHIP-1`,
    status: "HANDED_OVER",
    handedOverAt: order.placedAt,
    lines: [{ lineId: first.lineId, quantity: first.quantity }],
  });
}

/** Một lần dời hợp lệ, ghi đè từng phần để thử từng điều kiện BR-28. */
const move = (
  orderId: string,
  batchId: string,
  patch: Partial<Parameters<typeof changeDeliveryWindow>[0]> = {},
) =>
  changeDeliveryWindow({
    orderId,
    batchId,
    windowStart: inDays(30),
    windowEnd: inDays(33),
    reasonCode: "SELLER_DELAY",
    note: "Sản xuất trễ một tuần",
    evidenceMessageId: CONSENT,
    ...patch,
  });

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => actAs("USER-SALE-01"));
afterEach(() => resetOrderMockStore());
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("GET /orders/:id/delivery-batches — lịch giao hiệu lực", () => {
  it("đơn nhiều dòng có hai đợt: cửa sổ hợp đồng = cửa sổ hiệu lực khi chưa dời, thùng theo SKU, chưa có lịch sử", async () => {
    const order = orderWith("Ready to Fulfill");
    const schedule = await getDeliverySchedule(order.orderId);
    expect(schedule).toMatchObject({
      orderNumber: order.orderNumber,
      contractNumber: `HD-${order.orderNumber}`,
    });
    expect(schedule.batches.map((b) => b.seq)).toEqual([1, 2]);
    for (const batch of schedule.batches) {
      expect(batch.windowStart).toBe(batch.contractWindowStart);
      expect(batch.windowEnd).toBe(batch.contractWindowEnd);
      expect(batch.windowChanges).toEqual([]);
    }
    const lines = schedule.batches.flatMap((b) => b.lines);
    expect(lines).toHaveLength(order.lines.length);
    expect(lines[0]).toMatchObject({
      sku: order.lines[0]?.skuId,
      cartons: order.lines[0]?.quantity,
      heldCartons: order.lines[0]?.quantity,
    });
    // Đợt 1 trước đợt 2 (BR-29: giữ thứ tự)
    expect(
      (schedule.batches[0]?.windowStart ?? "") < (schedule.batches[1]?.windowStart ?? ""),
    ).toBe(true);
  });

  it("đơn một dòng có một đợt; đơn đã release: đợt 1 có releasedAt, đợt 2 chưa", async () => {
    expect((await getDeliverySchedule(orderWith("Confirmed").orderId)).batches).toHaveLength(1);
    const released = (await getDeliverySchedule(orderWith("Ready to Fulfill").orderId)).batches;
    expect(released[0]?.releasedAt).toBeTruthy();
    expect(released[1]?.releasedAt).toBeUndefined();
  });

  it("trạng thái hiển thị tính từ lô giao / trạng thái đơn (§5.5): đợt đã bàn giao Đang giao, đơn đã giao Đã giao, đơn huỷ Đã đóng, cờ Trễ", async () => {
    // Một lô đã bàn giao cho đợt 1 của đơn hai đợt: đợt 1 Đang giao, đợt 2 vẫn Sẵn sàng
    const twoBatches = orderWith("Ready to Fulfill");
    shipFirstLine(twoBatches);
    const partial = (await getDeliverySchedule(twoBatches.orderId)).batches;
    expect(partial[0]?.state).toBe("IN_DELIVERY");
    expect(partial[1]?.state).toBe("READY");
    expect(
      (await getDeliverySchedule(orderWith("Shipped").orderId)).batches.every(
        (b) => b.state === "IN_DELIVERY",
      ),
    ).toBe(true);
    expect(
      (await getDeliverySchedule(orderWith("Delivered").orderId)).batches.every(
        (b) => b.state === "DELIVERED",
      ),
    ).toBe(true);
    expect(
      (await getDeliverySchedule(orderWith("Cancelled").orderId)).batches.every(
        (b) => b.state === "CLOSED",
      ),
    ).toBe(true);
    // Cửa sổ giao đã qua (đơn đặt từ lâu) mà đợt chưa bàn giao hết → Trễ; đợt đã giao thì không
    expect(
      (await getDeliverySchedule(orderWith("Ready to Fulfill").orderId)).batches.every(
        (b) => b.late,
      ),
    ).toBe(true);
    expect(
      (await getDeliverySchedule(orderWith("Delivered").orderId)).batches.some((b) => b.late),
    ).toBe(false);
  });

  it("cần sales-contracts:READ: Sale / Kế toán đọc được, nhân viên kho → 403", async () => {
    const id = orderWith("Confirmed").orderId;
    actAs("USER-ACC-01");
    expect((await getDeliverySchedule(id)).batches).toHaveLength(1);
    actAs("USER-WH-01");
    expect((await captureError(getDeliverySchedule(id))).status).toBe(403);
  });
});

describe("POST …/delivery-batches/:batchId/window-change — BR-28", () => {
  it("dời đợt 2: cửa sổ hiệu lực đổi, cửa sổ hợp đồng giữ nguyên, lịch sử ghi cũ/mới + lý do + bằng chứng + người", async () => {
    const order = orderWith("Ready to Fulfill");
    const before = (await getDeliverySchedule(order.orderId)).batches[1];
    const schedule = await move(order.orderId, before?.batchId ?? "");
    const after = schedule.batches[1];
    expect(after).toMatchObject({
      windowStart: inDays(30),
      windowEnd: inDays(33),
      contractWindowStart: before?.contractWindowStart,
      contractWindowEnd: before?.contractWindowEnd,
    });
    expect(after?.windowChanges).toHaveLength(1);
    expect(after?.windowChanges[0]).toMatchObject({
      oldStart: before?.windowStart,
      oldEnd: before?.windowEnd,
      newStart: inDays(30),
      newEnd: inDays(33),
      reason: "SELLER_DELAY",
      note: "Sản xuất trễ một tuần",
      evidenceMessageId: CONSENT,
      changedBy: "USER-SALE-01",
    });
    // Đợt 1 không bị đụng tới
    expect(schedule.batches[0]?.windowChanges).toEqual([]);
    // GET sau đó thấy cùng lịch hiệu lực
    expect((await getDeliverySchedule(order.orderId)).batches[1]?.windowStart).toBe(inDays(30));
  });

  it("dời nhiều lần: lần sau lấy cửa sổ hiệu lực của lần trước làm 'cũ'; đợt 1 dời được khi vẫn trước đợt 2", async () => {
    const order = orderWith("Ready to Fulfill");
    const [first, second] = (await getDeliverySchedule(order.orderId)).batches;
    await move(order.orderId, second?.batchId ?? "");
    const again = await move(order.orderId, second?.batchId ?? "", {
      windowStart: inDays(40),
      windowEnd: inDays(41),
    });
    expect(again.batches[1]?.windowChanges.map((c) => c.oldStart)).toEqual([
      second?.contractWindowStart,
      inDays(30),
    ]);
    const early = await move(order.orderId, first?.batchId ?? "", {
      windowStart: inDays(10),
      windowEnd: inDays(12),
      reasonCode: "CUSTOMER_REQUEST",
    });
    expect(early.batches[0]?.windowStart).toBe(inDays(10));
    expect(early.batches[0]?.late).toBe(false);
  });

  it("BR-28: cửa sổ mới ở quá khứ → 400; kết thúc trước bắt đầu → 400; không đổi gì", async () => {
    const order = orderWith("Ready to Fulfill");
    const batchId = (await getDeliverySchedule(order.orderId)).batches[1]?.batchId ?? "";
    expect(
      (
        await captureError(
          move(order.orderId, batchId, { windowStart: inDays(-1), windowEnd: inDays(2) }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await captureError(
          move(order.orderId, batchId, { windowStart: inDays(5), windowEnd: inDays(4) }),
        )
      ).status,
    ).toBe(400);
    expect((await getDeliverySchedule(order.orderId)).batches[1]?.windowChanges).toEqual([]);
  });

  it("BR-28: giữ thứ tự — đợt 1 dời qua đợt 2 → 400 (phải dời đợt 2 trước)", async () => {
    const order = orderWith("Ready to Fulfill");
    const [first, second] = (await getDeliverySchedule(order.orderId)).batches;
    const error = await captureError(
      move(order.orderId, first?.batchId ?? "", { windowStart: inDays(60), windowEnd: inDays(62) }),
    );
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED" });
    await move(order.orderId, second?.batchId ?? "", {
      windowStart: inDays(70),
      windowEnd: inDays(72),
    });
    expect(
      (
        await move(order.orderId, first?.batchId ?? "", {
          windowStart: inDays(60),
          windowEnd: inDays(62),
        })
      ).batches[0]?.windowStart,
    ).toBe(inDays(60));
  });

  it("bằng chứng: tin nhắn không phải của khách → 400; thiếu bằng chứng / cả hai → 400; thiếu ghi chú / lý do → 400", async () => {
    const order = orderWith("Ready to Fulfill");
    const batchId = (await getDeliverySchedule(order.orderId)).batches[1]?.batchId ?? "";
    expect(
      (
        await captureError(
          move(order.orderId, batchId, { evidenceMessageId: MOCK_STAFF_MESSAGE_ID }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await captureError(move(order.orderId, batchId, { evidenceMessageId: "khong-phai-uuid" })))
        .status,
    ).toBe(400);
    expect(
      (await captureError(move(order.orderId, batchId, { evidenceMessageId: "" }))).status,
    ).toBe(400);
    expect((await captureError(move(order.orderId, batchId, { note: "" }))).status).toBe(400);
    expect(
      (
        await captureError(
          api.post(`/orders/${order.orderId}/delivery-batches/${batchId}/window-change`, {
            windowStart: inDays(30),
            windowEnd: inDays(31),
            reasonCode: "OTHER",
            note: "x",
            evidenceMessageId: CONSENT,
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await captureError(
          api.post(`/orders/${order.orderId}/delivery-batches/${batchId}/window-change`, {
            windowStart: inDays(30),
            windowEnd: inDays(31),
            reasonCode: "SELLER_DELAY",
            note: "x",
            evidenceMessageId: CONSENT,
            evidenceUploadId: CONSENT,
          }),
        )
      ).status,
    ).toBe(400);
  });

  it("đợt đã có lô bàn giao → 409 DELIVERY_BATCH_WINDOW_LOCKED; đợt chưa bàn giao của cùng đơn vẫn dời được", async () => {
    const order = orderWith("Ready to Fulfill");
    shipFirstLine(order);
    const [shipped, waiting] = (await getDeliverySchedule(order.orderId)).batches;
    expect(await captureError(move(order.orderId, shipped?.batchId ?? ""))).toMatchObject({
      status: 409,
      code: "DELIVERY_BATCH_WINDOW_LOCKED",
    });
    expect((await move(order.orderId, waiting?.batchId ?? "")).batches[1]?.windowStart).toBe(
      inDays(30),
    );
    // Đơn Partially Fulfilled của mock-data đã bàn giao đợt duy nhất của nó
    const partial = orderWith("Partially Fulfilled");
    const only = (await getDeliverySchedule(partial.orderId)).batches[0];
    expect((await captureError(move(partial.orderId, only?.batchId ?? ""))).code).toBe(
      "DELIVERY_BATCH_WINDOW_LOCKED",
    );
  });

  it("đơn đã huỷ → 409 CONFLICT; đơn đã giao → khoá; đợt lạ → 404 DELIVERY_BATCH_NOT_FOUND; đơn lạ → 404", async () => {
    const cancelled = orderWith("Cancelled");
    const batchId = (await getDeliverySchedule(cancelled.orderId)).batches[0]?.batchId ?? "";
    expect((await captureError(move(cancelled.orderId, batchId))).code).toBe("CONFLICT");
    const delivered = orderWith("Delivered");
    expect(
      (
        await captureError(
          move(
            delivered.orderId,
            (await getDeliverySchedule(delivered.orderId)).batches[0]?.batchId ?? "",
          ),
        )
      ).code,
    ).toBe("DELIVERY_BATCH_WINDOW_LOCKED");
    expect((await captureError(move(orderWith("Ready to Fulfill").orderId, "BATCH-LA"))).code).toBe(
      "DELIVERY_BATCH_NOT_FOUND",
    );
    expect((await captureError(move("ORD-NOPE", "x"))).status).toBe(404);
  });

  it("chỉ Sale (sales-contracts:UPDATE): Kế toán đọc được lịch nhưng dời → 403; không đổi gì", async () => {
    const order = orderWith("Ready to Fulfill");
    const batchId = (await getDeliverySchedule(order.orderId)).batches[1]?.batchId ?? "";
    for (const userId of ["USER-ACC-01", "USER-WH-01"]) {
      actAs(userId);
      expect((await captureError(move(order.orderId, batchId))).status).toBe(403);
    }
    actAs("USER-SALE-01");
    expect((await getDeliverySchedule(order.orderId)).batches[1]?.windowChanges).toEqual([]);
  });
});
