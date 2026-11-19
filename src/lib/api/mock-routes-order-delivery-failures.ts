/**
 * Mock routes — giao thất bại (WF-05 GH-1, BE `DeliveryFailureController`). Chỉ dùng khi USE_MOCK=true.
 *
 * Mock không dựng hồ sơ: BE mở hồ sơ khi kho nhận lại hàng trên phiếu nhận hàng hoàn, luồng mà mock chưa có — không bịa
 * phiếu / hồ sơ. Danh sách luôn rỗng; quyết định trên hồ sơ lạ trả 404 DELIVERY_FAILURE_CASE_NOT_FOUND như BE, huỷ khi
 * chưa có hồ sơ trả 409 DELIVERY_FAILURE_INVALID_TRANSITION (đơn mock không bao giờ giữ vì giao thất bại).
 *
 * Phải đăng ký TRƯỚC `/orders/:id` (`/orders/delivery-failures` là segment tĩnh).
 */

import { registerMockRoute } from "./mock-adapter";
import { fail, ok, pathParams } from "./mock-route-utils";
import { findOrder } from "./mock-routes-orders-store";

const orderNotFound = () => fail(404, "NOT_FOUND", "Resource not found");

export function registerOrderDeliveryFailureMockRoutes(): void {
  registerMockRoute("GET", "/orders/delivery-failures", async () => ok([]));

  registerMockRoute("GET", "/orders/:id/delivery-failures", async (config) => {
    const order = await findOrder(pathParams(config).id ?? "");
    return order ? ok([]) : orderNotFound();
  });

  for (const step of ["redelivery", "cancellation"] as const) {
    registerMockRoute("POST", `/orders/:id/delivery-failures/:caseId/${step}`, async (config) => {
      const order = await findOrder(pathParams(config).id ?? "");
      if (!order) return orderNotFound();
      return fail(404, "DELIVERY_FAILURE_CASE_NOT_FOUND", "Delivery failure case not found");
    });
  }

  registerMockRoute("POST", "/orders/:id/delivery-failures/cancellation", async (config) => {
    const order = await findOrder(pathParams(config).id ?? "");
    if (!order) return orderNotFound();
    return fail(
      409,
      "DELIVERY_FAILURE_INVALID_TRANSITION",
      "This delivery failure case cannot take that step now",
    );
  });
}
