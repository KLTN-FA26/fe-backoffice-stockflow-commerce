/**
 * Contract mock sự kiện hãng vận chuyển (BE `CarrierEventController`, docs 09 §4.5): chạy handler mock thật qua
 * `resolveMockRoute`, parse bằng schema FE.
 */

import { describe, expect, it } from "vitest";

import { FULFILLMENT_CARRIER_EVENT_PERMISSIONS } from "@/constants";
import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerDispatchMockRoutes } from "@/lib/api/mock-routes-dispatch";
import { MOCK_USER_GRANTS } from "@/lib/api/mock-user-grants";
import { useAuthStore } from "@/lib/auth/auth-store";

import { beCarrierEventDetailSchema, beCarrierEventPageSchema } from "./carrier-event-schemas";

import type { AxiosRequestConfig } from "axios";
import type { PermissionCode } from "@/lib/auth";

registerDispatchMockRoutes();

const P = FULFILLMENT_CARRIER_EVENT_PERMISSIONS;
const URL = "/fulfillment/carrier-events";

async function call(method: string, url: string, data?: unknown, params?: unknown) {
  const route = resolveMockRoute(method, url);
  if (!route) throw new Error(`Không có route mock ${method} ${url}`);
  return route.handler({
    url,
    data: data === undefined ? undefined : JSON.stringify(data),
    params,
    _mockParams: route.params,
  } as AxiosRequestConfig);
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

describe("mock carrier-events", () => {
  it("không có quyền READ → 403", async () => {
    actAs([]);
    expect((await call("GET", URL)).status).toBe(403);
  });

  it("danh sách lỗi (ERRORS) khớp schema FE; ALL gồm cả sự kiện đã áp dụng", async () => {
    actAs([P.read]);
    const errors = beCarrierEventPageSchema.parse(
      (await call("GET", URL, undefined, { result: "ERRORS" })).data,
    );
    expect(errors.items.map((e) => e.result)).not.toContain("APPLIED");
    expect(errors.items.length).toBeGreaterThan(0);
    const all = beCarrierEventPageSchema.parse((await call("GET", URL)).data);
    expect(all.items.map((e) => e.result)).toContain("APPLIED");
  });

  it("đánh dấu đã xử lý: cần UPDATE, ghi chú bắt buộc, chỉ một lần, không áp cho sự kiện đã áp dụng", async () => {
    actAs([P.read]);
    expect((await call("POST", `${URL}/mock-event-4/resolution`, { note: "x" })).status).toBe(403);
    actAs([P.read, P.update]);
    expect((await call("POST", `${URL}/mock-event-4/resolution`, { note: " " })).status).toBe(400);
    const done = await call("POST", `${URL}/mock-event-4/resolution`, { note: "Đã ghi tay" });
    expect(beCarrierEventDetailSchema.parse(done.data).event.resolutionNote).toBe("Đã ghi tay");
    const again = await call("POST", `${URL}/mock-event-4/resolution`, { note: "lại" });
    expect(again.status).toBe(409);
    expect((again.data as { errorCode: string }).errorCode).toBe("CARRIER_EVENT_NOT_RESOLVABLE");
    expect((await call("POST", `${URL}/mock-event-2/resolution`, { note: "x" })).status).toBe(409);
    expect((await call("GET", `${URL}/nope`)).status).toBe(404);
    const open = beCarrierEventPageSchema.parse(
      (await call("GET", URL, undefined, { open: "false" })).data,
    );
    expect(open.items.map((e) => e.eventId)).toContain("mock-event-4");
  });
});
