/**
 * Render màn đơn hàng trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` → usePermissionChecker → UI. Quyền giả lập theo MÃ QUYỀN BE.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, vi } from "vitest";

import {
  CREDIT_HOLD_PERMISSIONS,
  CUSTOMER_CREDIT_PROFILE_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
  ORDER_DELIVERY_BATCH_PERMISSIONS,
  ORDER_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

/**
 * Theo seed BE develop (5683fe14):
 * - `sales-order-holds:UPDATE` (giữ / gỡ giữ, docs 17 §4.9) cho SALES_STAFF + SYSTEM_ADMIN (`sales-orders:APPROVE` BE đã
 *   xoá khỏi mọi vai trò); release là `sales-order-releases:UPDATE` (quản lý kho);
 * - `sales-order-cancellations:UPDATE` (huỷ, đóng phần còn lại) cho SALES_STAFF + ORDER_COORDINATOR;
 * - `sales-order-partial-shipments:UPDATE` (cho phép giao một phần, BE PR #150) cho SALES_STAFF, không có APPROVE;
 * - `sales-order-credit-holds:APPROVE` chỉ ACCOUNTANT (Sales/Coordinator chỉ VIEW_PAGE / READ);
 * - `customer-credit-profiles:READ` cho ACCOUNTANT / SALES_STAFF / ORDER_COORDINATOR (V20261013000400).
 */
export const ORDER_PERMISSION_SETS = {
  // WAREHOUSE_STAFF: không có quyền đơn bán nào
  none: [],
  viewOnly: [ORDER_PERMISSIONS.viewPage],
  // Chỉ đọc đơn (VIEW_PAGE + READ) — không huỷ / release / giữ / duyệt công nợ
  readOnly: [ORDER_PERMISSIONS.viewPage, ORDER_PERMISSIONS.read],
  salesStaff: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.cancel,
    ORDER_PERMISSIONS.hold,
    ORDER_PERMISSIONS.partialShipment,
    // PR-0 V20261216000050 (WF-05 Q-12): đóng phần thất lạc cấp cho SALES_STAFF
    ORDER_PERMISSIONS.lostShipmentClosure,
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
    // BE V20261010000500: SALES_STAFF + ORDER_COORDINATOR có production-orders READ (ACCOUNTANT không)
    PRODUCTION_ORDER_PERMISSIONS.read,
  ],
  coordinator: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    // Fixture ĐA QUYỀN cho màn đơn (không phải một vai seed BE): giữ / gỡ giữ (`sales-order-holds:UPDATE`), ghi giao thất
    // bại cấp đơn (`fulfillment-delivery-outcomes:APPROVE`) và release (`sales-order-releases:UPDATE`)
    ORDER_PERMISSIONS.hold,
    FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS.approve,
    ORDER_PERMISSIONS.release,
    ORDER_PERMISSIONS.cancel,
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
    PRODUCTION_ORDER_PERMISSIONS.read,
  ],
  accountant: [
    CREDIT_HOLD_PERMISSIONS.viewPage,
    CREDIT_HOLD_PERMISSIONS.read,
    CREDIT_HOLD_PERMISSIONS.approve,
    CUSTOMER_CREDIT_PROFILE_PERMISSIONS.read,
    // BE V20261227000400 (AUTH-6): Kế toán mở trang khách để cấp hạn mức — xem, không sửa
    CUSTOMER_PERMISSIONS.viewPage,
    CUSTOMER_PERMISSIONS.read,
  ],
  // Quản lý kho của kho xuất (BE V20261115000200 + V20261124000650, PR #317): đọc đơn + release (`sales-order-releases:UPDATE`)
  // + đọc lịch giao (`sales-order-delivery-batches:READ`, cấp cho mọi vai release) — có ô chọn đợt giao. Không có
  // `sales-contracts:READ`: hợp đồng không mở cho quản lý kho.
  warehouseManager: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.release,
    ORDER_DELIVERY_BATCH_PERMISSIONS.read,
  ],
  // Người chỉ release, KHÔNG có quyền đọc lịch giao (vai tạo lúc chạy, hoặc quyền bị thu hồi) → không gọi lịch giao,
  // ô chọn đợt giao ẩn, BE tự chọn đợt kế tiếp.
  releaserWithoutSchedule: [
    ORDER_PERMISSIONS.viewPage,
    ORDER_PERMISSIONS.read,
    ORDER_PERMISSIONS.release,
  ],
} satisfies Record<string, PermissionCode[]>;

/** Handler theo path: trả data, hoặc throw (vd ApiError) để giả lập lỗi. */
export type RouteHandler = (params: URLSearchParams | undefined) => unknown;

