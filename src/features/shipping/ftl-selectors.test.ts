import { describe, expect, it } from "vitest";

import { dispatchedLoad, ftlLoad, pendingUnload, plannedLoad } from "./__fixtures__/ftl-load";
import { apiLoad } from "./__fixtures__/load";
import {
  hasPendingUnloads,
  inProgressFirst,
  isAutoCancelled,
  latestCarrierId,
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

describe("latestCarrierId (S17-3: hãng dùng gần nhất của kho lên đầu)", () => {
  it("là hãng của chuyến bàn giao muộn nhất; chuyến chưa bàn giao hoặc chưa có hãng bỏ qua", () => {
    expect(
      latestCarrierId([
        { carrierId: "car-a", dispatchedAt: "2026-11-20T03:00:00Z" },
        { carrierId: "car-b", dispatchedAt: "2026-11-24T03:00:00Z" },
        { carrierId: "car-c", dispatchedAt: undefined },
        { carrierId: undefined, dispatchedAt: "2026-11-25T03:00:00Z" },
      ]),
    ).toBe("car-b");
  });

  it("không chuyến nào đủ điều kiện → null", () => {
    expect(latestCarrierId([])).toBeNull();
    expect(latestCarrierId([{ carrierId: "car-a", dispatchedAt: undefined }])).toBeNull();
  });
});

describe("inProgressFirst (S20-3)", () => {
  it("puts loads being handled first, dispatched next, cancelled last, keeping the BE order inside a group", () => {
    const rows = [
      { id: "1", status: "CANCELLED" },
      { id: "2", status: "DISPATCHED" },
      { id: "3", status: "PLANNED" },
      { id: "4", status: "LOADING" },
      { id: "5", status: "PLANNED" },
      { id: "6", status: "VEHICLE_BOOKED" },
    ] as const;
    expect(inProgressFirst(rows).map((r) => r.id)).toEqual(["4", "6", "3", "5", "2", "1"]);
    expect(rows.map((r) => r.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
});
