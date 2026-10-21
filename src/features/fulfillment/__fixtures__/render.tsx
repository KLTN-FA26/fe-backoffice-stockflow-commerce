/**
 * Render màn xuất kho trong test với API giả lập theo URL — đi qua đúng chuỗi thật:
 * `/identity/me/permissions` (mã quyền) → useFulfillmentActor → UI.
 * Bộ quyền chép seed BE V20260903000100 + V20260919001300 + V20261022000200 (BE PR #148).
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { vi } from "vitest";

import {
  FULFILLMENT_DESIGN_REVERIFICATION_PERMISSIONS as REVERIFY,
  FULFILLMENT_PACKAGE_PERMISSIONS as PACK,
  FULFILLMENT_PACKING_PERMISSIONS as PACKING,
  FULFILLMENT_PICK_PERMISSIONS as PICK,
  FULFILLMENT_PICKING_PERMISSIONS as PICKING,
  FULFILLMENT_TASK_ASSIGNMENT_PERMISSIONS as ASSIGNMENT,
  FULFILLMENT_TASK_OVERSIGHT_PERMISSIONS as OVERSIGHT,
  ORDER_PERMISSIONS,
} from "@/constants";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/auth-store";

import { PICKER_ID } from "./task";

import type { PermissionCode } from "@/lib/auth";

/** Người đăng nhập trong test = một bộ mã quyền (FE không đọc tên vai trò để quyết định quyền). */
export interface TestIdentity {
  permissions: readonly PermissionCode[];
}

/** Đọc task + hàng chờ / phiên đóng gói (seed: nhân viên kho, quản lý kho). */
const FLOOR_READ: PermissionCode[] = [...Object.values(PICK), ...Object.values(PACK)];
/** Ghi: lấy hàng + đóng gói (BE PR #148: fulfillment-picking, fulfillment-packing). */
const FLOOR: PermissionCode[] = [
  ...FLOOR_READ,
  ...Object.values(PICKING),
  PACKING.read,
  PACKING.update,
];
/** Quản lý kho: thêm tiếp quản phiên, gán / giám sát task, kiểm tra lại thiết kế. */
const MANAGER: PermissionCode[] = [
  ...FLOOR,
  PACKING.approve,
  ...Object.values(ASSIGNMENT),
  OVERSIGHT.read,
  ...Object.values(REVERIFY),
];

/** Bộ quyền theo seed BE. Vai trò kho KHÔNG có sales-orders:READ. */
export const IDENTITIES = {
  warehouseStaff: { permissions: FLOOR },
  warehouseManager: { permissions: MANAGER },
  // Điều phối: gán / giám sát task, đọc task; không có quyền đóng gói
  orderCoordinator: {
    permissions: [
      ...Object.values(PICK),
      ...Object.values(ASSIGNMENT),
      OVERSIGHT.read,
      ORDER_PERMISSIONS.viewPage,
      ORDER_PERMISSIONS.read,
    ],
  },
  // Không có VIEW_PAGE ở cả hai resource; chỉ kiểm tra lại thiết kế
  qcStaff: { permissions: [PICK.read, PACK.read, ...Object.values(REVERIFY)] },
  // Quản lý kho được admin cấp thêm quyền đọc đơn (để xem số đơn và dòng đơn)
  managerWithReferences: {
    permissions: [...MANAGER, ORDER_PERMISSIONS.read],
  },
  staffWithOrders: {
    permissions: [...FLOOR, ORDER_PERMISSIONS.read],
  },
} satisfies Record<string, TestIdentity>;

export type RouteHandler = (params: unknown, body?: unknown, config?: unknown) => unknown;

/** Giả lập `api.get/post/put` theo URL. Trả spy để kiểm params / body đã gửi. */
export function mockFulfillmentApi(
  identity: TestIdentity,
  getRoutes: Record<string, RouteHandler>,
  postRoutes: Record<string, RouteHandler> = {},
  putRoutes: Record<string, RouteHandler> = {},
  deleteRoutes: Record<string, RouteHandler> = {},
) {
  const get = vi
    .spyOn(api, "get")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      if (url === "/identity/me/permissions") {
        return {
          data: {
            roles: ["TEST"],
            permissions: [...identity.permissions],
            dataScope: "ALL",
          },
        };
      }
      const handler = getRoutes[url];
      if (!handler) throw new Error(`Không có mock cho GET ${url}`);
      return { data: handler(config?.params) };
    });
  const post = vi
    .spyOn(api, "post")
    .mockImplementation(async (url: string, body?: unknown, config?: unknown) => {
      const handler = postRoutes[url];
      if (!handler) throw new Error(`Không có mock cho POST ${url}`);
      return { data: handler(undefined, body, config) };
    });
  const del = vi
    .spyOn(api, "delete")
    .mockImplementation(async (url: string, config?: { params?: unknown }) => {
      const handler = deleteRoutes[url];
      if (!handler) throw new Error(`Không có mock cho DELETE ${url}`);
      return { data: handler(config?.params) };
    });
  const put = vi.spyOn(api, "put").mockImplementation(async (url: string, body?: unknown) => {
    const handler = putRoutes[url];
    if (!handler) throw new Error(`Không có mock cho PUT ${url}`);
    return { data: handler(undefined, body) };
  });
  return { get, post, put, del };
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
