/**
 * Contract mock chuyến xe (SCRUM-288 đề xuất): chạy handler mock thật qua `resolveMockRoute` rồi
 * parse bằng schema FE — đảm bảo màn demo và hợp đồng FE không lệch nhau.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { resolveMockRoute } from "@/lib/api/mock-adapter";
import { registerLoadMockRoutes } from "@/lib/api/mock-routes-loads";
import { getLoadStore, resetLoadMockStore } from "@/lib/api/mock-routes-loads-store";

import { beLoadPageSchema, beLoadSchema } from "./schemas";

import type { AxiosRequestConfig } from "axios";

registerLoadMockRoutes();

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

beforeEach(() => resetLoadMockStore());

describe("mock /fulfillment/loads khớp schema FE", () => {
  it("danh sách phủ đủ trạng thái và parse được", async () => {
    const res = await call("GET", "/fulfillment/loads", undefined, { page: "0", size: "50" });
    const page = beLoadPageSchema.parse(res.data);
    expect(new Set(page.items.map((l) => l.status))).toEqual(
      new Set(["PLANNED", "VEHICLE_BOOKED", "LOADING", "DISPATCHED", "CANCELLED"]),
    );
  });

  it("quét: kiện chuyến khác → 409 PACKAGE_NOT_IN_LOAD; mã lạ → 404; quét đủ rồi bàn giao", async () => {
    const loads = [...(await getLoadStore()).values()];
    const loading = loads.find((l) => l.status === "LOADING" && l.lines.some((x) => !x.loadedAt));
    const other = loads.find((l) => l !== loading);
    if (!loading || !other) throw new Error("seed thiếu chuyến LOADING");
    const base = `/fulfillment/loads/${loading.loadId}`;

    const foreign = await call("POST", `${base}/scans`, {
      packageCode: other.lines[0]?.packageCode,
    });
    expect(foreign.status).toBe(409);
    expect(foreign.data).toMatchObject({ errorCode: "PACKAGE_NOT_IN_LOAD" });
    expect((await call("POST", `${base}/scans`, { packageCode: "NOPE-1" })).status).toBe(404);

    const early = await call("POST", `${base}/handover`, {
      version: loading.version,
      carrierRepresentative: "A",
    });
    expect(early.data).toMatchObject({ errorCode: "LOAD_NOT_FULLY_LOADED" });

    let latest = beLoadSchema.parse((await call("GET", base)).data);
    for (const missing of latest.lines.filter((l) => !l.loadedAt)) {
      latest = beLoadSchema.parse(
        (await call("POST", `${base}/scans`, { packageCode: missing.packageCode.toLowerCase() }))
          .data,
      );
    }
    expect(latest.loadedPackages).toBe(latest.plannedPackages);
    const again = await call("POST", `${base}/scans`, {
      packageCode: latest.lines[0]?.packageCode,
    });
    expect(again.data).toMatchObject({ errorCode: "PACKAGE_ALREADY_LOADED" });

    // Sai version → OPTIMISTIC_LOCK; chưa xác nhận ký biên bản → 400 (guard "manifest signed")
    const stale = await call("POST", `${base}/handover`, {
      version: latest.version - 1,
      carrierRepresentative: "Anh Tài",
      signed: true,
    });
    expect(stale.data).toMatchObject({ errorCode: "OPTIMISTIC_LOCK" });
    const unsigned = await call("POST", `${base}/handover`, {
      version: latest.version,
      carrierRepresentative: "Anh Tài",
    });
    expect(unsigned.status).toBe(400);

    const done = beLoadSchema.parse(
      (
        await call("POST", `${base}/handover`, {
          version: latest.version,
          carrierRepresentative: "Anh Tài",
          signed: true,
        })
      ).data,
    );
    expect(done.status).toBe("DISPATCHED");
    expect(done.manifest?.carrierRepresentative).toBe("Anh Tài");
    // Đã bàn giao → mọi thao tác sau là sai trạng thái
    const after = await call("POST", `${base}/scans`, { packageCode: "PKG-X" });
    expect(after.data).toMatchObject({ errorCode: "INVALID_LOAD_TRANSITION" });
  });

  it("xe đã đặt: quét trước khi bắt đầu xếp → 409 INVALID_LOAD_TRANSITION; bắt đầu → LOADING", async () => {
    const booked = [...(await getLoadStore()).values()].find((l) => l.status === "VEHICLE_BOOKED");
    if (!booked) throw new Error("seed thiếu chuyến VEHICLE_BOOKED");
    const base = `/fulfillment/loads/${booked.loadId}`;

    const early = await call("POST", `${base}/scans`, {
      packageCode: booked.lines[0]?.packageCode,
    });
    expect(early.status).toBe(409);
    expect(early.data).toMatchObject({ errorCode: "INVALID_LOAD_TRANSITION" });

    const started = beLoadSchema.parse((await call("POST", `${base}/loading-start`)).data);
    expect(started.status).toBe("LOADING");
    const twice = await call("POST", `${base}/loading-start`);
    expect(twice.data).toMatchObject({ errorCode: "INVALID_LOAD_TRANSITION" });
  });

  it("chuyến không tồn tại → 404 LOAD_NOT_FOUND", async () => {
    const res = await call("GET", "/fulfillment/loads/LOAD-NOPE");
    expect(res.status).toBe(404);
    expect(res.data).toMatchObject({ errorCode: "LOAD_NOT_FOUND" });
  });
});
