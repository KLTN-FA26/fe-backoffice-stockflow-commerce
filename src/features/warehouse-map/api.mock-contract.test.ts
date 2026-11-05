/**
 * Contract mock module 06: chạy handler mock thật qua `resolveMockRoute` rồi parse bằng schema FE — màn
 * demo và hợp đồng BE không lệch nhau (mã lỗi, luật hình học, seed demo kho HCM).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { WAREHOUSE_LOCATION_PERMISSIONS as LP, WAREHOUSE_PERMISSIONS as WP } from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerWarehouseLayoutMockRoutes } from "@/lib/api/mock-routes-warehouse-layout";
import { registerWarehouseMockRoutes } from "@/lib/api/mock-routes-warehouses";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { resetWarehouseMockStore } from "@/lib/api/mock-warehouse-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import { warehouseDto, warehouseLayoutDto, warehousePageDto } from "./schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerWarehouseLayoutMockRoutes();
registerWarehouseMockRoutes();

async function call(method: string, url: string, data?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const config = {
    url,
    data: data === undefined ? undefined : JSON.stringify(data),
    _mockParams: route.params,
  };
  return route.handler(config as AxiosRequestConfig);
}

function actAs(grants: readonly PermissionCode[]) {
  MOCK_USER_GRANTS["u-wh-test"] = grants;
  useAuthStore.setState({
    user: {
      userId: "u-wh-test",
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

const MANAGER = [...Object.values(WP), ...Object.values(LP)];
const STAFF = [WP.viewPage, WP.read, LP.viewPage, LP.read];
const code = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;
const register = (overrides: Record<string, unknown> = {}) =>
  call("POST", "/warehouses", {
    prefix: "hn",
    name: "Kho Hà Nội",
    address: "Lô CN2, KCN Bắc Thăng Long",
    mapUnit: "M",
    mapWidth: 30,
    mapHeight: 20,
    ...overrides,
  });
const layoutOf = async (id: string) =>
  warehouseLayoutDto.parse((await call("GET", `/warehouses/${id}/layout`)).data);

beforeEach(() => {
  resetWarehouseMockStore();
  actAs(MANAGER);
});

describe("seed demo BE (V20260928009000 §4) — kho HCM", () => {
  it("danh mục có kho HCM; bản đồ 3 kệ × 2 tầng × 2 bin, 5 khu vực, tường + cửa", async () => {
    const page = warehousePageDto.parse((await call("GET", "/warehouses")).data);
    const hcm = page.items.find((w) => w.prefix === "HCM");
    expect(hcm).toMatchObject({ mapWidth: 60, mapHeight: 40, status: "ACTIVE" });
    const layout = await layoutOf(hcm?.id ?? "");
    expect(layout.shelves.map((s) => s.code)).toEqual(["A01", "A02", "B01"]);
    expect(layout.shelves[0]?.levels[1]?.bins.map((b) => b.locationCode)).toEqual([
      "HCM-A01-2-A",
      "HCM-A01-2-B",
    ]);
    expect(layout.areas).toHaveLength(5);
    // BR-11: khu NON_STORAGE không có mã vị trí, không có `usable`
    const office = layout.areas.find((a) => a.type === "NON_STORAGE");
    expect(office?.locationCode).toBeUndefined();
    expect(office?.usable).toBeUndefined();
    expect(layout.boundaries.map((b) => b.type)).toEqual(["WALL", "DOOR"]);
  });
});

describe("khai báo kho → vẽ bản đồ", () => {
  it("tạo kho: prefix viết hoa, bản đồ rỗng; prefix trùng → 409", async () => {
    const created = warehouseDto.parse((await register()).data);
    expect(created.prefix).toBe("HN");
    expect(await layoutOf(created.id)).toMatchObject({ shelves: [], areas: [], boundaries: [] });
    expect(code(await register({ prefix: "HN", name: "Kho khác" }))).toBe(
      "WAREHOUSE_PREFIX_ALREADY_EXISTS",
    );
  });

  it("NV kho không tạo được kho / kệ (403)", async () => {
    actAs(STAFF);
    expect((await register()).status).toBe(403);
  });

  it("đặt kệ → tầng → tự sinh bin: mã vị trí PREFIX-KỆ-TẦNG-BIN (BR-10, BR-14)", async () => {
    const id = warehouseDto.parse((await register()).data).id;
    const shelf = await call("POST", `/warehouses/${id}/shelves`, {
      code: "a01",
      name: "Kệ A01",
      footprint: { x: 2, y: 2, width: 10, length: 1.2, rotation: 0 },
      obstacle: true,
      pickFaces: { north: false, east: false, south: true, west: false },
      defaultStorageClass: "NORMAL",
    });
    const shelfId = (shelf.data as { id: string }).id;
    const level = await call("POST", `/shelves/${shelfId}/levels`, { levelIndex: 1 });
    const levelId = (level.data as { id: string }).id;
    const generated = await call("POST", `/shelves/${shelfId}/bin-generation`, {
      levelIds: [levelId],
      rowCount: 1,
      columnCount: 3,
      defaults: { type: "STANDARD", pickable: true, putawayTarget: true },
    });
    expect(generated.status).toBe(201);
    const layout = await layoutOf(id);
    const bins = layout.shelves[0]?.levels[0]?.bins ?? [];
    expect(bins.map((b) => b.locationCode)).toEqual(["HN-A01-1-01", "HN-A01-1-02", "HN-A01-1-03"]);
    expect(bins[0]?.footprint.width).toBe(3.333);
    // BR-14: tầng đã có bin không sinh lại được
    const again = await call("POST", `/shelves/${shelfId}/bin-generation`, {
      levelIds: [levelId],
      rowCount: 1,
      columnCount: 1,
      defaults: { type: "STANDARD", pickable: false, putawayTarget: false },
    });
    expect(code(again)).toBe("SHELF_LEVEL_HAS_BINS");
  });

  it("BR-06 / BR-07: ngoài khung và chồng lấn trả đúng mã lỗi BE", async () => {
    const id = warehouseDto.parse((await register()).data).id;
    const place = (x: number) =>
      call("POST", `/warehouses/${id}/areas`, {
        code: `A${x}`,
        type: "RECEIVING",
        name: "Khu",
        footprint: { x, y: 0, width: 5, length: 5, rotation: 0 },
        obstacle: false,
        location: { pickable: false, putawayTarget: false },
      });
    expect((await place(0)).status).toBe(201);
    expect(code(await place(2))).toBe("LAYOUT_OVERLAP");
    expect((await place(5)).status).toBe(201);
    expect(code(await place(26))).toBe("LAYOUT_OUT_OF_BOUNDS");
  });

  it("BR-16: kệ bảo trì → bin của kệ đọc là MAINTENANCE, không dùng được", async () => {
    const hcm = warehousePageDto.parse((await call("GET", "/warehouses")).data).items[0];
    const before = await layoutOf(hcm?.id ?? "");
    const shelfId = before.shelves[0]?.id ?? "";
    expect(
      (await call("PUT", `/shelves/${shelfId}/status`, { status: "MAINTENANCE" })).status,
    ).toBe(200);
    const bins = (await layoutOf(hcm?.id ?? "")).shelves[0]?.levels[0]?.bins ?? [];
    expect(
      bins.every((b) => b.status === "ACTIVE" && b.effectiveStatus === "MAINTENANCE" && !b.usable),
    ).toBe(true);
  });
});
