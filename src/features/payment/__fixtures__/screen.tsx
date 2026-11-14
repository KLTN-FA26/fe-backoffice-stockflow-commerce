/**
 * Render một màn thanh toán với API giả lập theo URL, đi qua chuỗi thật `/identity/me/permissions` →
 * `useCan` → UI (mẫu `test/api-screen.tsx`). Quyền nhập thẳng theo mã (BE seed V20261108002400 +
 * V20261108003000) — không gắn tên vai trò.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_RECEIPT_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
} from "@/constants/payment";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

// jsdom không có ResizeObserver / pointer capture / scrollIntoView mà Select và Checkbox (Radix) dùng.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

export type RouteHandler = (params: unknown, body?: unknown) => unknown;
export type RouteTable = Record<string, RouteHandler>;

/** Kế toán: đợt (xem), phiếu thu và hoàn tiền (xem + lập + huỷ). */
export const ACCOUNTANT_GRANTS: PermissionCode[] = [
  ...Object.values(PAYMENT_INSTALLMENT_PERMISSIONS),
  ...Object.values(PAYMENT_RECEIPT_PERMISSIONS),
  ...Object.values(PAYMENT_REFUND_PERMISSIONS),
];
/** Sales: đợt và hoàn tiền chỉ xem; không có quyền phiếu thu. */
export const SALES_GRANTS: PermissionCode[] = [
  PAYMENT_INSTALLMENT_PERMISSIONS.viewPage,
  PAYMENT_INSTALLMENT_PERMISSIONS.read,
  PAYMENT_REFUND_PERMISSIONS.viewPage,
  PAYMENT_REFUND_PERMISSIONS.read,
];
/** Mở được trang nhưng thiếu quyền đọc dữ liệu. */
export const PAGE_ONLY_GRANTS: PermissionCode[] = [
  PAYMENT_INSTALLMENT_PERMISSIONS.viewPage,
  PAYMENT_RECEIPT_PERMISSIONS.viewPage,
  PAYMENT_REFUND_PERMISSIONS.viewPage,
];

export function mockPaymentApi(
  grants: PermissionCode[],
  routes: { get?: RouteTable; post?: RouteTable } = {},
) {
  const wrap =
    (table: RouteTable | undefined, method: string) =>
    async (url: string, bodyOrConfig?: unknown) => {
      if (method === "GET" && url === "/identity/me/permissions")
        return { data: { roles: [], permissions: grants, dataScope: "ALL" } };
      const handler = table?.[url];
      if (!handler) throw new Error(`Không có mock cho ${method} ${url}`);
      const params =
        method === "GET" ? (bodyOrConfig as { params?: unknown } | undefined)?.params : undefined;
      return { data: await handler(params, method === "GET" ? undefined : bodyOrConfig) };
    };
  return {
    get: vi.spyOn(api, "get").mockImplementation(wrap(routes.get, "GET")),
    post: vi.spyOn(api, "post").mockImplementation(wrap(routes.post, "POST")),
  };
}

export function renderPaymentScreen(ui: React.ReactElement, searchParams = "") {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@example.com",
      roles: [],
      username: "test",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    isAuthenticated: true,
    status: "authenticated",
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

/** `InstallmentResponse` như BE trả (trường chưa đặt vắng mặt). */
export const installmentJson = (over: Record<string, unknown> = {}) => ({
  installmentId: "inst-2",
  contractId: "con-1",
  contractNumber: "HD-20261108-000013-1",
  orderId: "ord-13",
  orderNumber: "SO-20261108-000013",
  customerId: "cust-9",
  seq: 2,
  name: "Trả trước khi nhận đợt giao 1",
  milestone: "BEFORE_DELIVERY",
  deliveryBatchSeq: 1,
  amount: 25_000_000,
  paidAmount: 0,
  reducedAmount: 0,
  outstanding: 25_000_000,
  currency: "VND",
  reachedAt: "2026-11-11T02:00:00Z",
  status: "DUE",
  overdue: false,
  transferReference: "HD-20261108-000013-1 DOT2",
  ...over,
});

export const receiptJson = (over: Record<string, unknown> = {}) => ({
  receiptId: "rcp-1",
  customerId: "cust-9",
  reference: "FT26313123456",
  receivedOn: "2026-11-10",
  amount: 25_000_000,
  currency: "VND",
  status: "RECORDED",
  recordedAt: "2026-11-10T03:00:00Z",
  lines: [{ installmentId: "inst-2", amount: 25_000_000 }],
  ...over,
});

export const refundJson = (over: Record<string, unknown> = {}) => ({
  orderId: "ord-15",
  orderNumber: "SO-20261108-000015",
  currency: "VND",
  refundStatus: "PENDING",
  refundable: 12_000_000,
  refunded: 0,
  remaining: 12_000_000,
  ...over,
});
