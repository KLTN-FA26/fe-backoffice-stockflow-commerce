/**
 * Render một màn hoá đơn điện tử với API giả lập theo URL, đi qua chuỗi thật
 * `/identity/me/permissions` → `useCan` → UI. Quyền theo mã (BE seed V20261120000300).
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import { EINVOICE_PERMISSIONS } from "@/constants/einvoice";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { PermissionCode } from "@/lib/auth";

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

/** Kế toán / Quản trị: đủ 6 action. */
export const ACCOUNTANT_GRANTS: PermissionCode[] = Object.values(EINVOICE_PERMISSIONS);
/** Sales Manager: chỉ xem. */
export const MANAGER_GRANTS: PermissionCode[] = [
  EINVOICE_PERMISSIONS.viewPage,
  EINVOICE_PERMISSIONS.read,
];
export const PAGE_ONLY_GRANTS: PermissionCode[] = [EINVOICE_PERMISSIONS.viewPage];

export function mockEInvoiceApi(
  grants: PermissionCode[],
  routes: { get?: RouteTable; post?: RouteTable; put?: RouteTable } = {},
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
    put: vi.spyOn(api, "put").mockImplementation(wrap(routes.put, "PUT")),
  };
}

export function renderEInvoiceScreen(ui: React.ReactElement, searchParams = "") {
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

export const bePage = (items: unknown[]) => ({
  items,
  page: 0,
  size: 15,
  totalElements: items.length,
  totalPages: items.length ? 1 : 0,
  hasNext: false,
  hasPrevious: false,
});

/** `EInvoiceListItemResponse` như BE trả (trường chưa đặt vắng mặt). */
export const listItemJson = (over: Record<string, unknown> = {}) => ({
  id: "einv-1",
  code: "HDDT-0001",
  type: "ORIGINAL",
  status: "DRAFT",
  adjusted: false,
  orderId: "ord-13",
  orderNumber: "SO-20261108-000013",
  shipmentId: "shp-1",
  shipmentCode: "SO-20261108-000013-S1",
  customerId: "cust-9",
  buyerName: "CÔNG TY TNHH CÀ PHÊ SÀI GÒN XƯA",
  buyerTaxCode: "0315987654",
  issueDate: "2026-11-10",
  issueDueAt: "2026-11-11T16:59:59Z",
  overdue: false,
  subtotal: 15_600_000,
  taxTotal: 1_248_000,
  grandTotal: 16_848_000,
  warnings: [],
  ...over,
});

/** `EInvoiceResponse` (chi tiết) như BE trả. */
export const detailJson = (over: Record<string, unknown> = {}) => ({
  ...listItemJson(),
  contractNumber: "HD-20261108-000013-1",
  seller: { name: "CÔNG TY TNHH STOCKFLOW", taxCode: "0312345678", address: "12 Nguyễn Huệ" },
  buyer: {
    name: "CÔNG TY TNHH CÀ PHÊ SÀI GÒN XƯA",
    taxCode: "0315987654",
    address: "45 Lê Lợi",
    email: "hoadon@saigonxua.vn",
  },
  currency: "VND",
  paymentMethod: "BANK_TRANSFER",
  lines: [
    {
      id: "line-1",
      lineNo: 1,
      kind: "GOODS",
      sku: "CUP-PAPER-8OZ-WHT",
      itemName: "Ly giấy 8oz in logo",
      unit: "cái",
      quantity: 20_000,
      unitsPerCarton: 1000,
      unitPrice: 780,
      taxRate: 0.08,
      amount: 15_600_000,
      taxAmount: 1_248_000,
    },
  ],
  totalsByRate: [{ taxRate: 0.08, amount: 15_600_000, taxAmount: 1_248_000 }],
  amountInWords: "Mười sáu triệu tám trăm bốn mươi tám nghìn đồng",
  hasFiles: false,
  version: 3,
  agreementRequired: false,
  ...over,
});
