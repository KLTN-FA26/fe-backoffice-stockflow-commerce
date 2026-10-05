/**
 * Mock routes — Đơn hàng (module 14/17), tách khỏi `mock-routes.ts` như NCC.
 *
 * Trả đúng hợp đồng BE `OrderController` (develop): body `{ success, data }` (interceptor
 * ở client.ts bóc), `OrderResponse` với status UPPER_CASE, PageResponse trang từ 0, lỗi
 * `{ errorCode, message, fieldErrors[], correlationId }`. Mock và BE thật đi chung một
 * đường parse ở `features/order/api.ts`.
 * File này + `mock-routes*.ts` + `mock-adapter.ts` là nơi duy nhất đọc `mock-data.ts`.
 */

import { paginatePage, registerMockRoute } from "./mock-adapter";

import type { AxiosRequestConfig } from "axios";
import type { Order, OrderStatus } from "@/lib/mock-data";

type BackendOrderStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "IN_FULFILMENT"
  | "ON_HOLD"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "RETURNED";

/**
 * mock-data dùng 20 trạng thái docs 17; BE chỉ có 10. Gộp về trạng thái BE gần nhất.
 * ASSUMPTION (mock-only): các state docs không có ở BE (Picking, Packed, In Transit…)
 * không bao giờ đến từ API thật nên chỉ cần ánh xạ hợp lý để demo.
 */
const MOCK_TO_BACKEND_STATUS: Record<OrderStatus, BackendOrderStatus> = {
  "Pending Payment": "PENDING_PAYMENT",
  // BE: PENDING_PAYMENT ──paymentFailed──▶ CANCELLED (OrderStatus.java javadoc)
  "Payment Failed": "CANCELLED",
  Confirmed: "PAID",
  "In Production": "IN_FULFILMENT",
  "Ready to Fulfill": "IN_FULFILMENT",
  Picking: "IN_FULFILMENT",
  Packed: "IN_FULFILMENT",
  "Partially Fulfilled": "IN_FULFILMENT",
  "On Hold": "ON_HOLD",
  Shipped: "SHIPPED",
  "In Transit": "SHIPPED",
  "Delivery Failed": "SHIPPED",
  Delivered: "DELIVERED",
  "Return Requested": "DELIVERED",
  Completed: "COMPLETED",
  Closed: "COMPLETED",
  Cancelled: "CANCELLED",
  Returned: "RETURNED",
  Refunded: "RETURNED",
  "Partially Refunded": "RETURNED",
};

/**
 * BE BR-031 (`order/api/OrderStatus.java#canTransitionTo`); docs 17 BR-03 (§6 / §4.5):
 * từ SHIPPED trở đi hàng đã ở chỗ hãng vận chuyển — phải đi flow trả hàng, không huỷ.
 */
const CANCELLABLE_STATUSES: readonly BackendOrderStatus[] = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "IN_FULFILMENT",
  "ON_HOLD",
];

/** Trạng thái đã đổi trong phiên mock (huỷ đơn) — không sửa object của mock-data. */
const statusOverrides = new Map<string, BackendOrderStatus>();

export function resetOrderMockStore(): void {
  statusOverrides.clear();
}

function backendStatus(order: Order): BackendOrderStatus {
  return statusOverrides.get(order.orderId) ?? MOCK_TO_BACKEND_STATUS[order.status];
}

/** mock-data `Order` → BE `OrderResponse`. Chỉ field có trong hợp đồng BE. */
function toOrderResponse(order: Order) {
  const address = {
    recipientName: order.recipientName,
    phone: order.recipientPhone,
    line1: order.shippingAddress.street,
    line2: order.shippingAddress.district,
    wardCode: null,
    wardName: order.shippingAddress.ward,
    provinceCode: null,
    provinceName: order.shippingAddress.province,
    countryCode: order.shippingAddress.country,
    postalCode: order.shippingAddress.postalCode,
  };
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: backendStatus(order),
    totalAmount: order.grandTotal,
    currency: order.currency,
    lines: order.lines.map((line) => ({
      lineId: line.lineId,
      sku: line.skuId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.lineTotal,
      reservationIds: [],
      designSnapshotId: null,
      designChecksum: null,
    })),
    placedAt: order.placedAt,
    createdBy: order.createdById ?? null,
    lastModifiedAt: null,
    lastModifiedBy: null,
    contactName: order.recipientName,
    contactEmail: null,
    contactPhone: order.recipientPhone,
    shippingAddress: address,
    billingAddress: null,
  };
}

