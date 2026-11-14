/**
 * Yêu cầu huỷ: DTO BE (`CancellationRequestResponse`), hiển thị trạng thái, input duyệt / từ chối (docs 17 §4.8, §5.4).
 */
import { describe, expect, it } from "vitest";

import { CANCELLATION_REQUEST_LABELS as L } from "@/constants";

import { toCancellationRequest } from "./cancellation-request-api";
import {
  approveCancellationSchema,
  cancellationRequestDisplayStatus,
  cancellationRequestDtoSchema,
  cancellationRequestPageDtoSchema,
  rejectCancellationSchema,
} from "./cancellation-request-schemas";

const dto = {
  requestId: "r-1",
  orderId: "o-1",
  requestedBy: "u-customer",
  reasonCode: "CUSTOMER_REQUEST",
  requestedAt: "2026-11-12T03:00:00Z",
  status: "PENDING",
  version: 0,
};

describe("DTO BE → model FE", () => {
  it("field null bị BE bỏ (Jackson non_null) → model trả null, không undefined", () => {
    expect(toCancellationRequest(cancellationRequestDtoSchema.parse(dto))).toEqual({
      requestId: "r-1",
      orderId: "o-1",
      reasonCode: "CUSTOMER_REQUEST",
      note: null,
      requestedAt: "2026-11-12T03:00:00Z",
      status: "PENDING",
      decidedAt: null,
      decisionNote: null,
      retainedPercent: null,
    });
  });

  it("yêu cầu đã duyệt giữ % và ghi chú quyết định", () => {
    const decided = toCancellationRequest(
      cancellationRequestDtoSchema.parse({
        ...dto,
        status: "APPROVED",
        decidedAt: "2026-11-12T04:00:00Z",
        decisionNote: "Đã thoả thuận",
        retainedPercent: 30,
      }),
    );
    expect(decided).toMatchObject({
      status: "APPROVED",
      retainedPercent: 30,
      decisionNote: "Đã thoả thuận",
    });
  });

  it("trang BE (PageResponse) và response thiếu requestId bị từ chối ở biên", () => {
    expect(
      cancellationRequestPageDtoSchema.safeParse({
        items: [dto],
        page: 0,
        size: 10,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      }).success,
    ).toBe(true);
    expect(cancellationRequestDtoSchema.safeParse({ ...dto, requestId: undefined }).success).toBe(
      false,
    );
  });
});

describe("cancellationRequestDisplayStatus — trạng thái nguyên văn của docs 17 §5.4", () => {
  it("PENDING / APPROVED / REJECTED / EXPIRED → Pending / Approved / Rejected / Expired", () => {
    expect(
      ["PENDING", "APPROVED", "REJECTED", "EXPIRED"].map(cancellationRequestDisplayStatus),
    ).toEqual(["Pending", "Approved", "Rejected", "Expired"]);
  });

  it("mã lạ → nguyên chuỗi (không đoán)", () => {
    expect(cancellationRequestDisplayStatus("WITHDRAWN")).toBe("WITHDRAWN");
    // Tên thuộc tính của Object.prototype không được coi là trạng thái đã biết
    expect(cancellationRequestDisplayStatus("toString")).toBe("toString");
  });
});

describe("approveCancellationSchema (docs 17 §4.8 bước 30)", () => {
  it("không phí, không ghi chú → hợp lệ (hoàn toàn bộ)", () => {
    expect(approveCancellationSchema.parse({ note: "" })).toEqual({ note: "" });
  });

  it("giữ theo %: lớn hơn 0, tối đa 100, tối đa 2 chữ số thập phân", () => {
    expect(approveCancellationSchema.safeParse({ note: "", retainedPercent: 30.5 }).success).toBe(
      true,
    );
    expect(approveCancellationSchema.safeParse({ note: "", retainedPercent: 100 }).success).toBe(
      true,
    );
    for (const bad of [0, -5, 100.01, 12.345, Number.NaN]) {
      const result = approveCancellationSchema.safeParse({ note: "", retainedPercent: bad });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe(L.fee.percentInvalid);
    }
  });

  it("giữ theo số tiền thoả thuận: nguyên VND > 0, kèm lý do + chi tiết", () => {
    const fee = { amount: 500_000, reason: "Phôi đã in", detail: "Thoả thuận qua điện thoại" };
    expect(approveCancellationSchema.safeParse({ note: "", agreedFee: fee }).success).toBe(true);
    for (const bad of [
      { ...fee, amount: 0 },
      { ...fee, amount: 1500.5 },
      { ...fee, reason: " " },
      { ...fee, detail: "" },
    ]) {
      expect(approveCancellationSchema.safeParse({ note: "", agreedFee: bad }).success).toBe(false);
    }
  });

  it("BR: chỉ một trong hai — % và số tiền thoả thuận cùng lúc bị từ chối, lỗi gắn vào agreedFee", () => {
    const result = approveCancellationSchema.safeParse({
      note: "",
      retainedPercent: 10,
      agreedFee: { amount: 1000, reason: "a", detail: "b" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        path: ["agreedFee"],
        message: L.fee.bothChosen,
      });
    }
  });

  it("ghi chú tối đa 1000 ký tự", () => {
    expect(approveCancellationSchema.safeParse({ note: "x".repeat(1001) }).success).toBe(false);
  });
});

describe("rejectCancellationSchema (docs 17 §4.8 bước 28: từ chối bắt buộc ghi lý do)", () => {
  it("lý do trống / chỉ khoảng trắng → lỗi 'Hãy ghi lý do từ chối'", () => {
    for (const note of ["", "   "]) {
      const result = rejectCancellationSchema.safeParse({ note });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe(L.reject.noteRequired);
    }
  });

  it("có lý do → được trim; tối đa 1000 ký tự", () => {
    expect(rejectCancellationSchema.parse({ note: "  đã in rồi  " })).toEqual({
      note: "đã in rồi",
    });
    expect(rejectCancellationSchema.safeParse({ note: "x".repeat(1001) }).success).toBe(false);
  });
});
