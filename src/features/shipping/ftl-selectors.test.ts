import { describe, expect, it } from "vitest";

import { dispatchedLoad, ftlLoad, pendingUnload, plannedLoad } from "./__fixtures__/ftl-load";
import { apiLoad } from "./__fixtures__/load";
import {
  hasPendingUnloads,
  isAutoCancelled,
  hasWaybill,
  isApiBookedLoad,
  needsCarrierBookingCancel,
  pendingUnloadsOf,
} from "./ftl-selectors";

describe("ftl-selectors", () => {
  it("chuyến đặt qua API hãng: chỉ khi kiểu kết nối là API_BOOKING", () => {
    expect(isApiBookedLoad({ carrierConnectionType: "API_BOOKING" })).toBe(true);
    expect(isApiBookedLoad({ carrierConnectionType: "MANUAL" })).toBe(false);
    expect(isApiBookedLoad({ carrierConnectionType: "WEBHOOK_LOAD" })).toBe(false);
    expect(isApiBookedLoad({ carrierConnectionType: "UNKNOWN" })).toBe(false);
    expect(isApiBookedLoad({})).toBe(false);
    expect(isApiBookedLoad(plannedLoad())).toBe(false);
  });

  it("mã vận đơn: có khi chuỗi không rỗng", () => {
    expect(hasWaybill(apiLoad())).toBe(true);
    expect(hasWaybill(dispatchedLoad())).toBe(true);
    expect(hasWaybill(ftlLoad())).toBe(false);
    expect(hasWaybill({ waybillNo: "" })).toBe(false);
  });

  it("kiện cần dỡ: vắng = không có; có = chặn bàn giao", () => {
    expect(pendingUnloadsOf(apiLoad())).toEqual([]);
    expect(hasPendingUnloads(ftlLoad())).toBe(false);
    expect(hasPendingUnloads(ftlLoad({ pendingUnloads: [pendingUnload()] }))).toBe(true);
  });

  it("nhắc huỷ xe đã đặt: chỉ khi chuyến CANCELLED và BE đặt cờ", () => {
    expect(needsCarrierBookingCancel({ status: "CANCELLED", carrierBookingToCancel: true })).toBe(
      true,
    );
    expect(needsCarrierBookingCancel({ status: "CANCELLED", carrierBookingToCancel: false })).toBe(
      false,
    );
    expect(needsCarrierBookingCancel({ status: "CANCELLED" })).toBe(false);
    expect(needsCarrierBookingCancel({ status: "LOADING", carrierBookingToCancel: true })).toBe(
      false,
    );
  });

  it("huỷ tự động: lý do bắt đầu bằng 'auto-cancelled'", () => {
    expect(isAutoCancelled({ cancelReason: "auto-cancelled: nothing to carry - x" })).toBe(true);
    expect(isAutoCancelled({ cancelReason: "Auto-Cancelled: y" })).toBe(true);
    expect(isAutoCancelled({ cancelReason: "Hãng huỷ" })).toBe(false);
    expect(isAutoCancelled({})).toBe(false);
  });
});
