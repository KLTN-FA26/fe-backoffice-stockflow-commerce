import { describe, expect, it } from "vitest";

import { bookingRequestBody, isApiBooking, moveStop, pickupInstant } from "./booking";

import type { BookingValues } from "./types";

const values = (patch: Partial<BookingValues> = {}): BookingValues => ({
  carrierId: "car-1",
  vehiclePlate: "51C-628.14",
  driverName: "Lê Văn Xế",
  driverPhone: "0903123456",
  waybillNo: "GHN-1",
  pickupAt: "2026-11-20T08:30",
  ...patch,
});

describe("isApiBooking", () => {
  it("chỉ API_BOOKING; kiểu khác / lạ / chưa có là đặt tay", () => {
    expect(isApiBooking("API_BOOKING")).toBe(true);
    expect(isApiBooking("MANUAL")).toBe(false);
    expect(isApiBooking("WEBHOOK_LOAD")).toBe(false);
    expect(isApiBooking("UNKNOWN")).toBe(false);
    expect(isApiBooking(undefined)).toBe(false);
    expect(isApiBooking(null)).toBe(false);
  });
});

describe("pickupInstant — giờ Việt Nam (UTC+7) → Instant UTC", () => {
  it("trừ 7 giờ", () => {
    expect(pickupInstant("2026-11-20T08:30")).toBe("2026-11-20T01:30:00.000Z");
  });

  it("qua nửa đêm lùi sang ngày trước", () => {
    expect(pickupInstant("2026-11-20T03:00")).toBe("2026-11-19T20:00:00.000Z");
  });

  it("rỗng, vắng hoặc sai dạng → undefined", () => {
    expect(pickupInstant(undefined)).toBeUndefined();
    expect(pickupInstant("")).toBeUndefined();
    expect(pickupInstant("20/11/2026 08:30")).toBeUndefined();
    expect(pickupInstant("2026-11-20")).toBeUndefined();
    expect(pickupInstant("2026-11-20T08:30:00")).toBeUndefined();
    expect(pickupInstant("2026-13-40T99:99")).toBeUndefined();
  });
});

describe("bookingRequestBody", () => {
  it("hãng API: chỉ hãng + giờ hẹn (UTC) + thứ tự điểm giao; không biển số / tài xế / mã vận đơn", () => {
    expect(bookingRequestBody(values(), true, ["shp-2", "shp-1"])).toEqual({
      carrierId: "car-1",
      pickupAt: "2026-11-20T01:30:00.000Z",
      stopShipmentIds: ["shp-2", "shp-1"],
    });
    const body = bookingRequestBody(values(), true, ["shp-1"]);
    for (const key of ["vehiclePlate", "driverName", "driverPhone", "waybillNo"]) {
      expect(body).not.toHaveProperty(key);
    }
  });

  it("hãng API không chọn thứ tự (stops rỗng) → không gửi stopShipmentIds; không giờ hẹn → vắng", () => {
    const body = bookingRequestBody(values({ pickupAt: undefined }), true, []);
    expect(body.stopShipmentIds).toBeUndefined();
    expect(body.pickupAt).toBeUndefined();
    expect(body.carrierId).toBe("car-1");
  });

  it("hãng thường: hãng + biển số / tài xế / SĐT / mã vận đơn; không giờ hẹn, không điểm giao", () => {
    const body = bookingRequestBody(values(), false, ["shp-1"]);
    expect(body).toEqual({
      carrierId: "car-1",
      vehiclePlate: "51C-628.14",
      driverName: "Lê Văn Xế",
      driverPhone: "0903123456",
      waybillNo: "GHN-1",
    });
    expect(body).not.toHaveProperty("pickupAt");
    expect(body).not.toHaveProperty("stopShipmentIds");
  });
});

describe("moveStop", () => {
  const order = ["a", "b", "c"];

  it("đổi chỗ với điểm kề (lên / xuống) và không sửa mảng gốc", () => {
    expect(moveStop(order, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveStop(order, 1, 1)).toEqual(["a", "c", "b"]);
    expect(order).toEqual(["a", "b", "c"]);
  });

  it("ngoài biên thì giữ nguyên (bản sao)", () => {
    expect(moveStop(order, 0, -1)).toEqual(order);
    expect(moveStop(order, 2, 1)).toEqual(order);
    expect(moveStop(order, 5, -1)).toEqual(order);
    expect(moveStop(order, -1, 1)).toEqual(order);
    expect(moveStop(order, 0, -1)).not.toBe(order);
    expect(moveStop([], 0, 1)).toEqual([]);
  });
});
