/**
 * Render một màn có API giả lập theo URL — đi qua chuỗi thật `/identity/me/permissions` → useCan
 * → UI (mẫu `features/receipt/__fixtures__/render.tsx`, dùng chung cho các module bán hàng / sản xuất).
 * Bộ quyền theo vai trò từ BE, cập nhật resource đổi trạng thái khách và chuyển báo giá
 * thành đơn theo migration V20261022000200 và V20261017000300.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";
import { TooltipProvider } from "@/components/ui/tooltip";

import type { AssignedWarehouse, MyPermissions, PermissionCode } from "@/lib/auth";

/** Quyền theo resource BE liên quan đến các màn trong bộ test. */
export const ROLE_PERMISSIONS = {
  SALES_STAFF: [
    "customer-customers:VIEW_PAGE",
    "customer-customers:READ",
    "customer-customers:CREATE",
    "customer-customers:UPDATE",
    "customer-customers:APPROVE",
    "customer-credit-profiles:VIEW_PAGE",
    "customer-credit-profiles:READ",
    // V20270102000100 (BE PR #490): Sale gửi đề nghị cấp hạn mức thay khách và ghi ý kiến
    "customer-credit-requests:VIEW_PAGE",
    "customer-credit-requests:READ",
    "customer-credit-requests:CREATE",
    "customer-credit-requests:UPDATE",
    "customer-legal-profiles:READ",
    "customer-legal-profiles:UPDATE",
    "customer-addresses:READ",
    "sales-quotes:VIEW_PAGE",
    "sales-quotes:READ",
    "sales-quotes:CREATE",
    "sales-quotes:UPDATE",
    "sales-quote-conversions:CREATE",
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-sample-requests:CREATE",
    "production-sample-requests:UPDATE",
    "production-sample-requests:APPROVE",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-qc-results:READ",
    // Baseline V20261111000000: Sale mở được trang đơn (link số đơn trong chat, AUTH-8)
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    // V20261017000800 (PR #109): nộp mẫu vào kho thật + chọn thiết kế đã xác nhận của khách.
    "warehouse-warehouses:READ",
    "design-snapshots:READ",
    // V20261124000300 (chat foundation): SALES_STAFF đủ chat-conversations và chat-canned-responses
    // (không có chat-supervision: chỉ quản lý phân công).
    "chat-canned-responses:READ",
    "chat-conversations:VIEW_PAGE",
    "chat-conversations:READ",
    "chat-conversations:CREATE",
    "chat-conversations:UPDATE",
    // V20261111000000 (baseline): đọc thiết kế của khách và hộp yêu cầu báo giá — KHÔNG có design-designs:APPROVE.
    "design-designs:VIEW_PAGE",
    "design-designs:READ",
    "design-quote-requests:VIEW_PAGE",
    "design-quote-requests:READ",
    "design-quote-requests:UPDATE",
    // V20261230000100 (13 BR-04 sửa ngày 2026-11-26): Sale xem giá chuẩn, không sửa.
    "catalog-standard-prices:VIEW_PAGE",
    "catalog-standard-prices:READ",
  ],
  // V20261111000000 (baseline) + V20261213000200: yêu cầu báo giá, xem khách; đọc thiết kế qua yêu cầu báo giá đang mở.
  // design-designs:APPROVE đã chuyển sang PRODUCTION_COORDINATOR. V20261227000400 (AUTH-4): mở trang báo giá và trang
  // đơn (link trong chat) — chỉ xem, không lập / sửa.
  SALES_MANAGER: [
    "customer-customers:VIEW_PAGE",
    "customer-customers:READ",
    "sales-quotes:VIEW_PAGE",
    "sales-quotes:READ",
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "design-designs:VIEW_PAGE",
    "design-designs:READ",
    "design-quote-requests:VIEW_PAGE",
    "design-quote-requests:READ",
    "design-quote-requests:UPDATE",
    "chat-conversations:VIEW_PAGE",
    "chat-conversations:READ",
    // V20261230000100 / V20261230000200 (13 BR-04, 14 BR-10 sửa ngày 2026-11-26): giữ giá chuẩn, duyệt giá báo giá.
    "catalog-standard-prices:VIEW_PAGE",
    "catalog-standard-prices:READ",
    "catalog-standard-prices:CREATE",
    "catalog-standard-prices:UPDATE",
    "catalog-standard-prices:DELETE",
    "sales-quote-price-approvals:APPROVE",
  ],
  // V20261213000200: Điều phối sản xuất duyệt thiết kế của khách (kltn-docs 12 §4.4, §4.10).
  PRODUCTION_COORDINATOR: [
    "design-designs:VIEW_PAGE",
    "design-designs:READ",
    "design-designs:APPROVE",
  ],
  ECOMMERCE_ADMIN: [
    "customer-customers:VIEW_PAGE",
    "customer-customers:READ",
    "customer-customers:CREATE",
    "customer-customers:UPDATE",
    "customer-customers:APPROVE",
    "customer-status:APPROVE",
    "customer-addresses:READ",
  ],
  ORDER_COORDINATOR: [
    "customer-credit-profiles:READ",
    "sales-quotes:VIEW_PAGE",
    "sales-quotes:READ",
    "sales-quote-conversions:CREATE",
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "sales-orders:APPROVE",
  ],
  PRODUCTION_STAFF: [
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-orders:UPDATE",
    "production-material-issues:READ",
    "production-qc-results:READ",
  ],
  WAREHOUSE_STAFF: [
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-material-issues:READ",
    "production-material-issues:CREATE",
    "warehouse-warehouses:READ",
    "warehouse-locations:READ",
    // Cất hàng (docs 05): baseline + V20261124000100 — nhân viên kho xem và cất, không đóng chuyến hộ
    "warehouse-putaway-tasks:VIEW_PAGE",
    "warehouse-putaway-tasks:READ",
    "warehouse-putaway-tasks:UPDATE",
    "warehouse-putaway-trips:VIEW_PAGE",
    "warehouse-putaway-trips:READ",
    "warehouse-putaway-trips:UPDATE",
  ],
  WAREHOUSE_MANAGER: [
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-orders:CREATE",
    "production-orders:UPDATE",
    "production-material-issues:READ",
    "production-material-issues:CREATE",
    "production-qc-results:READ",
    "production-qc-results:CREATE",
    "warehouse-warehouses:READ",
    "warehouse-locations:READ",
    // V20261017000800 (PR #109): chọn nhà gia công in khi tách LSX.
    "procurement-suppliers:READ",
    "warehouse-putaway-tasks:VIEW_PAGE",
    "warehouse-putaway-tasks:READ",
    "warehouse-putaway-tasks:UPDATE",
    "warehouse-putaway-trips:VIEW_PAGE",
    "warehouse-putaway-trips:READ",
    "warehouse-putaway-trips:UPDATE",
    "warehouse-putaway-trips:APPROVE",
  ],
  QC_STAFF: [
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-orders:VIEW_PAGE",
    "production-orders:READ",
    "production-qc-results:READ",
    "production-qc-results:CREATE",
  ],
  // V20261013000400 (hồ sơ công nợ, hàng đợi duyệt) + WF-02 r6 AUTH-6 (BE: xem khách để cấp hạn mức).
  ACCOUNTANT: [
    "customer-customers:VIEW_PAGE",
    "customer-customers:READ",
    "customer-credit-profiles:VIEW_PAGE",
    "customer-credit-profiles:READ",
    "customer-credit-profiles:APPROVE",
    "sales-order-credit-holds:VIEW_PAGE",
    "sales-order-credit-holds:READ",
    "sales-order-credit-holds:APPROVE",
    // V20270102000100 / V20270103000100 (BE PR #490): duyệt đề nghị hạn mức; hàng chờ chuyển khoản SePay
    "customer-credit-requests:VIEW_PAGE",
    "customer-credit-requests:READ",
    "customer-credit-requests:APPROVE",
    "payment-bank-transactions:VIEW_PAGE",
    "payment-bank-transactions:READ",
    "payment-bank-transactions:UPDATE",
  ],
  CUSTOMER: [
    "customer-customers:VIEW_PAGE",
    "customer-customers:READ",
    "sales-orders:VIEW_PAGE",
    "sales-orders:READ",
    "sales-orders:CREATE",
    "sales-quotes:VIEW_PAGE",
    "sales-quotes:READ",
    "sales-quotes:APPROVE",
    "production-sample-requests:VIEW_PAGE",
    "production-sample-requests:READ",
    "production-sample-requests:APPROVE",
    // Khách cũng có mã này nhưng BE từ chối ở /design-snapshots (chỉ back-office).
    "design-snapshots:READ",
  ],
} satisfies Record<string, PermissionCode[]>;

