/**
 * Contract mock danh mục loại xe (BE PR #153): chạy handler mock thật qua `resolveMockRoute` rồi parse bằng
 * schema FE — màn demo và hợp đồng FE không lệch nhau, mock giữ đúng mã lỗi / mã quyền / số liệu mặc định.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { VEHICLE_TYPE_PERMISSIONS } from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerVehicleTypeMockRoutes } from "@/lib/api/mock-routes-vehicle-types";
import { resetVehicleTypeMockStore } from "@/lib/api/mock-vehicle-type-store";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import { beVehicleTypePageSchema, beVehicleTypeSchema } from "./schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerVehicleTypeMockRoutes();

async function call(method: string, url: string, data?: unknown, params?: unknown) {
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

const VT = VEHICLE_TYPE_PERMISSIONS;
const MANAGER: PermissionCode[] = [VT.viewPage, VT.read, VT.update];
const STAFF: PermissionCode[] = [VT.viewPage, VT.read];

function actAs(grants: readonly PermissionCode[]) {
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

const PATH = "/fulfillment/vehicle-types";
const errorCode = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;
const fieldsOf = (res: { data: unknown }) =>
  ((res.data as { fieldErrors?: { field: string }[] }).fieldErrors ?? []).map((f) => f.field);

const body = (overrides: Record<string, unknown> = {}) => ({
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

async function list(params?: unknown) {
  return beVehicleTypePageSchema.parse((await call("GET", PATH, undefined, params)).data);
}

beforeEach(() => {
  resetVehicleTypeMockStore();
  actAs(MANAGER);
});

describe("mock danh mục loại xe — 10 loại mặc định theo migration BE PR #153", () => {
  it("có đủ 10 mã với số liệu của migration, đều là loại mặc định đang dùng", async () => {
    const page = await list({ size: 50 });
    expect(page.totalElements).toBe(10);
    const byCode = Object.fromEntries(page.items.map((row) => [row.code, row]));
    expect(Object.keys(byCode).sort()).toEqual(
      [
        "20DC",
        "40DC",
        "40HC",
        "45HC",
        "PICKUP",
        "TRUCK-15T",
        "TRUCK-1T25",
        "TRUCK-2T5",
        "TRUCK-5T",
        "TRUCK-8T",
      ].sort(),
    );
    expect(byCode["20DC"]).toMatchObject({
      kind: "CONTAINER",
      innerLengthMm: 5898,
      innerWidthMm: 2352,
      innerHeightMm: 2393,
      gussetMm: 100,
      maxPayloadKg: 28200,
    });
    expect(byCode["40HC"]).toMatchObject({ innerHeightMm: 2698, maxPayloadKg: 26500 });
    expect(byCode.PICKUP).toMatchObject({ kind: "PICKUP", gussetMm: 0, maxPayloadKg: 800 });
    expect(byCode["TRUCK-15T"]).toMatchObject({ innerLengthMm: 9300, maxPayloadKg: 15000 });
    for (const row of page.items) {
      expect(row).toMatchObject({ preset: true, status: "ACTIVE", availableCount: 10, version: 0 });
      expect(row.rentalPrice).toBeUndefined();
    }
  });

  it("lọc theo trạng thái và tìm trong mã hoặc tên; sắp theo tên", async () => {
    // "truck" khớp năm xe tải thùng + "Pickup truck" trong tên
    expect((await list({ search: "truck" })).totalElements).toBe(6);
    expect((await list({ search: "TRUCK-" })).totalElements).toBe(5);
    expect((await list({ search: "container 40" })).items.map((r) => r.code).sort()).toEqual([
      "40DC",
      "40HC",
    ]);
    expect((await list({ status: "INACTIVE" })).totalElements).toBe(0);
    const names = (await list({ size: 50 })).items.map((r) => r.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("phân trang đúng PageResponse (trang từ 0)", async () => {
    const page = await list({ page: 1, size: 4 });
    expect(page).toMatchObject({
      page: 1,
      size: 4,
      totalElements: 10,
      totalPages: 3,
      hasNext: true,
    });
    expect(page.items).toHaveLength(4);
  });
});

describe("mock danh mục loại xe — tạo, sửa, ngừng dùng", () => {
  it("tạo: 201, mã viết hoa, không phải mặc định, ACTIVE, khe góc 0", async () => {
    const res = await call("POST", PATH, body());
    expect(res.status).toBe(201);
    const row = beVehicleTypeSchema.parse(res.data);
    expect(row).toMatchObject({
      code: "TRUCK-3T",
      preset: false,
      status: "ACTIVE",
      gussetMm: 0,
      version: 0,
    });
    expect((await list()).totalElements).toBe(11);
  });

  it("mã trùng → 409 VEHICLE_TYPE_CODE_EXISTS (không phân biệt hoa thường)", async () => {
    const res = await call("POST", PATH, body({ code: "20dc" }));
    expect([res.status, errorCode(res)]).toEqual([409, "VEHICLE_TYPE_CODE_EXISTS"]);
  });

  it("dữ liệu sai → 400 VALIDATION_FAILED nêu đúng trường (kích thước, tải trọng, số xe, khe góc)", async () => {
    const res = await call(
      "POST",
      PATH,
      body({
        innerLengthMm: 0,
        maxPayloadKg: 0,
        availableCount: -1,
        gussetMm: 1001,
        kind: "BOAT",
        name: "",
      }),
    );
    expect([res.status, errorCode(res)]).toEqual([400, "VALIDATION_FAILED"]);
    expect(fieldsOf(res).sort()).toEqual(
      ["availableCount", "gussetMm", "innerLengthMm", "kind", "maxPayloadKg", "name"].sort(),
    );
    expect(errorCode(await call("POST", PATH, body({ code: "A" })))).toBe("VALIDATION_FAILED");
  });

  it("sửa: version tăng; khe góc / trạng thái vắng thì giữ; giá thuê vắng thì xoá", async () => {
    const created = beVehicleTypeSchema.parse(
      (await call("POST", PATH, body({ gussetMm: 40, rentalPrice: 900000 }))).data,
    );
    const res = await call("PUT", `${PATH}/${created.vehicleTypeId}`, {
      ...body({ name: "Xe tải 3,5 tấn" }),
      version: created.version,
    });
    const saved = beVehicleTypeSchema.parse(res.data);
    expect(saved).toMatchObject({
      name: "Xe tải 3,5 tấn",
      gussetMm: 40,
      status: "ACTIVE",
      version: 1,
    });
    expect(saved.rentalPrice).toBeUndefined();
  });

  it("ngừng dùng bằng status INACTIVE (không có DELETE); loại xe mặc định vẫn còn trong danh sách", async () => {
    const [preset] = (await list({ search: "20DC" })).items;
    expect(preset).toBeDefined();
    const res = await call("PUT", `${PATH}/${preset?.vehicleTypeId}`, {
      ...body({ code: "20DC", kind: "CONTAINER", status: "INACTIVE" }),
      version: 0,
    });
    expect(beVehicleTypeSchema.parse(res.data)).toMatchObject({ status: "INACTIVE", preset: true });
    expect((await list({ status: "INACTIVE" })).items.map((r) => r.code)).toEqual(["20DC"]);
    expect(resolveMockRoute("DELETE", `${PATH}/${preset?.vehicleTypeId}`)).toBeNull();
  });

  it("mã không đổi: PUT mã khác → 400 trên trường code; gửi lại đúng mã (kể cả khác hoa thường) thì được", async () => {
    const [preset] = (await list({ search: "40HC" })).items;
    const url = `${PATH}/${preset?.vehicleTypeId}`;
    const other = await call("PUT", url, { ...body({ code: "40HC-X" }), version: 0 });
    expect([other.status, errorCode(other), fieldsOf(other)]).toEqual([
      400,
      "VALIDATION_FAILED",
      ["code"],
    ]);
    expect((await call("PUT", url, { ...body({ code: "40hc" }), version: 0 })).status).toBe(200);
  });

  it("version cũ → 409 OPTIMISTIC_LOCK; không tồn tại → 404 VEHICLE_TYPE_NOT_FOUND", async () => {
    const [preset] = (await list({ search: "45HC" })).items;
    const url = `${PATH}/${preset?.vehicleTypeId}`;
    await call("PUT", url, { ...body({ code: "45HC" }), version: 0 });
    expect(errorCode(await call("PUT", url, { ...body({ code: "45HC" }), version: 0 }))).toBe(
      "OPTIMISTIC_LOCK",
    );
    const missing = await call("GET", `${PATH}/00000000-0000-4000-8000-000000000000`);
    expect([missing.status, errorCode(missing)]).toEqual([404, "VEHICLE_TYPE_NOT_FOUND"]);
    expect(errorCode(await call("PUT", `${PATH}/nope`, { ...body(), version: 0 }))).toBe(
      "VEHICLE_TYPE_NOT_FOUND",
    );
  });
});

describe("mock danh mục loại xe — cổng quyền theo mã (như @RequiresPermission)", () => {
  it("chỉ READ: đọc được, POST / PUT bị 403", async () => {
    actAs(STAFF);
    expect((await call("GET", PATH)).status).toBe(200);
    expect((await call("POST", PATH, body())).status).toBe(403);
    expect((await call("PUT", `${PATH}/x`, { ...body(), version: 0 })).status).toBe(403);
  });

  it("không có READ: cả đọc danh sách lẫn chi tiết đều 403", async () => {
    actAs([VT.viewPage]);
    expect((await call("GET", PATH)).status).toBe(403);
    expect((await call("GET", `${PATH}/x`)).status).toBe(403);
  });
});
