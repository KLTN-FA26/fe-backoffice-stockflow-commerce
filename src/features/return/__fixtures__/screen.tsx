/**
 * Render một màn trả hàng với API giả lập theo URL, đi qua chuỗi thật `/identity/me/permissions` → `useCan` → UI (mẫu
 * `features/payment/__fixtures__/screen.tsx`). Quyền theo seed BE (baseline V20261111000000), nhập thẳng theo mã.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  GOODS_RECEIPT_PERMISSIONS,
  SHIPMENT_PERMISSIONS,
  WAREHOUSE_LOCATION_PERMISSIONS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants/permissions";
import { RMA_PERMISSIONS, RMA_RESOLUTION_PERMISSIONS } from "@/constants/returns";
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

export const SALES_GRANTS: PermissionCode[] = [
  ...Object.values(RMA_PERMISSIONS),
  RMA_RESOLUTION_PERMISSIONS.propose,
];
export const ACCOUNTANT_GRANTS: PermissionCode[] = [
  RMA_PERMISSIONS.viewPage,
  RMA_PERMISSIONS.read,
  RMA_RESOLUTION_PERMISSIONS.approve,
];
export const WAREHOUSE_GRANTS: PermissionCode[] = [
  RMA_PERMISSIONS.viewPage,
  RMA_PERMISSIONS.read,
  ...Object.values(GOODS_RECEIPT_PERMISSIONS),
  WAREHOUSE_PERMISSIONS.read,
  WAREHOUSE_LOCATION_PERMISSIONS.read,
  SHIPMENT_PERMISSIONS.read,
];

type Handler = (params: unknown, body?: unknown) => unknown;
type Table = Record<string, Handler>;

export function mockReturnApi(
  grants: PermissionCode[],
  routes: { get?: Table; post?: Table; delete?: Table } = {},
) {
  const wrap = (table: Table | undefined, method: string) => async (url: string, arg?: unknown) => {
    if (method === "GET" && url === "/identity/me/permissions")
      return { data: { roles: [], permissions: grants, dataScope: "ALL" } };
    const handler = table?.[url];
    if (!handler) throw new Error(`Không có mock cho ${method} ${url}`);
    const params = method === "GET" ? (arg as { params?: unknown } | undefined)?.params : undefined;
    return { data: await handler(params, method === "POST" ? arg : undefined) };
  };
  return {
    get: vi.spyOn(api, "get").mockImplementation(wrap(routes.get, "GET")),
    post: vi.spyOn(api, "post").mockImplementation(wrap(routes.post, "POST")),
    delete: vi.spyOn(api, "delete").mockImplementation(wrap(routes.delete, "DELETE")),
  };
}

export function renderReturnScreen(ui: React.ReactElement, searchParams = "") {
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

/** `ReturnRequestResponse` như BE trả (trường chưa đặt vắng mặt). */
export const returnJson = (over: Record<string, unknown> = {}) => ({
  id: "ret-1",
  rmaNumber: "RMA-20261110-0001",
  orderId: "ord-1",
  orderNumber: "SO-20261101-000001",
  customerId: "cus-1",
  status: "REQUESTED",
  reasonCode: "PRINT_DEFECT",
  description: "Lem mực mặt trước",
  requestedResolution: "REFUND",
  channel: "PORTAL",
  requestedAt: "2026-11-10T03:00:00Z",
  currency: "VND",
  lines: [
    {
      id: "line-1",
      orderLineId: "ol-1",
      sku: "SKU-CUP-01",
      customPrinted: true,
      unitPrice: 100_000,
      requestedQuantity: 24,
      refundQuantity: 0,
    },
  ],
  evidence: [
    { id: "ev-1", stage: "CLAIM", originalName: "loi.jpg", uploadedAt: "2026-11-10T03:01:00Z" },
  ],
  discrepancies: [],
  history: [{ to: "REQUESTED", occurredAt: "2026-11-10T03:00:00Z" }],
  version: 2,
  ...over,
});

export const returnRowJson = (over: Record<string, unknown> = {}) => ({
  id: "ret-1",
  rmaNumber: "RMA-20261110-0001",
  orderId: "ord-1",
  orderNumber: "SO-20261101-000001",
  customerId: "cus-1",
  status: "REQUESTED",
  reasonCode: "PRINT_DEFECT",
  channel: "PORTAL",
  requestedAt: "2026-11-10T03:00:00Z",
  currency: "VND",
  vatAdjustmentRequired: false,
  version: 2,
  ...over,
});
