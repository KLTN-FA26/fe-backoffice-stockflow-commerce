/**
 * Audit r3 EINV-1 — sửa tay kết quả giao (BE `POST /fulfillment/shipments/{id}/delivery-outcome-correction`) và
 * `ShipmentResponse.undoneDeliveredAt` (BE r3 merge 294cc788c): chạy handler mock thật rồi parse bằng schema FE. Trường có
 * giá trị chỉ khi lô đang "giao thất bại" do chính lần sửa từ "đã giao"; sửa ngược về "đã giao" không gửi `deliveredAt`
 * thì lấy lại đúng thời điểm đó, và trường thành null.
 */

import { beforeEach, describe, expect, it } from "vitest";

import {
  FULFILLMENT_DELIVERY_CORRECTION_PERMISSIONS,
  FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS,
} from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { resetDispatchMockStore } from "@/lib/api/mock-dispatch-store";
import { registerDispatchMockRoutes } from "@/lib/api/mock-routes-dispatch";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import { beShipmentPageSchema, beShipmentSchema } from "./schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerDispatchMockRoutes();

const SHIPMENTS = "/fulfillment/shipments";
const CORRECT = FULFILLMENT_DELIVERY_CORRECTION_PERMISSIONS.update;
const COORDINATOR: PermissionCode[] = Object.values(FULFILLMENT_DELIVERY_OUTCOME_PERMISSIONS);

async function call(method: string, url: string, data?: unknown, params?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  const config = {
    url,
    data: data === undefined ? data : JSON.stringify(data),
    params,
    _mockParams: route.params,
  };
  return route.handler(config as AxiosRequestConfig);
}

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
      mustChangePassword: false,
    },
    status: "authenticated",
  });
}

const errorCode = (res: { data: unknown }) => (res.data as { errorCode?: string }).errorCode;
const correct = (id: string, body: Record<string, unknown>) =>
  call("POST", `${SHIPMENTS}/${id}/delivery-outcome-correction`, body);

/** Một lô đã giao (điều phối ghi "đã giao" lên một lô đã bàn giao của seed). */
async function delivered() {
  actAs(COORDINATOR);
  const rows = beShipmentPageSchema.parse(
    (await call("GET", SHIPMENTS, undefined, { size: "200", status: "HANDED_OVER" })).data,
  ).items;
  const id = rows[0]?.shipmentId ?? "";
  const done = beShipmentSchema.parse(
    (await call("POST", `${SHIPMENTS}/${id}/delivery-outcome`, { outcome: "DELIVERED" })).data,
  );
  expect(done.shipment.status).toBe("DELIVERED");
  expect(done.undoneDeliveredAt ?? null).toBeNull();
  return done;
}

beforeEach(() => resetDispatchMockStore());

describe("audit r3 EINV-1 — undoneDeliveredAt on the shipment's answer", () => {
  it("set while the failure is the correction of a delivery; back to delivered with no time restores it, then null", async () => {
    const done = await delivered();
    const id = done.shipment.shipmentId;
    const deliveredAt = done.shipment.outcomeAt;
    actAs([CORRECT]);
    const failed = beShipmentSchema.parse(
      (
        await correct(id, {
          outcome: "DELIVERY_FAILED",
          failureReason: "REFUSED",
          reason: "Hãng báo nhầm",
        })
      ).data,
    );
    expect(failed.shipment.status).toBe("DELIVERY_FAILED");
    expect(failed.undoneDeliveredAt).toBe(deliveredAt);
    // GET trả cùng trường (BE `FtlDispatchIntegrationTest#correctingAnOutcome`)
    expect(
      beShipmentSchema.parse((await call("GET", `${SHIPMENTS}/${id}`)).data).undoneDeliveredAt,
    ).toBe(deliveredAt);
    const back = beShipmentSchema.parse(
      (await correct(id, { outcome: "DELIVERED", reason: "Khách xác nhận đã nhận" })).data,
    );
    expect(back.shipment.status).toBe("DELIVERED");
    expect(back.shipment.outcomeAt).toBe(deliveredAt);
    // Jackson non_null: null thì vắng
    expect(back.undoneDeliveredAt ?? null).toBeNull();
  });

  it("a time sent on the way back wins; the rules and the permission are the BE's", async () => {
    const done = await delivered();
    const id = done.shipment.shipmentId;
    actAs(COORDINATOR);
    expect(
      (await correct(id, { outcome: "DELIVERY_FAILED", failureReason: "REFUSED", reason: "x" }))
        .status,
    ).toBe(403);
    actAs([CORRECT]);
    expect(
      errorCode(await correct(id, { outcome: "DELIVERY_FAILED", failureReason: "REFUSED" })),
    ).toBe("VALIDATION_FAILED");
    expect(errorCode(await correct(id, { outcome: "DELIVERY_FAILED", reason: "x" }))).toBe(
      "VALIDATION_FAILED",
    );
    expect(
      (await correct(id, { outcome: "DELIVERY_FAILED", failureReason: "REFUSED", reason: "x" }))
        .status,
    ).toBe(200);
    const later = "2026-10-23T02:00:00.000Z";
    const back = beShipmentSchema.parse(
      (await correct(id, { outcome: "DELIVERED", reason: "Giao lại hôm sau", deliveredAt: later }))
        .data,
    );
    expect(back.shipment.outcomeAt).toBe(later);
    // Jackson non_null: null thì vắng
    expect(back.undoneDeliveredAt ?? null).toBeNull();
  });

  it("the BE's Instant, with microseconds, parses as is", () => {
    const parsed = beShipmentSchema.parse({
      shipment: {
        shipmentId: "s-1",
        code: "SH-1",
        orderId: "o-1",
        warehouseId: "w-1",
        status: "DELIVERY_FAILED",
        packageCount: 1,
        partial: false,
        wholeOrderHandover: false,
        version: 3,
      },
      packages: [],
      timeline: [],
      reasonCorrections: [],
      undoneDeliveredAt: "2026-10-22T03:00:00.123456Z",
    });
    expect(parsed.undoneDeliveredAt).toBe("2026-10-22T03:00:00.123456Z");
  });
});
