/**
 * Mock routes — lô hàng hoàn về (WF-05 GH-1 / BO-01, BE `DeliveryFailureController`). Chỉ dùng khi USE_MOCK=true.
 *
 * Mock không dựng hồ sơ: BE mở hồ sơ khi kho nhận lại hàng trên phiếu nhận hàng hoàn, luồng mà mock chưa có — không bịa
 * phiếu / hồ sơ. Danh sách luôn rỗng; huỷ trên hồ sơ lạ trả 404 DELIVERY_FAILURE_CASE_NOT_FOUND như BE, huỷ khi chưa có
 * hồ sơ trả 409 DELIVERY_FAILURE_INVALID_TRANSITION (đơn mock không bao giờ giữ vì giao thất bại), đóng phần thất lạc trả
 * 409 ORDER_SHIPMENT_NOT_LOST_CLOSABLE (đơn mock không có lô hãng báo thất lạc).
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

  // "Giao lại" (`…/redelivery`) BE đã xoá ở PR #377 — mock không đăng ký (WF-05 BO-01)
  registerMockRoute(
    "POST",
    "/orders/:id/delivery-failures/:caseId/cancellation",
    async (config) => {
      const order = await findOrder(pathParams(config).id ?? "");
      if (!order) return orderNotFound();
      return fail(404, "DELIVERY_FAILURE_CASE_NOT_FOUND", "Delivery failure case not found");
    },
  );

  // Đóng phần thất lạc (Q-12, F-5): đơn mock không có lô LOST → slot tải tệp và lệnh đều 409 như BE với lô không đóng được
  for (const path of [
    "/orders/:id/shipments/:shipmentId/lost-closure/evidence/uploads",
    "/orders/:id/shipments/:shipmentId/lost-closure",
  ]) {
    registerMockRoute("POST", path, async (config) => {
      const order = await findOrder(pathParams(config).id ?? "");
      if (!order) return orderNotFound();
      return fail(
        409,
        "ORDER_SHIPMENT_NOT_LOST_CLOSABLE",
        "This shipment cannot be closed as lost",
      );
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
