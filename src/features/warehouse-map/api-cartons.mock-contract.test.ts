/**
 * Contract: danh sách thùng theo vị trí (tem LPN trên cảnh 3D) — gọi handler mock thật của
 * `GET /inventory/stock-packages?location=` rồi parse bằng `locationCartonsDto` của bản đồ.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api/client";
import { activateMockAdapter } from "@/lib/api/mock-adapter";
import { resetReceiptMockStore } from "@/lib/api/mock-routes-goods-receipts-store";
import { resetInventoryMockState } from "@/lib/api/mock-routes-inventory";
import { useAuthStore } from "@/lib/auth/auth-store";

import { seedMockCartons } from "@/test/mock-cartons";

import { listLocationCartons } from "./api-cartons";

// Mỗi request mock trễ ~215ms (Math.random = 0.05).
vi.setConfig({ testTimeout: 30_000 });

const originalAdapter = api.defaults.adapter;
// Bin không có thùng tồn đầu kỳ của seed — thùng của test là duy nhất ở đó
const BIN = "HCM-A01-1-B";

beforeAll(() => {
  vi.spyOn(Math, "random").mockReturnValue(0.05);
  activateMockAdapter();
});
beforeEach(async () => {
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
  await seedMockCartons([
    { lpn: "LPN-20261120-000002", location: BIN },
    { lpn: "LPN-20261120-000001", location: BIN },
    { lpn: "LPN-20261120-000003", location: BIN, status: "CONSUMED" },
    { lpn: "LPN-20261120-000004", location: "HCM-A01-1-C" },
  ]);
});
afterEach(() => {
  resetInventoryMockState();
  resetReceiptMockStore();
});
afterAll(() => {
  api.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
});

describe("thùng LPN của một bin (tem LPN 3D)", () => {
  it("đúng một mã vị trí, chỉ thùng còn sống, sắp theo LPN — parse được bằng schema bản đồ", async () => {
    const cartons = await listLocationCartons(BIN);
    expect(cartons.map((carton) => carton.lpn)).toEqual([
      "LPN-20261120-000001",
      "LPN-20261120-000002",
    ]);
    expect(cartons.every((carton) => carton.locationCode === BIN)).toBe(true);
  });
});

describe("thùng tồn đầu kỳ của seed BE (V20261111000110)", () => {
  const lpns = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => `LPN-20261111-${String(from + i).padStart(6, "0")}`);

  it("mỗi vị trí có tồn của bản đồ có đúng các thùng LPN như seed", async () => {
    expect((await listLocationCartons("HCM-A01-2-B")).map((carton) => carton.lpn)).toEqual(
      lpns(1, 25),
    );
    expect((await listLocationCartons("HCM-A02-1-A")).map((carton) => carton.lpn)).toEqual(
      lpns(26, 8),
    );
    const bags = await listLocationCartons("HCM-B01-1-A");
    expect(bags.map((carton) => carton.lpn)).toEqual(lpns(34, 12));
    expect(bags.every((carton) => carton.sku === "BAG-CUP-2")).toBe(true);
    expect(await listLocationCartons("HCM-QC01")).toHaveLength(30);
  });
});
