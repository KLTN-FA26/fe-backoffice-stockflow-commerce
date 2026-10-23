import { describe, expect, it } from "vitest";

import { ftlLoad, kit, pendingUnload } from "./__fixtures__/ftl-load";
import { apiLoad } from "./__fixtures__/load";
import {
  hasPendingUnloads,
  isAutoCancelled,
  isFtlLoad,
  isLabelOutdated,
  kitOf,
  needsCarrierBookingCancel,
  pendingUnloadsOf,
} from "./ftl-selectors";

describe("ftl-selectors", () => {
  it("nhận chuyến nguyên xe theo mode", () => {
    expect(isFtlLoad(ftlLoad())).toBe(true);
    expect(isFtlLoad(apiLoad())).toBe(false);
    expect(isFtlLoad({ mode: "UNKNOWN" })).toBe(false);
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

  it("kiện: bộ và cờ nhãn cũ", () => {
    expect(kitOf({ kit: kit(2) })).toEqual(kit(2));
    expect(kitOf({})).toBeNull();
    expect(isLabelOutdated({ labelOutdated: true })).toBe(true);
    expect(isLabelOutdated({ labelOutdated: false })).toBe(false);
    expect(isLabelOutdated({})).toBe(false);
  });
});
