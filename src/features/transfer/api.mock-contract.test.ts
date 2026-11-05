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

import { beTransferOrderSchema, beTransferPageSchema } from "./schemas";

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

describe("mock /inventory/transfer-orders khớp BE PR #164 (hình thức giao, xuất kho, dừng lấy hàng)", () => {
  const post = (path: string, body?: unknown) => call("POST", path, body);

  async function draft(deliveryMode?: string) {
    const seed = [...(await getTransferStore()).values()][0];
    if (!seed) throw new Error("seed thiếu lệnh chuyển kho");
    const res = await post("/inventory/transfer-orders", {
      fromWarehouseId: seed.fromWarehouseId,
      toWarehouseId: seed.toWarehouseId,
      deliveryMode,
      lines: [{ sku: "SOFA-3S-GREY", quantity: 10 }],
    });
    return res;
  }

  it("danh sách: mỗi dòng có deliveryMode; lệnh seed đã đóng gói có packedAt, lệnh giao lẻ là PARCEL (BE PR #164 final)", async () => {
    const res = await call("GET", "/inventory/transfer-orders", undefined);
    const page = beTransferPageSchema.parse(res.data);
    expect(
      page.items.every(
        (row) => row.deliveryMode === "FULL_TRUCKLOAD" || row.deliveryMode === "PARCEL",
      ),
    ).toBe(true);
    expect(page.items.find((r) => r.number === "TO-2026-0006")).toMatchObject({
      deliveryMode: "FULL_TRUCKLOAD",
    });
    expect(page.items.find((r) => r.number === "TO-2026-0006")?.packedAt).toBeTruthy();
    expect(page.items.find((r) => r.number === "TO-20261022-0002")).toMatchObject({
      deliveryMode: "PARCEL",
    });
    expect(
      page.items.find((r) => r.number === "TO-20261022-0001")?.packedAt ?? undefined,
    ).toBeUndefined();
  });

  it("tạo: mặc định FULL_TRUCKLOAD, chưa đóng gói, hàng chưa rời kho; PARCEL được nhận; giá trị lạ → 400", async () => {
    signInAs("USER-PLAN-01");
    const created = beTransferOrderSchema.parse((await draft()).data);
    expect(created).toMatchObject({ deliveryMode: "FULL_TRUCKLOAD" });
    expect(created.packedAt ?? undefined).toBeUndefined();
    expect(created.goodsLeftAt ?? undefined).toBeUndefined();
    expect(beTransferOrderSchema.parse((await draft("PARCEL")).data).deliveryMode).toBe("PARCEL");
    expect((await draft("DRONE")).status).toBe(400);
  });

  it("sửa nháp đổi được hình thức giao; ngoài DRAFT → 409 TRANSFER_ORDER_NOT_EDITABLE", async () => {
    signInAs("USER-PLAN-01");
    const created = beTransferOrderSchema.parse((await draft()).data);
    const put = (version: number, deliveryMode: string) =>
      call("PUT", `/inventory/transfer-orders/${created.transferId}`, {
        version,
        fromWarehouseId: created.fromWarehouseId,
        toWarehouseId: created.toWarehouseId,
        deliveryMode,
        lines: [{ sku: "SOFA-3S-GREY", quantity: 10 }],
      });
    const edited = beTransferOrderSchema.parse((await put(created.version, "PARCEL")).data);
    expect(edited.deliveryMode).toBe("PARCEL");
    await post(`/inventory/transfer-orders/${created.transferId}/submission`);
    const locked = await put(edited.version + 1, "FULL_TRUCKLOAD");
    expect(locked.data).toMatchObject({ errorCode: "TRANSFER_ORDER_NOT_EDITABLE" });
  });

  it("xuất kho tay: FULL_TRUCKLOAD → 409 TRANSFER_DISPATCH_BY_LOAD_PLAN; PARCEL xuất được", async () => {
    signInAs("USER-PLAN-01");
    for (const [mode, expectedOk] of [
      ["FULL_TRUCKLOAD", false],
      ["PARCEL", true],
    ] as const) {
      const created = beTransferOrderSchema.parse((await draft(mode)).data);
      const base = `/inventory/transfer-orders/${created.transferId}`;
      await post(`${base}/submission`);
      await post(`${base}/picking`);
      const dispatched = await post(`${base}/dispatch`, {
        lines: [{ lineId: created.lines[0]?.lineId, shippedQuantity: 5 }],
      });
      if (expectedOk) expect(dispatched.status).toBe(200);
      else {
        expect(dispatched.status).toBe(409);
        expect(dispatched.data).toMatchObject({ errorCode: "TRANSFER_DISPATCH_BY_LOAD_PLAN" });
      }
    }
  });

  it("dừng lấy hàng khi hàng đã rời kho → 409 TRANSFER_GOODS_LEFT, lệnh giữ nguyên", async () => {
    signInAs("USER-PLAN-01");
    const created = beTransferOrderSchema.parse((await draft()).data);
    const base = `/inventory/transfer-orders/${created.transferId}`;
    await post(`${base}/submission`);
    await post(`${base}/picking`);
    const store = await getTransferStore();
    const current = store.get(created.transferId);
    if (!current) throw new Error("mất lệnh");
    store.set(created.transferId, { ...current, goodsLeftAt: "2026-10-22T06:00:00Z" });
    const res = await post(`${base}/picking-cancellation`);
    expect(res.status).toBe(409);
    expect(res.data).toMatchObject({ errorCode: "TRANSFER_GOODS_LEFT" });
    expect(store.get(created.transferId)?.status).toBe("PICKING");
  });
});

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
