/**
 * Contract mock lệnh chuyển kho: chạy handler mock thật qua `resolveMockRoute` rồi parse bằng schema
 * FE — mock phải phản ánh đúng hành vi BE hiện tại (không phải contract đề xuất).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerTransferOrderMockRoutes } from "@/lib/api/mock-routes-transfer-orders";
import {
  getTransferStore,
  resetTransferMockStore,
} from "@/lib/api/mock-routes-transfer-orders-store";
import { useAuthStore } from "@/lib/auth/auth-store";

import { beTransferOrderSchema } from "./schemas";

import type { AxiosRequestConfig } from "axios";

registerTransferOrderMockRoutes();

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

function signInAs(userId: string) {
  useAuthStore.setState({
    user: {
      userId,
      username: userId,
      fullName: null,
      email: `${userId}@test.vn`,
      roles: [],
      status: "ACTIVE",
      lastLoginAt: null,
      mustChangePassword: false,
    },
  });
}

beforeEach(() => resetTransferMockStore());
afterEach(() => useAuthStore.setState({ user: null }));

/** Tạo lệnh nháp mới vượt ngưỡng duyệt (> 100 đơn vị) giữa hai kho của seed. */
async function createDraftOverThreshold() {
  const seed = [...(await getTransferStore()).values()][0];
  if (!seed) throw new Error("seed thiếu lệnh chuyển kho");
  const res = await call("POST", "/inventory/transfer-orders", {
    fromWarehouseId: seed.fromWarehouseId,
    toWarehouseId: seed.toWarehouseId,
    lines: [{ sku: "SOFA-3S-GREY", quantity: 200 }],
  });
  return beTransferOrderSchema.parse(res.data);
}

describe("mock /inventory/transfer-orders khớp BE", () => {
  it("four-eyes: người gửi duyệt tự duyệt / từ chối → 409 TRANSFER_SELF_APPROVAL; người khác duyệt được", async () => {
    signInAs("USER-PLAN-01");
    const draft = await createDraftOverThreshold();
    const base = `/inventory/transfer-orders/${draft.transferId}`;
    const submitted = beTransferOrderSchema.parse((await call("POST", `${base}/submission`)).data);
    expect(submitted.status).toBe("PENDING_APPROVAL");
    expect(submitted.submittedBy).toBe("USER-PLAN-01");

    const self = await call("POST", `${base}/approval`);
    expect(self.status).toBe(409);
    expect(self.data).toMatchObject({ errorCode: "TRANSFER_SELF_APPROVAL" });
    const selfReject = await call("POST", `${base}/rejection`, { reason: "Sai SL" });
    expect(selfReject.data).toMatchObject({ errorCode: "TRANSFER_SELF_APPROVAL" });

    signInAs("USER-ADMIN-01");
    const approved = beTransferOrderSchema.parse((await call("POST", `${base}/approval`)).data);
    expect(approved.status).toBe("APPROVED");
    expect(approved.approvedBy).toBe("USER-ADMIN-01");
  });

  it("thiếu tồn → 409 INSUFFICIENT_STOCK chỉ có message (như BE hiện tại), không có fieldErrors", async () => {
    signInAs("USER-PLAN-01");
    const draft = await createDraftOverThreshold();
    const res = await call("PUT", `/inventory/transfer-orders/${draft.transferId}`, {
      version: draft.version,
      fromWarehouseId: draft.fromWarehouseId,
      toWarehouseId: draft.toWarehouseId,
      lines: [{ sku: "SOFA-3S-GREY", quantity: 900 }],
    });
    expect(res.status).toBe(409);
    expect(res.data).toMatchObject({
      errorCode: "INSUFFICIENT_STOCK",
      message: "Insufficient stock for SKU SOFA-3S-GREY: requested 900, available 500",
    });
    expect((res.data as { fieldErrors?: unknown }).fieldErrors ?? []).toEqual([]);
  });
});
