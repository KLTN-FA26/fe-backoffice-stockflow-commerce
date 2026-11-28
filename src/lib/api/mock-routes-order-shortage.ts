/**
 * Mock routes — thẻ thiếu thùng (BE `ShortageCardController`, docs 17 §4.14). Chỉ dùng khi USE_MOCK=true.
 *
 * Mock không dựng tình huống thiếu thùng (cần phiếu lấy hàng báo thiếu + kho không phân bổ lại được — luồng mà mock chưa
 * có): xem trước luôn "không gửi được vì đơn không treo", gửi thẻ và Thực hiện trả 409 như BE với một đơn không đủ điều kiện.
 */

import { registerMockRoute } from "./mock-adapter";
import { fail, ok, pathParams } from "./mock-route-utils";
import { findOrder } from "./mock-routes-orders-store";

export function registerOrderShortageMockRoutes(): void {
  registerMockRoute("GET", "/orders/:id/shortage", async (config) => {
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return fail(404, "NOT_FOUND", "Resource not found");
    return ok({
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      sendable: false,
      notSendable: "NOT_ON_HOLD",
      lines: [],
      options: [],
      history: [],
    });
  });

  registerMockRoute("POST", "/chat/conversations/:id/cards/shortage", async () =>
    fail(409, "SHORTAGE_CARD_NOT_SENDABLE", "This order cannot take a shortage card now"),
  );

  registerMockRoute("POST", "/orders/:id/shortage-cards/:cardId/execution/:step", async () =>
    fail(404, "SHORTAGE_CARD_NOT_FOUND", "Shortage card not found"),
  );
}
