/**
 * Helper cho test contract mock kế hoạch xếp xe: gọi handler mock thật qua `resolveMockRoute`, đóng vai người dùng có
 * quyền, và đọc kết quả bằng schema FE — mock và hợp đồng FE không lệch nhau.
 */

import { LOAD_PLAN_PERMISSIONS, VEHICLE_TYPE_PERMISSIONS } from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerLoadPlanMockRoutes } from "@/lib/api/mock-routes-load-plans";
import { registerVehicleTypeMockRoutes } from "@/lib/api/mock-routes-vehicle-types";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerLoadPlanMockRoutes();
registerVehicleTypeMockRoutes();

export const LP = LOAD_PLAN_PERMISSIONS;
// Cả hai đều đọc được danh mục loại xe (seed BE: fulfillment-vehicle-types:READ cho nhân viên kho / điều phối)
const VT_READ: PermissionCode[] = [
  VEHICLE_TYPE_PERMISSIONS.viewPage,
  VEHICLE_TYPE_PERMISSIONS.read,
];
export const DISPATCHER: PermissionCode[] = [
  LP.viewPage,
  LP.read,
  LP.create,
  LP.update,
  ...VT_READ,
];
export const VIEWER: PermissionCode[] = [LP.viewPage, LP.read, ...VT_READ];

export const PATH = "/fulfillment/load-plans";

export async function call(method: string, url: string, data?: unknown, params?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const config = {
    url,
    data: data === undefined ? undefined : JSON.stringify(data),
    params,
    _mockParams: route.params,
  };
  return route.handler(config as AxiosRequestConfig);
}

export function actAs(grants: readonly PermissionCode[]) {
  MOCK_USER_GRANTS["u-test"] = grants;
  useAuthStore.setState({
    user: {
      userId: "u-test",
      fullName: "T",
      email: "t@t.vn",
      roles: [],
      username: "t",
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
  });
}

export const errorCode = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;
export const fieldsOf = (res: { data: unknown }) =>
  (res.data as { fieldErrors?: { field: string; message: string }[] }).fieldErrors ?? [];

/** Mã hạt của dữ liệu seed của mock (id cố định). */
export const SEED = {
  planned: "00000000-0000-4000-8000-0000000f2201",
  draft: "00000000-0000-4000-8000-0000000f2202",
  cancelled: "00000000-0000-4000-8000-0000000f2203",
  loading: "00000000-0000-4000-8000-0000000f2204",
  kitShipment: "00000000-0000-4000-8000-0000000f2001",
  bigShipment: "00000000-0000-4000-8000-0000000f2002",
  hcmShipment: "00000000-0000-4000-8000-0000000f2004",
};

export async function vehicleTypeId(code: string): Promise<string> {
  const res = await call("GET", "/fulfillment/vehicle-types", undefined, { size: 50 });
  const items = (res.data as { items: { vehicleTypeId: string; code: string }[] }).items;
  const found = items.find((item) => item.code === code);
  if (!found) throw new Error(`Không có loại xe ${code}`);
  return found.vehicleTypeId;
}

let serial = 0;
export const newRequestId = () =>
  `00000000-0000-4000-8000-0000000e${String(++serial).padStart(4, "0")}`;