export function mockOrderApiGet(
  permissions: readonly PermissionCode[],
  routes: Record<string, RouteHandler>,
) {
  return vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return { data: { roles: ["TEST"], permissions: [...permissions], dataScope: "ALL" } };
      }
      const handler = routes[url];
      // Lịch sử đơn: mặc định rỗng — test về lịch sử khai báo handler riêng
      if (!handler && url.endsWith("/history")) return { data: [] };
      // Giữ hoàn tất (WF-05 GH-2): mặc định đơn không bị giữ (BE trả data null)
      if (!handler && url.endsWith("/completion-hold")) return { data: null };
      // Thiếu thùng (docs 17 §4.14): mặc định đơn không treo vì thiếu thùng → khối ẩn; test về thẻ khai báo handler riêng
      if (!handler && url.endsWith("/shortage"))
        return {
          data: {
            orderId: "o",
            orderNumber: "SO",
            sendable: false,
            notSendable: "NOT_ON_HOLD",
            lines: [],
            options: [],
            history: [],
          },
        };
      // Hợp đồng chờ duyệt tín dụng (15 BR-11): mặc định hàng chờ rỗng — test về hàng chờ khai báo handler riêng
      if (!handler && url === "/orders/contract-credit-reviews")
        return {
          data: {
            items: [],
            page: 0,
            size: 15,
            totalElements: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        };
      if (!handler) throw new Error(`Không có mock cho GET ${url}`);
      const params = config?.params instanceof URLSearchParams ? config.params : undefined;
      return { data: handler(params) };
    });
}

/**
 * Tab của trang chi tiết đơn (`OrderDetailTabs`, URL `?tab=`) mà mọi lần render trong file test mở sẵn — file chỉ kiểm một
 * nhóm (huỷ, kho xuất, lịch giao…) gọi `openOrderDetailTabInFile("delivery")` ở đầu file thay vì bấm tab trong từng test.
 */
let defaultSearch = "";
export function openOrderDetailTabInFile(
  tab: "contract" | "delivery" | "payment" | "returns" | "history",
) {
  beforeEach(() => {
    defaultSearch = `?tab=${tab}`;
  });
  afterEach(() => {
    defaultSearch = "";
  });
}

/** Bấm một tab của trang chi tiết đơn (cho test kiểm nhiều nhóm trong một file). */
export function clickOrderDetailTab(name: string) {
  fireEvent.click(screen.getByRole("tab", { name }));
}

export function renderOrderScreen(ui: React.ReactElement, searchParams = defaultSearch) {
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "Test",
      email: "t@t.vn",
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
  const client = new QueryClient({
    // retryDelay 0: hook order tự retry lỗi 5xx — test không phải chờ backoff thật
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchParams} hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

/**
 * Chọn một option của Radix Select trong jsdom (thiếu pointer-capture / scrollIntoView).
 * Bản riêng của order — không import fixture của feature khác (feature-architecture).
 */
export async function pickOrderSelectOption(
  user: { click: (el: Element) => Promise<void> },
  trigger: string | RegExp,
  option: string | RegExp,
) {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
  await user.click(await screen.findByRole("combobox", { name: trigger }));
  await user.click(await screen.findByRole("option", { name: option }));
}

/** Cùng helper, tên develop dùng trong test vòng đời. */
export const pickSelectOption = pickOrderSelectOption;

/** Tên truy cập của nút "⋯" trên header đối tượng của đơn (`OrderActionCard` → `ObjectActions`). */
export const ORDER_MORE_ACTIONS = "Thao tác khác với đơn hàng";

/**
 * Nút thao tác của đơn trên header: nút chính nằm ngoài, các việc khác trong menu "⋯" (backoffice-erp-ui B10). Trả về nút
 * ngoài nếu có, không thì mở menu và trả về mục trong menu. Ném lỗi khi không có.
 */
export async function orderAction(name: string): Promise<HTMLElement> {
  const found = await orderActionOrNull(name);
  if (!found) throw new Error(`Không có thao tác "${name}" trên header đơn`);
  return found;
}

/** Như `orderAction` nhưng trả `null` khi không có (để kiểm nút bị ẩn theo quyền / trạng thái). */
export async function orderActionOrNull(name: string): Promise<HTMLElement | null> {
  const region = await screen.findByRole("region", { name: "Thao tác đơn" }).catch(() => null);
  const scope = region ?? document.body;
  const direct = within(scope).queryByRole("button", { name });
  if (direct) return direct;
  const more = within(scope).queryByRole("button", { name: ORDER_MORE_ACTIONS });
  if (!more) return null;
  if (more.getAttribute("aria-expanded") !== "true") fireEvent.click(more);
  return screen.queryByRole("button", { name });
}
