/**
 * Render trạm đóng gói chuyển kho trong test với API giả lập: phiên đóng gói nằm trong `state` — handler POST / DELETE
 * của test sửa `state.session` rồi trả về (đúng như BE trả phiên mới), lần tải lại kế tiếp thấy bản mới. URL mang
 * `?pack=<packId>` như khi người dùng đã mở phiên.
 */

import { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

import { LOAD_PLAN_PERMISSIONS } from "@/constants";
import { ApiError } from "@/lib/api/error";
import { useAuthStore } from "@/lib/auth/auth-store";

import { TransferPackStation } from "../components/TransferPackStation";
import { IDENTITIES, mockFulfillmentApi } from "./render";
import { EMPTY_ORDERS_PAGE } from "./packing-render";
import {
  PACKER_ID,
  PACKS_PATH,
  PACK_ID,
  PACK_PATH,
  TRANSFER_ORDER_ID,
  tSession,
} from "./transfer-pack";

import type { PermissionCode } from "@/lib/auth";
import type { RouteHandler, TestIdentity } from "./render";
import type { TransferPackSessionDto } from "../transfer-pack-types";

export interface TransferPackState {
  session: TransferPackSessionDto;
}

interface Options {
  identity?: TestIdentity;
  session?: TransferPackSessionDto;
  userId?: string;
  /** Mở thẳng trạm không kèm `?pack=`: trạm TRA phiên hiện hành của lệnh (`GET ?transferOrderId=`). */
  withoutPack?: boolean;
  /** Với `withoutPack`: lệnh đã có phiên (mặc định chưa từng đóng gói → 404 → cổng "Mở phiên đóng gói"). */
  existingPack?: boolean;
  /** Mở thẳng nhãn của kiện này (`?label=`). */
  labelId?: string;
  post?: (state: TransferPackState) => Record<string, RouteHandler>;
  del?: (state: TransferPackState) => Record<string, RouteHandler>;
  get?: (state: TransferPackState) => Record<string, RouteHandler>;
}

/** Nhân viên kho kèm quyền lập kế hoạch xe (để thấy nút "Lập kế hoạch xe" khi đã đóng xong). */
export const PLANNER_IDENTITY: TestIdentity = {
  permissions: [
    ...IDENTITIES.warehouseStaff.permissions,
    LOAD_PLAN_PERMISSIONS.viewPage,
    LOAD_PLAN_PERMISSIONS.read,
    LOAD_PLAN_PERMISSIONS.create,
  ] as PermissionCode[],
};

const WAREHOUSES = {
  items: [
    {
      id: "d99123fd-2997-4751-6bb9-e10a2e6d9949",
      prefix: "HN",
      name: "Kho Hà Nội",
      status: "ACTIVE",
    },
    {
      id: "a1b2c3d4-0000-4000-8000-0000000000b2",
      prefix: "HCM",
      name: "Kho HCM",
      status: "ACTIVE",
    },
  ],
  page: 0,
  size: 200,
  totalElements: 2,
  totalPages: 1,
  hasNext: false,
  hasPrevious: false,
};

const searchOf = (options: Options) => {
  const params = new URLSearchParams();
  if (!options.withoutPack) params.set("pack", PACK_ID);
  if (options.labelId) params.set("label", options.labelId);
  const text = params.toString();
  return text ? `?${text}` : "";
};

export function renderTransferPackStation(options: Options = {}) {
  const state: TransferPackState = { session: options.session ?? tSession() };
  const spies = mockFulfillmentApi(
    options.identity ?? IDENTITIES.warehouseStaff,
    {
      [PACK_PATH]: () => state.session,
      [PACKS_PATH]: () => {
        if (options.existingPack) return state.session;
        throw new ApiError(404, "NOT_FOUND", "never packed");
      },
      "/warehouses": () => WAREHOUSES,
      "/orders": () => EMPTY_ORDERS_PAGE,
      ...options.get?.(state),
    },
    options.post?.(state) ?? {},
    {},
    options.del?.(state) ?? {},
  );
  useAuthStore.setState({
    user: {
      userId: options.userId ?? PACKER_ID,
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
  render(
    <QueryClientProvider client={client}>
      <NuqsTestingAdapter searchParams={searchOf(options)} hasMemory>
        <Suspense fallback={<div>loading</div>}>
          <TransferPackStation transferId={TRANSFER_ORDER_ID} />
        </Suspense>
      </NuqsTestingAdapter>
    </QueryClientProvider>,
  );
  return { state, ...spies };
}
