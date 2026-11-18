import { describe, expect, it } from "vitest";

import { SHIPPING_DELIVERY_TIME_MESSAGES as M } from "@/constants";

import { deliveredAtToSend, deliveryTimeProblem, toLocalInput } from "./delivery-time";

// 2026-11-18 10:00 giờ Việt Nam (UTC+7) = 03:00 UTC
const NOW = new Date("2026-11-18T03:00:00Z");
const HANDED_OVER = "2026-11-16T01:30:00Z"; // 16/11 08:30 giờ Việt Nam

describe("toLocalInput — Instant → ô datetime-local theo giờ Việt Nam", () => {
  it("đổi UTC sang UTC+7, kể cả khi qua nửa đêm", () => {
    expect(toLocalInput("2026-11-18T03:00:00Z")).toBe("2026-11-18T10:00");
    expect(toLocalInput("2026-11-17T18:30:00Z")).toBe("2026-11-18T01:30");
  });

  it("nửa đêm là 00:xx, không phải 24:xx", () => {
    expect(toLocalInput("2026-11-17T17:05:00Z")).toBe("2026-11-18T00:05");
  });
});

describe("deliveryTimeProblem — luật của ô thời điểm giao (BE kiểm lại)", () => {
  const limits = { handedOverAt: HANDED_OVER, now: NOW };

  it("để trống = không nhập (BE lấy lúc ghi nhận) → không lỗi", () => {
    expect(deliveryTimeProblem("", limits)).toBeNull();
  });

  it("trong khoảng từ lúc bàn giao đến bây giờ → hợp lệ, kể cả đúng hai đầu", () => {
    expect(deliveryTimeProblem("2026-11-17T14:00", limits)).toBeNull();
    expect(deliveryTimeProblem("2026-11-16T08:30", limits)).toBeNull();
    expect(deliveryTimeProblem("2026-11-18T10:00", limits)).toBeNull();
  });

  it("ở tương lai → lỗi", () => {
    expect(deliveryTimeProblem("2026-11-18T10:01", limits)).toBe(M.future);
  });

  it("trước lúc bàn giao cho hãng → lỗi", () => {
    expect(deliveryTimeProblem("2026-11-16T08:29", limits)).toBe(M.beforeHandover);
  });

  it("lô chưa có mốc bàn giao: chỉ kiểm tương lai", () => {
    expect(deliveryTimeProblem("2020-01-01T00:00", { now: NOW })).toBeNull();
    expect(deliveryTimeProblem("2026-11-19T00:00", { now: NOW })).toBe(M.future);
  });

  it("sai dạng → lỗi nhập đủ ngày giờ", () => {
    expect(deliveryTimeProblem("2026-11-17", limits)).toBe(M.invalid);
  });
});

describe("deliveredAtToSend — chỉ gửi khi người dùng đã sửa ô", () => {
  it("chưa sửa → không gửi (BE lấy lúc ghi nhận, không theo đồng hồ trình duyệt)", () => {
    expect(deliveredAtToSend("2026-11-18T10:00", false)).toBeUndefined();
  });

  it("đã sửa → Instant ISO UTC của giờ Việt Nam", () => {
    expect(deliveredAtToSend("2026-11-17T14:30", true)).toBe("2026-11-17T07:30:00.000Z");
  });

  it("đã sửa rồi xoá trắng → không gửi", () => {
    expect(deliveredAtToSend("", true)).toBeUndefined();
  });
});
