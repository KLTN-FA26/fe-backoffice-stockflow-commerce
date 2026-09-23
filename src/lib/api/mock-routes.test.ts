/**
 * Mock route tests — POST /orders/:id/admin-cancellation.
 *
 * Gọi handler trực tiếp qua `resolveMockRoute` thay vì qua axios: adapter thật có
 * delay 200–500ms và 5% lỗi 500 ngẫu nhiên (mock-adapter.ts) → test sẽ flaky.
 *
 * File này nằm ở `src/lib/api/` (không phải `src/features/`) vì cần import
 * `mock-data.ts` để dựng fixture — CI grep chặn import đó trong
 * `src/app|components|features`.
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { orders } from "@/lib/mock-data";

import { resolveMockRoute } from "./mock-adapter";
import { registerAllMockRoutes } from "./mock-routes";

import type { AxiosRequestConfig } from "axios";
import type { Order } from "@/lib/mock-data";

const PATH = (id: string) => `/orders/${id}/admin-cancellation`;

interface ErrorBody {
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

async function postAdminCancel(id: string, body?: unknown) {
  const matched = resolveMockRoute("POST", PATH(id));
  if (!matched) throw new Error(`No mock route for POST ${PATH(id)}`);
  const config = {
    url: PATH(id),
    method: "POST",
    data: body === undefined ? undefined : JSON.stringify(body),
    _mockParams: matched.params,
  } as AxiosRequestConfig;
  return matched.handler(config);
}

/** Đơn đầu tiên ở trạng thái huỷ được / không huỷ được, lấy từ chính mock-data. */
function findOrder(predicate: (order: Order) => boolean): Order {
  const found = orders.find(predicate);
  if (!found) throw new Error("Fixture không tìm thấy trong mock-data");
  return found;
}

const CANCELLABLE = ["Draft", "Pending Payment", "Confirmed", "Ready to Fulfill", "On Hold"];

describe("POST /orders/:id/admin-cancellation (mock)", () => {
  beforeAll(() => {
    registerAllMockRoutes();
  });

  // Handler mutate `order.status` trên module state dùng chung → restore sau mỗi test.
  const touched: { order: Order; status: Order["status"] }[] = [];
  const track = (order: Order) => {
    touched.push({ order, status: order.status });
    return order;
  };
  afterEach(() => {
    for (const { order, status } of touched) order.status = status;
    touched.length = 0;
  });

  it("id không tồn tại → 404 NOT_FOUND, không tiết lộ đơn có tồn tại hay không", async () => {
    const res = await postAdminCancel("ORD-KHONG-TON-TAI", { reason: "test" });
    expect(res.status).toBe(404);
    expect((res.data as ErrorBody).code).toBe("NOT_FOUND");
  });

  it("reason rỗng → 400 VALIDATION_FAILED + fieldErrors.reason", async () => {
    const order = track(findOrder((o) => CANCELLABLE.includes(o.status)));
    const res = await postAdminCancel(order.orderId, { reason: "   " });
    expect(res.status).toBe(400);
    const body = res.data as ErrorBody;
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fieldErrors?.reason).toBe("Lý do huỷ là bắt buộc");
    expect(order.status).not.toBe("Cancelled");
  });

  it("body thiếu hẳn → 400 VALIDATION_FAILED", async () => {
    const order = track(findOrder((o) => CANCELLABLE.includes(o.status)));
    const res = await postAdminCancel(order.orderId);
    expect(res.status).toBe(400);
    expect((res.data as ErrorBody).code).toBe("VALIDATION_FAILED");
  });

  it("BE BR-031; docs BR-03: huỷ đơn đã Shipped → 409 CONFLICT", async () => {
    const order = track(findOrder((o) => o.status === "Shipped"));
    const res = await postAdminCancel(order.orderId, { reason: "khách yêu cầu" });
    expect(res.status).toBe(409);
    expect((res.data as ErrorBody).code).toBe("CONFLICT");
    expect(order.status).toBe("Shipped");
  });

  it("BE BR-031; docs BR-03: huỷ đơn đã Delivered → 409 CONFLICT", async () => {
    const order = track(findOrder((o) => o.status === "Delivered"));
    const res = await postAdminCancel(order.orderId, { reason: "khách yêu cầu" });
    expect(res.status).toBe(409);
    expect((res.data as ErrorBody).code).toBe("CONFLICT");
  });

  it("happy path: đơn huỷ được + có reason → 200 và status thành Cancelled", async () => {
    const order = track(findOrder((o) => CANCELLABLE.includes(o.status)));
    const res = await postAdminCancel(order.orderId, { reason: "khách đổi ý" });
    expect(res.status).toBe(200);
    expect(order.status).toBe("Cancelled");
  });
});
