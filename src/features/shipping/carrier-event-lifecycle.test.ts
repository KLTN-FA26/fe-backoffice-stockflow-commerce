import { describe, expect, it } from "vitest";

import {
  CARRIER_EVENT_ERROR_RESULTS,
  CARRIER_EVENT_RESULTS,
  FULFILLMENT_CARRIER_EVENT_PERMISSIONS,
  UI_LABELS,
} from "@/constants";

import { statusLabelVi, toneOf } from "@/lib/status-map";

import {
  CARRIER_EVENT_ALL_FILTER,
  carrierEventStatusKey,
  carrierEventActions,
  isErrorFilter,
  isErrorListResult,
  isOpenError,
  resultParam,
} from "./carrier-event-lifecycle";

const can = (...codes: string[]) => ({ can: (code: string) => codes.includes(code) });
const UPDATE = FULFILLMENT_CARRIER_EVENT_PERMISSIONS.update;

describe("danh sách lỗi (BE CarrierEventResult.errorList)", () => {
  it("đúng năm kết quả của docs 09 §4.5 bước 8", () => {
    expect([...CARRIER_EVENT_ERROR_RESULTS].sort()).toEqual(
      ["INVALID_SIGNATURE", "NEEDS_REVIEW", "RECEIVED", "UNMATCHED", "UNVERIFIED"].sort(),
    );
    for (const result of CARRIER_EVENT_RESULTS) {
      expect(isErrorListResult(result)).toBe(
        (CARRIER_EVENT_ERROR_RESULTS as readonly string[]).includes(result),
      );
    }
    expect(isErrorListResult("UNKNOWN")).toBe(false);
  });

  it("mọi kết quả có nhãn tiếng Việt và tông màu trong status-map, kèm nghĩa", () => {
    for (const result of CARRIER_EVENT_RESULTS) {
      expect(UI_LABELS.shipping.carrierEvents.resultMeaning[result]).toBeTruthy();
      expect(statusLabelVi(carrierEventStatusKey(result), "shipment")).toBe(
        UI_LABELS.shipping.carrierEvents.result[result],
      );
      expect(toneOf(carrierEventStatusKey(result))).not.toBe("neutral");
    }
    expect(UI_LABELS.shipping.carrierEvents.resultMeaning.UNKNOWN).toBeTruthy();
    // RECEIVED của NCC giữ nhãn cũ
    expect(statusLabelVi("RECEIVED", "shipment")).not.toBe(
      UI_LABELS.shipping.carrierEvents.result.RECEIVED,
    );
  });
});

describe("carrierEventActions", () => {
  it("đánh dấu đã xử lý: cần quyền UPDATE và sự kiện lỗi còn mở", () => {
    const open = { result: "NEEDS_REVIEW", resolvedAt: undefined } as const;
    expect(carrierEventActions(can(UPDATE), open).resolve).toBe(true);
    expect(carrierEventActions(can(), open).resolve).toBe(false);
    expect(carrierEventActions(can(FULFILLMENT_CARRIER_EVENT_PERMISSIONS.read), open).resolve).toBe(
      false,
    );
  });

  it("đã đánh dấu rồi hoặc không thuộc danh sách lỗi: không còn nút", () => {
    expect(
      carrierEventActions(can(UPDATE), { result: "UNMATCHED", resolvedAt: "2026-11-18T08:00:00Z" })
        .resolve,
    ).toBe(false);
    expect(carrierEventActions(can(UPDATE), { result: "APPLIED", resolvedAt: null }).resolve).toBe(
      false,
    );
    expect(isOpenError({ result: "RECEIVED", resolvedAt: null })).toBe(true);
  });
});

describe("bộ lọc kết quả", () => {
  it("ALL không gửi result; ERRORS và từng kết quả gửi nguyên văn", () => {
    expect(resultParam(CARRIER_EVENT_ALL_FILTER)).toBeUndefined();
    expect(resultParam("ERRORS")).toBe("ERRORS");
    expect(resultParam("STALE")).toBe("STALE");
  });

  it("lọc đã / chưa xử lý chỉ có nghĩa khi xem lỗi", () => {
    expect(isErrorFilter("ERRORS")).toBe(true);
    expect(isErrorFilter("UNMATCHED")).toBe(true);
    expect(isErrorFilter("APPLIED")).toBe(false);
    expect(isErrorFilter(CARRIER_EVENT_ALL_FILTER)).toBe(false);
  });
});
