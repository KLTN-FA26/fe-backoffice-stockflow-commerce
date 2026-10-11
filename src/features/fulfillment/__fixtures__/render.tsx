/**
 * Render màn xuất kho trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` (mã quyền + mã vai trò) → useFulfillmentActor → UI.
 * Bộ quyền chép seed BE V20260903000100 + V20260919001300.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  FULFILLMENT_PACKAGE_PERMISSIONS as PACK,
  FULFILLMENT_PICK_PERMISSIONS as PICK,
  IDENTITY_USER_PERMISSIONS,
  ORDER_PERMISSIONS,
  STAFF_ROLE,
} from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { PICKER_ID } from "./task";

import type { PermissionCode } from "@/lib/auth";

export interface TestIdentity {
  roles: readonly string[];
  permissions: readonly PermissionCode[];
}

const FLOOR: PermissionCode[] = [...Object.values(PICK), ...Object.values(PACK)];

/** Vai trò theo seed BE. Vai trò kho KHÔNG có sales-orders:READ / identity-users:READ. */
export const IDENTITIES = {
  warehouseStaff: { roles: [STAFF_ROLE.WAREHOUSE_STAFF], permissions: FLOOR },
  warehouseManager: { roles: [STAFF_ROLE.WAREHOUSE_MANAGER], permissions: FLOOR },
  // packages: chỉ CREATE (không VIEW_PAGE / READ)
  orderCoordinator: {
    roles: [STAFF_ROLE.ORDER_COORDINATOR],
    permissions: [
      ...Object.values(PICK),
      PACK.create,
      ORDER_PERMISSIONS.viewPage,
      ORDER_PERMISSIONS.read,
    ],
  },
  // Không có VIEW_PAGE ở cả hai resource
  qcStaff: { roles: [STAFF_ROLE.QC_STAFF], permissions: [PICK.read, PACK.read, PACK.create] },
  // Quản lý kho được admin cấp thêm quyền đọc đơn + nhân viên (để gán và xem dòng đơn)
  managerWithReferences: {
    roles: [STAFF_ROLE.WAREHOUSE_MANAGER],
    permissions: [...FLOOR, ORDER_PERMISSIONS.read, IDENTITY_USER_PERMISSIONS.read],
  },
  staffWithOrders: {
    roles: [STAFF_ROLE.WAREHOUSE_STAFF],
    permissions: [...FLOOR, ORDER_PERMISSIONS.read],
  },
} satisfies Record<string, TestIdentity>;

export type RouteHandler = (params: unknown, body?: unknown) => unknown;

/** Giả lập `api.get/post/put` theo URL. Trả spy để kiểm params / body đã gửi. */
export function mockFulfillmentApi(
  identity: TestIdentity,
  getRoutes: Record<string, RouteHandler>,
  postRoutes: Record<string, RouteHandler> = {},
  putRoutes: Record<string, RouteHandler> = {},
) {
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return {
          data: {
            roles: [...identity.roles],
            permissions: [...identity.permissions],
            dataScope: "ALL",
          },
        };
      }
      const handler = getRoutes[url];
      if (!handler) throw new Error(`Không có mock cho GET ${url}`);
      return { data: handler(config?.params) };
    });
  const post = vi.spyOn(api, "post").mockImplementation(async (url: string, body?: unknown) => {
    const handler = postRoutes[url];
    if (!handler) throw new Error(`Không có mock cho POST ${url}`);
    return { data: handler(undefined, body) };
  });
  const put = vi.spyOn(api, "put").mockImplementation(async (url: string, body?: unknown) => {
    const handler = putRoutes[url];
    if (!handler) throw new Error(`Không có mock cho PUT ${url}`);
    return { data: handler(undefined, body) };
  });
  return { get, post, put };
}

/** `userId` mặc định là người được gán của fixture `apiTask()`. */
export function renderFulfillmentScreen(ui: React.ReactElement, userId: string = PICKER_ID) {
  useAuthStore.setState({
    user: {
      userId,
      username: "t@t.vn",
      fullName: "Test",
      email: "t@t.vn",
      status: "ACTIVE",
      roles: [],
      lastLoginAt: null,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter hasMemory>
        <Suspense fallback={<div>loading</div>}>{ui}</Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
}

/**
 * Chọn một mục của shadcn `Select` (Radix): bấm trigger theo nhãn rồi bấm option.
 * jsdom thiếu pointer capture / scrollIntoView mà Radix gọi khi mở danh sách → vá rỗng.
 */
export async function pickSelectOption(
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
