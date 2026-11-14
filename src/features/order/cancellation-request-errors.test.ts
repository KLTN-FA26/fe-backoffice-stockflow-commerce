/**
 * Lỗi duyệt / từ chối yêu cầu huỷ → câu tiếng Việt (docs 17 §4.8 bước 28–31, BE `CancellationRequestService`).
 */
import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/error";

import {
  CANCELLATION_REQUEST_STALE_CODES,
  cancellationDecisionErrorView,
} from "./cancellation-request-errors";
import { ORDER_STALE_ERROR_CODES } from "./errors";

const apiError = (status: number, code: string, message = "English server message") =>
  new ApiError(status, code, message, undefined, "t-1");
const VIETNAMESE = /[ạảãàáâấầẩẫậăắằẳẵặẹẻẽèéêếềểễệỉĩịọỏõòóôốồổỗộơớờởỡợụủũùúưứừửữựỳỷỹýđ]/i;

describe("cancellationDecisionErrorView — tiếng Việt, không lộ message tiếng Anh của BE", () => {
  it.each([
    ["ORDER_NOT_CANCELLABLE", 409, "17 §4.8 bước 31"],
    ["ORDER_CANCELLATION_REQUEST_NOT_PENDING", 409, "17 §5.4"],
    ["CANCELLATION_FEE_BEFORE_PRINTING", 409, "BR-11"],
  ])("%s → có mã quy tắc %s", (code, status, rule) => {
    for (const action of ["approve", "reject"] as const) {
      const view = cancellationDecisionErrorView(apiError(status, code), action);
      expect(view.rule).toBe(rule);
      expect(view.detail).toMatch(VIETNAMESE);
      expect(view.detail).not.toContain("English");
      expect(view.traceId).toBe("t-1");
    }
  });

  it("sau thùng dán nhãn đầu tiên (ORDER_NOT_CANCELLABLE): nói rõ đã dán nhãn và hướng khách sang trả hàng", () => {
    const view = cancellationDecisionErrorView(apiError(409, "ORDER_NOT_CANCELLABLE"), "approve");
    expect(view.detail).toMatch(/dán nhãn giao hàng/);
    expect(view.detail).toMatch(/trả hàng/);
    expect(view.title).toBe("Không duyệt được yêu cầu huỷ");
  });

  it("tiêu đề theo thao tác: duyệt vs từ chối", () => {
    expect(
      cancellationDecisionErrorView(apiError(409, "ORDER_NOT_CANCELLABLE"), "approve").title,
    ).toBe("Không duyệt được yêu cầu huỷ");
    expect(
      cancellationDecisionErrorView(
        apiError(409, "ORDER_CANCELLATION_REQUEST_NOT_PENDING"),
        "reject",
      ).title,
    ).toBe("Không từ chối được yêu cầu huỷ");
  });

  it("404 (yêu cầu không còn) → câu riêng; 400 → liệt kê điều kiện theo thao tác", () => {
    expect(
      cancellationDecisionErrorView(apiError(404, "CANCELLATION_REQUEST_NOT_FOUND"), "approve")
        .detail,
    ).toMatch(/Không tìm thấy yêu cầu huỷ/);
    expect(
      cancellationDecisionErrorView(apiError(400, "VALIDATION_FAILED"), "approve").detail,
    ).toMatch(/tỷ lệ giữ lại/);
    expect(
      cancellationDecisionErrorView(apiError(400, "VALIDATION_FAILED"), "reject").detail,
    ).toMatch(/lý do từ chối/);
  });

  it("lỗi chung (quyền, tranh chấp khoá, mạng, mã lạ) rơi về câu chung theo thao tác", () => {
    const forbidden = cancellationDecisionErrorView(apiError(403, "FORBIDDEN"), "approve");
    expect(forbidden.detail).toBe("Bạn không có quyền duyệt yêu cầu huỷ.");
    expect(cancellationDecisionErrorView(apiError(409, "LOCK_TIMEOUT"), "reject").detail).toMatch(
      /Đợi vài giây/,
    );
    const unknown = cancellationDecisionErrorView(apiError(500, "SOMETHING_NEW"), "reject");
    expect(unknown.detail).toBe("Đã xảy ra lỗi khi từ chối yêu cầu huỷ. Vui lòng thử lại.");
    expect(unknown.detail).not.toContain("English");
  });
});

describe("CANCELLATION_REQUEST_STALE_CODES — dữ liệu đã cũ → đóng hộp thoại + tải lại", () => {
  it("gồm nhóm chung của đơn cộng yêu cầu đã quyết / không còn", () => {
    for (const code of ORDER_STALE_ERROR_CODES)
      expect(CANCELLATION_REQUEST_STALE_CODES).toContain(code);
    expect(CANCELLATION_REQUEST_STALE_CODES).toContain("ORDER_CANCELLATION_REQUEST_NOT_PENDING");
    expect(CANCELLATION_REQUEST_STALE_CODES).toContain("CANCELLATION_REQUEST_NOT_FOUND");
  });

  it("CANCELLATION_FEE_BEFORE_PRINTING KHÔNG phải dữ liệu cũ — giữ hộp thoại để bỏ phí rồi duyệt lại", () => {
    expect(CANCELLATION_REQUEST_STALE_CODES).not.toContain("CANCELLATION_FEE_BEFORE_PRINTING");
  });
});
