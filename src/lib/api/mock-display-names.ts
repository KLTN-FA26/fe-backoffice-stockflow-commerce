/**
 * Tên / mã hiển thị cạnh id trong mock (issue #286: BE trả `xxxByName`, `actorName`, `warehouseCode` + `warehouseName`
 * cạnh id). Người: nhân viên của mock-data (qua `getMockStaffUsers` của adapter) và tài khoản đang đăng nhập. Kho: danh
 * mục kho mock (module 06). Không bịa tên — id không khớp ai → null, như BE với id lạ. Chỉ dùng khi USE_MOCK=true.
 */

import { getMockStaffUsers } from "./mock-adapter";
import { getWarehouseStore } from "./mock-warehouse-store";

import type { AxiosRequestConfig } from "axios";

export const MOCK_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Người dùng của phiên mock (cùng nguồn với `/identity/me/permissions`). Id mock-data không
 * phải UUID còn BE luôn trả UUID → đổi ổn định sang UUID; cùng người luôn ra cùng id.
 */
export function mockActorId(userId: string): string {
  if (MOCK_UUID_PATTERN.test(userId)) return userId.toLowerCase();
  const hex = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => {
      let hash = seed >>> 0;
      for (let index = 0; index < userId.length; index += 1) {
        hash = Math.imul(hash ^ userId.charCodeAt(index), 16777619) >>> 0;
      }
      return hash.toString(16).padStart(8, "0");
    })
    .join("");
  const variant = ((parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const names = new Map<string, string>();

function remember(userId: string, fullName: string | null) {
  if (!userId || !fullName) return;
  names.set(userId, fullName);
  names.set(mockActorId(userId), fullName);
}

/** Nạp tên (nhân viên mock-data + người đang đăng nhập) trước khi route dựng response. */
export async function loadMockStaffNames(): Promise<void> {
  for (const user of await getMockStaffUsers()) remember(user.userId, user.fullName);
  const { useAuthStore } = await import("@/lib/auth/auth-store");
  const me = useAuthStore.getState().user;
  if (me) remember(me.userId, me.fullName);
}

/** Tên của một id người dùng (id mock-data hoặc UUID đã đổi); không biết → null. */
export function mockStaffName(id: string | null | undefined): string | null {
  if (!id) return null;
  return names.get(id) ?? names.get(id.toLowerCase()) ?? null;
}

/** Bọc handler route: nạp tên trước để view đồng bộ đọc được `mockStaffName`. */
export function withMockStaffNames<R>(handler: (config: AxiosRequestConfig) => R) {
  return async (config: AxiosRequestConfig): Promise<Awaited<R>> => {
    await loadMockStaffNames();
    return await handler(config);
  };
}

/** `warehouseCode` (prefix) + `warehouseName` của một kho mock; kho lạ → null (NON_NULL bỏ trường). */
export function mockWarehouseNames(warehouseId: string | null | undefined): {
  warehouseCode: string | null;
  warehouseName: string | null;
} {
  const warehouse = warehouseId ? getWarehouseStore().warehouses.get(warehouseId) : undefined;
  return { warehouseCode: warehouse?.prefix ?? null, warehouseName: warehouse?.name ?? null };
}
