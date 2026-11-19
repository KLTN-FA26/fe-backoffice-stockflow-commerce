import { afterEach, describe, expect, it, vi } from "vitest";

import { LOAD_PLAN_PERMISSIONS } from "@/constants";
import { api } from "@/lib/api/client";

import { downloadLoadingSheet } from "./loading-sheet-api";
import { loadingSheetOf } from "./loading-sheet-lifecycle";

import type { ShippingActor } from "./lifecycle";

afterEach(() => vi.restoreAllMocks());

const can = (...codes: string[]): ShippingActor => ({ can: (code) => codes.includes(code) });

describe("loadingSheetOf — nút 'Tải PDF' phiếu xếp hàng (docs 09 §4.2 bước 5)", () => {
  const READ = can(LOAD_PLAN_PERMISSIONS.read);

  it("chuyến của một xe + có fulfillment-load-plans:READ → trả đúng kế hoạch và số xe", () => {
    expect(loadingSheetOf({ loadPlanId: "lp-1", vehicleSeq: 3, status: "LOADING" }, READ)).toEqual({
      loadPlanId: "lp-1",
      vehicleSeq: 3,
    });
  });

  it("thiếu mã quyền đọc kế hoạch (dù xem được chuyến) → không có nút", () => {
    expect(
      loadingSheetOf({ loadPlanId: "lp-1", vehicleSeq: 3, status: "LOADING" }, can()),
    ).toBeNull();
  });

  it("chuyến không gắn xe của kế hoạch → không có nút", () => {
    expect(
      loadingSheetOf({ loadPlanId: undefined, vehicleSeq: undefined, status: "LOADING" }, READ),
    ).toBeNull();
    expect(
      loadingSheetOf({ loadPlanId: "lp-1", vehicleSeq: null, status: "LOADING" }, READ),
    ).toBeNull();
  });

  it("chuyến đã huỷ → không có nút (kế hoạch của nó có thể đã huỷ, BE từ chối)", () => {
    expect(
      loadingSheetOf({ loadPlanId: "lp-1", vehicleSeq: 3, status: "CANCELLED" }, READ),
    ).toBeNull();
  });
});

describe("downloadLoadingSheet — GET load-plans/{id}/vehicles/{seq}/loading-sheet.pdf", () => {
  it("gọi đúng endpoint, nhận blob và tên file BE đặt", async () => {
    const pdf = new Blob(["%PDF"]);
    const get = vi.spyOn(api, "get").mockResolvedValueOnce({
      data: pdf,
      headers: { "content-disposition": 'attachment; filename="loading-sheet-LP-9-vehicle1.pdf"' },
    });
    const file = await downloadLoadingSheet({ loadPlanId: "lp 9", vehicleSeq: 1 });
    expect(get.mock.calls[0]?.[0]).toBe(
      "/fulfillment/load-plans/lp%209/vehicles/1/loading-sheet.pdf",
    );
    expect(file).toEqual({ blob: pdf, fileName: "loading-sheet-LP-9-vehicle1.pdf" });
  });
});
