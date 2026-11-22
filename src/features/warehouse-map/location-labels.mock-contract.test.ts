/**
 * Contract mock `POST /warehouses/{id}/location-labels` (BE `LocationLabelServiceImpl`, docs 06 §4.3, BR-17): chạy
 * handler mock thật trên seed demo kho HCM (3 kệ × 2 tầng × 2 bin, 4 khu chứa hàng + văn phòng NON_STORAGE).
 */

import { beforeEach, describe, expect, it } from "vitest";

import { WAREHOUSE_LOCATION_PERMISSIONS as LP } from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { MOCK_WAREHOUSE_ID } from "@/lib/api/mock-routes-goods-receipts-store";
import { registerWarehouseMockRoutes } from "@/lib/api/mock-routes-warehouses";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { getWarehouseStore, resetWarehouseMockStore } from "@/lib/api/mock-warehouse-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerWarehouseMockRoutes();

const URL_LABELS = `/warehouses/${MOCK_WAREHOUSE_ID}/location-labels`;

async function print(body: Record<string, unknown>) {
  const route = resolveMockRoute("POST", URL_LABELS);
  if (!route) throw new Error("Không có route mock in nhãn");
  const config = { url: URL_LABELS, data: JSON.stringify(body), _mockParams: route.params };
  return route.handler(config as AxiosRequestConfig);
}

/** Dòng chữ của PDF mock (mỗi nhãn một dòng mã vị trí, sau dòng tiêu đề). */
async function codesOf(res: { data: unknown }): Promise<string[]> {
  if (!(res.data instanceof Blob)) throw new Error("không phải PDF");
  const text = await res.data.text();
  return [...text.matchAll(/\((HCM-[A-Z0-9-]+)\) Tj/g)].map((match) => match[1] ?? "");
}
const code = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;

function actAs(grants: readonly PermissionCode[]) {
  MOCK_USER_GRANTS["u-label-test"] = grants;
  useAuthStore.setState({
    user: {
      userId: "u-label-test",
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

beforeEach(() => {
  resetWarehouseMockStore();
  // In là đọc bản đồ — nhân viên kho chỉ có quyền đọc vẫn in được
  actAs([LP.viewPage, LP.read]);
});

describe("in nhãn vị trí — mock theo BE", () => {
  it("cả kho: PDF theo thứ tự đi (kệ → tầng → bin, rồi khu chứa hàng), khu NON_STORAGE không có nhãn", async () => {
    const res = await print({ format: "A4_SHEET" });
    expect(res.status).toBe(200);
    expect(res.headers?.["content-type"]).toBe("application/pdf");
    const codes = await codesOf(res);
    expect(codes.slice(0, 5)).toEqual([
      "HCM-A01-1-A",
      "HCM-A01-1-B",
      "HCM-A01-2-A",
      "HCM-A01-2-B",
      "HCM-A02-1-A",
    ]);
    expect(codes.slice(-8)).toEqual([
      "HCM-DSP01",
      "HCM-OVF01",
      "HCM-PACK01",
      "HCM-PRD01",
      "HCM-QC01",
      "HCM-RCV01",
      "HCM-RTV01",
      "HCM-STG01",
    ]);
    // Khu ngừng dùng không in khi in rộng (BR-17)
    expect(codes).not.toContain("HCM-QCA01");
    expect(codes).not.toContain("HCM-OFFICE");
  });

  it("BR-17: bỏ qua bin / kệ ngừng dùng khi in rộng, nhưng nêu đích danh mã ngừng dùng → 409 LOCATION_INACTIVE", async () => {
    const shelf = getWarehouseStore().shelves.find((s) => s.code === "A02");
    if (!shelf) throw new Error("seed thiếu kệ A02");
    shelf.status = "INACTIVE";
    const codes = await codesOf(await print({ format: "THERMAL_ROLL" }));
    expect(codes.some((c) => c.startsWith("HCM-A02"))).toBe(false);
    expect(code(await print({ format: "A4_SHEET", locationCodes: ["hcm-a02-1-a"] }))).toBe(
      "LOCATION_INACTIVE",
    );
  });

  it("một kệ + tầng; một zone (không gồm khu vực); mã không có → 404", async () => {
    const shelfId = "mock-shelf-HCM-B01";
    expect(await codesOf(await print({ format: "A4_SHEET", shelfId, levelIndexes: [2] }))).toEqual([
      "HCM-B01-2-A",
      "HCM-B01-2-B",
    ]);
    expect(code(await print({ format: "A4_SHEET", shelfId, levelIndexes: [9] }))).toBe(
      "SHELF_LEVEL_NOT_FOUND",
    );
    const zone = await codesOf(await print({ format: "A4_SHEET", zoneId: "mock-zone-HCM-B" }));
    expect(zone).toEqual(["HCM-B01-1-A", "HCM-B01-1-B", "HCM-B01-2-A", "HCM-B01-2-B"]);
    expect(code(await print({ format: "A4_SHEET", locationCodes: ["HCM-NOPE"] }))).toBe(
      "LOCATION_NOT_FOUND",
    );
  });

  it("gửi hai selector cùng lúc hoặc thiếu khổ nhãn → 400", async () => {
    expect((await print({ format: "A4_SHEET", shelfId: "x", zoneId: "y" })).status).toBe(400);
    expect((await print({})).status).toBe(400);
  });
});