function ok(data: unknown) {
  return { status: 200, data: { success: true, data }, headers: {} };
}

function error(status: number, errorCode: string, message: string, fieldErrors?: unknown[]) {
  return {
    status,
    data: { success: false, errorCode, message, fieldErrors, correlationId: `mock-${Date.now()}` },
    headers: {},
  };
}

function idParam(config: AxiosRequestConfig): string {
  const params = (config as Record<string, unknown>)._mockParams as Record<string, string>;
  return decodeURIComponent(params.id ?? "");
}

function readParams(config: AxiosRequestConfig): URLSearchParams {
  if (config.params instanceof URLSearchParams) return new URLSearchParams(config.params);
  return new URLSearchParams(config.url?.split("?")[1] ?? "");
}

function readReason(data: unknown): string {
  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      parsed = {};
    }
  }
  if (typeof parsed !== "object" || parsed === null || !("reason" in parsed)) return "";
  return typeof parsed.reason === "string" ? parsed.reason.trim() : "";
}

type OrderResponse = ReturnType<typeof toOrderResponse>;

function compareOrders(a: OrderResponse, b: OrderResponse, field: string): number {
  switch (field) {
    case "orderNumber":
      return a.orderNumber.localeCompare(b.orderNumber);
    case "totalAmount":
      return a.totalAmount - b.totalAmount;
    case "status":
      return a.status.localeCompare(b.status);
    default:
      return new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();
  }
}

export function registerOrderMockRoutes(): void {
  // GET /orders — ASSUMPTION: BE chưa có list admin; PageResponse trang từ 0,
  // `search`/`status` (giá trị BE)/`sort=field,dir` theo quy ước NCC.
  registerMockRoute("GET", "/orders", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const params = readParams(config);
    const page = Math.max(0, Number(params.get("page")) || 0);
    const size = Math.max(1, Number(params.get("size")) || 15);
    const search = params.get("search")?.trim().toLowerCase();
    const statuses = params.getAll("status");
    const [sortField = "placedAt", sortDir = "desc"] = (
      params.get("sort") ?? "placedAt,desc"
    ).split(",");

    let filtered = orders.map(toOrderResponse);
    if (search)
      filtered = filtered.filter((o) =>
        [o.orderNumber, o.contactName, o.contactPhone, o.orderId].some((value) =>
          value.toLowerCase().includes(search),
        ),
      );
    if (statuses.length) filtered = filtered.filter((o) => statuses.includes(o.status));
    filtered.sort((a, b) => {
      const result = compareOrders(a, b, sortField);
      return sortDir === "desc" ? -result : result;
    });

    return ok(paginatePage(filtered, page, size));
  });

  // GET /orders/:id
  registerMockRoute("GET", "/orders/:id", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const order = orders.find((o) => o.orderId === idParam(config));
    if (!order) return error(404, "NOT_FOUND", "Resource not found");
    return ok(toOrderResponse(order));
  });

  // POST /orders/:id/admin-cancellation — BE OrderController#adminCancel, scope ALL.
  registerMockRoute("POST", "/orders/:id/admin-cancellation", async (config) => {
    const { orders } = await import("@/lib/mock-data");
    const order = orders.find((o) => o.orderId === idParam(config));
    // 404 chứ không 403 — không tiết lộ đơn có tồn tại hay không (BE findByIdInScope).
    if (!order) return error(404, "NOT_FOUND", "Resource not found");

    if (!readReason(config.data)) {
      return error(400, "VALIDATION_FAILED", "Invalid request data", [
        { field: "reason", message: "reason is required", code: "NotBlank" },
      ]);
    }

    const current = backendStatus(order);
    // BE BR-031 (OrderStatus#canTransitionTo); docs 17 BR-03 — hotfix BE #35 trả 409.
    if (!CANCELLABLE_STATUSES.includes(current)) {
      return error(
        409,
        "CONFLICT",
        `Order ${order.orderNumber} cannot be cancelled from status ${current}`,
      );
    }

    statusOverrides.set(order.orderId, "CANCELLED");
    return ok(null);
  });
}
