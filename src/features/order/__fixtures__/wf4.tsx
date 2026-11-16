/**
 * Fixture WF4 FE-4a: yêu cầu huỷ của khách + lịch giao / dời cửa sổ giao trên màn chi tiết đơn. Response đúng hình BE
 * (`CancellationRequestResponse`, `DeliveryBatchService.Schedule`, `OrderRefundResponse`); quyền theo MÃ QUYỀN BE.
 */

import { act } from "@testing-library/react";

import {
  CANCELLATION_REQUEST_PERMISSIONS,
  ORDER_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
  SALES_CONTRACT_PERMISSIONS,
} from "@/constants";

import { toLocalIsoDate } from "@/lib/format/date";

import { OrderDetail } from "../components/OrderDetail";

import { DETAIL_PATH, HISTORY_PATH } from "./detail";
import { apiOrder, apiOrderAt } from "./order";
import { mockOrderApiGet, ORDER_PERMISSION_SETS, renderOrderScreen } from "./render";
import type { RouteHandler } from "./render";

import type { PermissionCode } from "@/lib/auth";

export const REQUESTS_PATH = "/orders/cancellation-requests";
export const SCHEDULE_PATH = `${DETAIL_PATH}/delivery-batches`;
export const REFUND_PATH = `/refunds/orders/${apiOrder.orderId}`;
export const REQUEST_ID = "c1a2b3c4-0000-4000-8000-00000000aaaa";
export const BATCH_1 = "b1b1b1b1-0000-4000-8000-000000000001";
export const BATCH_2 = "b2b2b2b2-0000-4000-8000-000000000002";
export const CONSENT_MESSAGE = "3f6c9a52-8a63-4f1c-9d3a-6f4f2a1b7c10";

/**
 * Seed BE (PermissionMatrixTest): `sales-order-cancellations:READ` + `sales-contracts:UPDATE` chỉ SALES_STAFF + SYSTEM_ADMIN;
 * `payment-refunds:READ` còn ACCOUNTANT; `sales-contracts:READ` còn ACCOUNTANT (không có quản lý kho).
 */
export const WF4_PERMISSION_SETS = {
  sales: [
    ...ORDER_PERMISSION_SETS.salesStaff,
    CANCELLATION_REQUEST_PERMISSIONS.read,
    SALES_CONTRACT_PERMISSIONS.read,
    SALES_CONTRACT_PERMISSIONS.update,
    PAYMENT_REFUND_PERMISSIONS.read,
  ],
  /** Đọc được yêu cầu huỷ + lịch giao nhưng không quyết / không dời. */
  salesReadOnly: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    CANCELLATION_REQUEST_PERMISSIONS.read,
    SALES_CONTRACT_PERMISSIONS.read,
  ],
  /** Kế toán đọc đơn + lịch giao + hoàn tiền, không có hàng đợi huỷ, không dời. */
  accountant: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    SALES_CONTRACT_PERMISSIONS.read,
    PAYMENT_REFUND_PERMISSIONS.read,
  ],
  /** Quản lý kho của kho xuất: release, không có quyền đọc hợp đồng / hàng đợi huỷ. */
  warehouseManager: ORDER_PERMISSION_SETS.warehouseManager,
} satisfies Record<string, PermissionCode[]>;

export const apiCancellationRequest = (patch: Record<string, unknown> = {}) => ({
  requestId: REQUEST_ID,
  orderId: apiOrder.orderId,
  requestedBy: "11111111-0000-4000-8000-000000000001",
  reasonCode: "CUSTOMER_REQUEST",
  note: "Khách hoãn dự án",
  requestedAt: "2026-11-10T03:00:00Z",
  status: "PENDING",
  version: 0,
  ...patch,
});

export const requestPage = (items: unknown[]) => ({
  items,
  page: 0,
  size: 10,
  totalElements: items.length,
  totalPages: items.length > 0 ? 1 : 0,
  hasNext: false,
  hasPrevious: false,
});

/** `YYYY-MM-DD` cách hôm nay `days` ngày (Asia/Ho_Chi_Minh) — lịch giao luôn "tương lai" dù test chạy ngày nào. */
export const inDays = (days: number): string =>
  toLocalIsoDate(new Date(Date.now() + days * 86_400_000).toISOString());

export const apiBatch = (patch: Record<string, unknown> = {}) => ({
  batchId: BATCH_1,
  seq: 1,
  contractWindowStart: inDays(10),
  contractWindowEnd: inDays(14),
  windowStart: inDays(10),
  windowEnd: inDays(14),
  state: "READY",
  late: false,
  releasedAt: "2026-11-11T03:00:00Z",
  lines: [{ orderLineId: "l-1", sku: "TSHIRT-WHT-M", cartons: 4, heldCartons: 4 }],
  windowChanges: [],
  ...patch,
});

export const apiSchedule = (batches: unknown[] = [apiBatch()]) => ({
  orderId: apiOrder.orderId,
  orderNumber: apiOrder.orderNumber,
  contractNumber: "HD-0001",
  batches,
});

export const apiRefund = (patch: Record<string, unknown> = {}) => ({
  orderId: apiOrder.orderId,
  currency: "VND",
  refundStatus: "PENDING",
  settlements: [
    {
      settlementId: "s-1",
      kind: "ORDER_CANCELLED",
      collected: 1_000_000,
      fee: 300_000,
      feePercent: 30,
      feeCovered: 300_000,
      refundable: 700_000,
      feeOwed: 0,
      feeReason: "Phôi đã in",
      feeDetail: "Thoả thuận qua điện thoại",
    },
  ],
  ...patch,
});

/** Render chi tiết đơn (mặc định PICKING) với các route phụ của WF4; route không khai báo thì không được gọi. */
export async function renderWf4Detail(
  permissions: readonly PermissionCode[],
  routes: Record<string, RouteHandler> = {},
  status: Parameters<typeof apiOrderAt>[0] = "PICKING",
) {
  const spy = mockOrderApiGet(permissions, {
    [DETAIL_PATH]: () => apiOrderAt(status),
    [HISTORY_PATH]: () => [],
    ...routes,
  });
  await act(async () => {
    renderOrderScreen(<OrderDetail params={Promise.resolve({ id: apiOrder.orderId })} />);
  });
  return spy;
}

/** Số lần `api.get` đã gọi một path (để chứng minh "không có quyền → không gọi API"). */
export const callsTo = (spy: { mock: { calls: unknown[][] } }, path: string) =>
  spy.mock.calls.filter((call) => call[0] === path).length;
