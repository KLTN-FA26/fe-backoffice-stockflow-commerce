/**
 * Contract mock của chế độ sửa bản đồ: PUT kệ / khu vực chạy qua handler mock thật rồi parse bằng schema
 * FE (`savedRefDto`, `stockProbeDto`) — cùng mã lỗi BE (OPTIMISTIC_LOCK, LAYOUT_*, AREA_TYPE_*).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { WAREHOUSE_LOCATION_PERMISSIONS as LP, WAREHOUSE_PERMISSIONS as WP } from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerWarehouseLayoutMockRoutes } from "@/lib/api/mock-routes-warehouse-layout";
import { registerWarehouseMockRoutes } from "@/lib/api/mock-routes-warehouses";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { resetWarehouseMockStore } from "@/lib/api/mock-warehouse-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import { savedRefDto, stockProbeDto, warehouseLayoutDto, warehousePageDto } from "./schemas";

import type { AxiosRequestConfig } from "axios";

registerWarehouseLayoutMockRoutes();
registerWarehouseMockRoutes();

async function call(method: string, url: string, data?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const body = data === undefined ? undefined : JSON.stringify(data);
  return route.handler({ url, data: body, _mockParams: route.params } as AxiosRequestConfig);
}

const code = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;

async function hcmLayout() {
  const hcm = warehousePageDto.parse((await call("GET", "/warehouses")).data).items[0];
  return warehouseLayoutDto.parse((await call("GET", `/warehouses/${hcm?.id ?? ""}/layout`)).data);
}

beforeEach(() => {
  resetWarehouseMockStore();
  MOCK_USER_GRANTS["u-wh-edit"] = [...Object.values(WP), ...Object.values(LP)];
  useAuthStore.setState({
    user: {
      userId: "u-wh-edit",
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
});

describe("PUT kệ / khu vực của chế độ sửa", () => {
  it("dời kệ: trả version mới; gửi lại version cũ → OPTIMISTIC_LOCK", async () => {
    const shelf = (await hcmLayout()).shelves[0];
    if (!shelf) throw new Error("thiếu kệ seed");
    const body = { ...shelf, footprint: { ...shelf.footprint, x: 20 }, version: shelf.version };
    const saved = savedRefDto.parse((await call("PUT", `/shelves/${shelf.id}`, body)).data);
    expect(saved.version).toBe(shelf.version + 1);
    expect(code(await call("PUT", `/shelves/${shelf.id}`, body))).toBe("OPTIMISTIC_LOCK");
  });

  it("BR-07: thu nhỏ kệ quá bin, hoặc dời đè kệ khác, bị từ chối", async () => {
    const [a01, a02] = (await hcmLayout()).shelves;
    if (!a01 || !a02) throw new Error("thiếu kệ seed");
    const put = (footprint: object) =>
      call("PUT", `/shelves/${a01.id}`, { ...a01, footprint, version: a01.version });
    expect(code(await put({ ...a01.footprint, width: 8 }))).toBe("LAYOUT_OUT_OF_BOUNDS");
    expect(code(await put(a02.footprint))).toBe("LAYOUT_OVERLAP");
  });

  it("BR-11: khu chứa hàng đổi thành NON_STORAGE bị từ chối", async () => {
    const area = (await hcmLayout()).areas.find((a) => a.code === "RCV01");
    if (!area) throw new Error("thiếu khu seed");
    const res = await call("PUT", `/areas/${area.id}`, {
      ...area,
      type: "NON_STORAGE",
      version: area.version,
    });
    expect(code(res)).toBe("AREA_TYPE_CHANGE_NOT_ALLOWED");
  });
});

describe("xoá tường / cửa (BoundaryController DELETE)", () => {
  it("bắt buộc ?version= — thiếu → 400, bản cũ → 409 OPTIMISTIC_LOCK, đúng version → xoá hẳn", async () => {
    const wall = (await hcmLayout()).boundaries.find((b) => b.type === "WALL");
    if (!wall) throw new Error("thiếu tường seed");
    const missing = await call("DELETE", `/boundaries/${wall.id}`);
    expect(missing.status).toBe(400);
    expect(code(missing)).toBe("VALIDATION_FAILED");
    expect(code(await call("DELETE", `/boundaries/${wall.id}?version=${wall.version + 1}`))).toBe(
      "OPTIMISTIC_LOCK",
    );
    expect((await call("DELETE", `/boundaries/${wall.id}?version=${wall.version}`)).status).toBe(
      204,
    );
    expect((await hcmLayout()).boundaries.some((b) => b.id === wall.id)).toBe(false);
  });
});

describe("tồn theo vị trí (seed BE §5)", () => {
  it("kệ A01 còn hàng, khu RCV01 không — lọc theo tiền tố mã vị trí", async () => {
    const id = (await hcmLayout()).warehouse.id;
    const probe = async (location: string) =>
      stockProbeDto.parse(
        (await call("GET", `/inventory/warehouses/${id}/stock-items?location=${location}&size=1`))
          .data,
      );
    expect((await probe("HCM-A01-")).totalElements).toBeGreaterThan(0);
    expect((await probe("HCM-RCV01")).totalElements).toBe(0);
  });
});
