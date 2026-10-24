/**
 * Helper chung cho test contract mock loại xe: gọi handler mock thật qua `resolveMockRoute`, đóng vai người dùng
 * có quyền, và dựng body POST / PUT.
 */

import { VEHICLE_TYPE_PERMISSIONS } from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerVehicleTypeMockRoutes } from "@/lib/api/mock-routes-vehicle-types";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import { beVehicleTypePageSchema } from "../schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";
import type { VehicleType } from "../types";

registerVehicleTypeMockRoutes();

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

export const VT = VEHICLE_TYPE_PERMISSIONS;
export const MANAGER: PermissionCode[] = [VT.viewPage, VT.read, VT.update];
export const STAFF: PermissionCode[] = [VT.viewPage, VT.read];

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
    },
    status: "authenticated",
  });
}

export const PATH = "/fulfillment/vehicle-types";
export const errorCode = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;
export const fieldsOf = (res: { data: unknown }) =>
  ((res.data as { fieldErrors?: { field: string }[] }).fieldErrors ?? []).map((f) => f.field);

export const body = (overrides: Record<string, unknown> = {}) => ({
  code: "truck-3t",
  name: "Xe tải 3 tấn",
  kind: "TRUCK",
  innerLengthMm: 4200,
  innerWidthMm: 1900,
  innerHeightMm: 1900,
  maxPayloadKg: 3000,
  availableCount: 2,
  ...overrides,
});

/** Body PUT đủ trường của một dòng (loại xe mặc định giữ kind, nên gửi đúng kind của nó). */
export function presetBody(row: VehicleType | undefined, overrides: Record<string, unknown> = {}) {
  return { ...row, rentalPrice: undefined, ...overrides };
}

export async function list(params?: unknown) {
  return beVehicleTypePageSchema.parse((await call("GET", PATH, undefined, params)).data);
}