export type TestRole = keyof typeof ROLE_PERMISSIONS;
export type RouteHandler = (params: unknown, body?: unknown) => unknown;
export type RouteTable = Record<string, RouteHandler>;

/**
 * Lỗi BE dạng ApiError để route giả lập ném ra. `message` = câu BE trả (mặc định bằng mã → màn dùng câu FE);
 * `details` = `ApiResponse.details` nguyên dạng.
 */
export function apiError(
  status: number,
  code: string,
  fieldErrors?: Record<string, string>,
  message: string = code,
  details?: Record<string, unknown>,
) {
  return new ApiError(status, code, message, fieldErrors, undefined, undefined, undefined, details);
}

/** Giả lập `api.get/post/put` theo URL. Trả spy để kiểm tra params / body đã gửi. */
export function mockApi(
  role: TestRole,
  routes: { get?: RouteTable; post?: RouteTable; put?: RouteTable } = {},
  /**
   * Phạm vi dữ liệu + kho được gán trả về ở `/identity/me/permissions` (BE #394). Mặc định `ALL`. `extra`: quyền thêm cho
   * một test (vd quyền mới của BE chưa có trong bộ theo vai trò ở trên).
   */
  me: {
    dataScope?: MyPermissions["dataScope"];
    warehouses?: AssignedWarehouse[];
    extra?: readonly PermissionCode[];
  } = {},
) {
  const wrap =
    (table: RouteTable | undefined, method: string) =>
    async (url: string, bodyOrConfig?: unknown, config?: { params?: unknown }) => {
      if (method === "GET" && url === "/identity/me/permissions") {
        return {
          data: {
            roles: [role],
            permissions: [...ROLE_PERMISSIONS[role], ...(me.extra ?? [])],
            dataScope: me.dataScope ?? "ALL",
            ...(me.warehouses ? { warehouses: me.warehouses } : {}),
          },
        };
      }
      const handler = table?.[url];
      if (!handler) throw new Error(`Không có mock cho ${method} ${url}`);
      const params =
        method === "GET"
          ? (bodyOrConfig as { params?: unknown } | undefined)?.params
          : config?.params;
      const body = method === "GET" ? undefined : bodyOrConfig;
      return { data: await handler(params, body) };
    };
  const get = vi.spyOn(api, "get").mockImplementation(wrap(routes.get, "GET"));
  const post = vi.spyOn(api, "post").mockImplementation(wrap(routes.post, "POST"));
  const put = vi.spyOn(api, "put").mockImplementation(wrap(routes.put, "PUT"));
  return { get, post, put };
}

export function renderScreen(ui: React.ReactElement, role: TestRole, searchParams = "") {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@example.com",
      roles: [role],
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
  const view = render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        {/* Nút "Tạo mới" trên topbar (`HeaderCreateButton`) có tooltip — app bọc TooltipProvider ở layout */}
        <TooltipProvider>
          <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
        </TooltipProvider>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  /** `client` để test giả lập một lần tải lại nền (vd focus cửa sổ) khi đang mở hộp thoại. */
  return Object.assign(view, { client });
}

/** PageResponse BE (trang từ 0). */
export function bePage<T>(items: T[], page = 0, size = 15) {
  return {
    items,
    page,
    size,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: page > 0,
  };
}
