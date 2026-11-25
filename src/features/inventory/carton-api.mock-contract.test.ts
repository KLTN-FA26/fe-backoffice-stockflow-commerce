/**
 * Contract: màn Thùng hàng (LPN) gọi handler mock thật của `GET /inventory/stock-packages` (bộ lọc + field mới của BE
 * develop #461 / issue #454) và `GET /inventory/movements?lpn=` (#460 / issue #455), parse bằng schema của màn.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { INVENTORY_API } from "@/constants/inventory";
import { STOCK_PACKAGE_API } from "@/constants/quarantine";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/error";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import {
  MOCK_WAREHOUSE_ID,
  resetReceiptMockStore,
} from "@/lib/api/mock-routes-goods-receipts-store";
import { resetInventoryMockState } from "@/lib/api/mock-routes-inventory";
import { useAuthStore } from "@/lib/auth/auth-store";

import { listMovements } from "./api";
import { getCartonLookup, listCartonLookup } from "./carton-api";

// Mỗi request mock trễ ~215ms (Math.random = 0.05).
vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;
// Thùng tồn đầu kỳ (seed BE V20261111000110): 1–25 HCM-A01-2-B, 26–33 HCM-A02-1-A, 34–45 HCM-B01-1-A, 46–75 HCM-QC01
const lpn = (n: number) => `LPN-20261111-${String(n).padStart(6, "0")}`;
const PAGE = { page: 0, size: 100 };

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(() => {
  useAuthStore.setState({
    user: {
      userId: "MOCK-MANAGER-A",
      username: "MOCK-MANAGER-A",
      fullName: "MOCK-MANAGER-A",
      email: "manager@example.test",
      roles: [],
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
    status: "authenticated",
    isAuthenticated: true,
    impersonatedRole: null,
  });
});
afterEach(() => {
  resetInventoryMockState();
  resetReceiptMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("GET /inventory/stock-packages — tra cứu thùng (BE #454)", () => {
  it("dòng đọc được: kho, sản phẩm ly / túi đựng ly, trạng thái tồn, nguồn", async () => {
    const page = await listCartonLookup({ ...PAGE, location: "HCM-A01-2-B" });
    expect(page.totalElements).toBe(25);
    expect(page.items[0]).toMatchObject({
      lpn: lpn(1),
      warehouseCode: "HCM",
      warehouseId: MOCK_WAREHOUSE_ID,
      productName: "Ly nhựa PP",
      variantName: "Ly nhựa PP 500 ml",
      stockStatuses: ["AVAILABLE"],
      source: "IN_WAREHOUSE",
      heldFor: [],
    });
  });

  it("lọc trạng thái tồn QUARANTINE → đúng 30 thùng ở khu cách ly", async () => {
    const page = await listCartonLookup({ ...PAGE, stockStatus: ["QUARANTINE"] });
    expect(page.totalElements).toBe(30);
    expect(page.items.every((row) => row.locationCode === "HCM-QC01")).toBe(true);
  });

  it("lọc kho + lô (đúng mã, viết thường vẫn khớp)", async () => {
    const page = await listCartonLookup({
      ...PAGE,
      warehouseId: MOCK_WAREHOUSE_ID,
      lotNumber: "lot-2026-03",
    });
    expect(page.totalElements).toBe(12);
    expect(page.items.every((row) => row.sku === "BAG-CUP-2")).toBe(true);
  });

  it("q là một phần LPN; dưới 3 ký tự thì FE không gửi, BE mock trả 400 nếu gửi", async () => {
    const page = await listCartonLookup({ ...PAGE, q: "000046" });
    expect(page.items.map((row) => row.lpn)).toEqual([lpn(46)]);
    // FE bỏ q ngắn: trả về toàn bộ thùng còn sống thay vì 400
    const unfiltered = await listCartonLookup({ ...PAGE, q: "00" });
    expect(unfiltered.totalElements).toBeGreaterThan(1);
    await expect(api.get(STOCK_PACKAGE_API.list, { params: { q: "00" } })).rejects.toBeInstanceOf(
      Error,
    );
  });

  it("kho không tồn tại → 404", async () => {
    await expect(
      listCartonLookup({ ...PAGE, warehouseId: "00000000-0000-4000-8000-000000000000" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("chi tiết thùng có cùng các field đọc được", async () => {
    const carton = await getCartonLookup(lpn(34));
    expect(carton).toMatchObject({
      lpn: lpn(34),
      warehouseCode: "HCM",
      productName: "Túi đựng ly",
      lotNumber: "LOT-2026-03",
    });
    expect(carton.contents?.length).toBe(1);
  });
});

describe("GET /inventory/movements?lpn= — lịch sử một thùng (BE #455)", () => {
  it("di chuyển nguyên thùng ghi fromLpn / toLpn; lọc theo LPN chỉ ra dòng của thùng đó", async () => {
    await api.post(INVENTORY_API.movements, {
      requestId: crypto.randomUUID(),
      lpns: [lpn(1)],
      toLocation: "HCM-A02-1-A",
    });
    const history = await listMovements({ page: 0, size: 20, lpn: lpn(1).toLowerCase() });
    expect(history.items).toHaveLength(1);
    expect(history.items[0]).toMatchObject({
      fromLpn: lpn(1),
      toLpn: lpn(1),
      fromLocation: "HCM-A01-2-B",
      toLocation: "HCM-A02-1-A",
    });
    expect((await listMovements({ page: 0, size: 20, lpn: lpn(2) })).items).toEqual([]);
  });
});
