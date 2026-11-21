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
const BIN = "HCM-A01-2-B";

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
    { lpn: "LPN-20261111-000002", location: BIN },
    { lpn: "LPN-20261111-000001", location: BIN },
    { lpn: "LPN-20261111-000003", location: BIN, status: "CONSUMED" },
    { lpn: "LPN-20261111-000004", location: "HCM-A02-1-A" },
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
      "LPN-20261111-000001",
      "LPN-20261111-000002",
    ]);
    expect(cartons.every((carton) => carton.locationCode === BIN)).toBe(true);
  });
});
